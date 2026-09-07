import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { orders, orderStatusEvents } from "../drizzle/schema";
import { buildOrderNumber } from "./storefrontDomain";
import { assessOrderVelocity } from "./paymentSecurity";
import { buildPartnerQuote, getPartnerProduct } from "./partnerCatalog";
import { countPendingKhqrPayments, getDb, getPublicPaymentAvailability, pendingKhqrPaymentLimit } from "./db";
import { buildPartnerDelivery, publicPartnerDelivery, type DeliveryMethod } from "../shared/partnerDelivery";
import { isCdkOrder, publicCdkStatus, tokenPreview, validateCdkToken } from "../shared/cdkToken";

const orderVelocityMessageKh = "មានការបង្កើតការបញ្ជាទិញច្រើនពេកក្នុងមួយម៉ោង តែមិនមានការទូទាត់បានជោគជ័យ។ សូមបញ្ចប់ការទូទាត់មួយជាមុនសិន រើសូមទាកតុ Admin។";

function buildTrackingCode() {
  return `ZRS-${randomBytes(10).toString("hex").toUpperCase()}`;
}

async function requirePublicPaymentEnabled() {
  const readiness = await getPublicPaymentAvailability();
  if (!readiness.ready) {
    throw new Error(readiness.reason === "payment_switch_off"
      ? "Payments are temporarily turned off by the store administrator."
      : "Automatic Cambodian payment is not available yet. Purchases are temporarily disabled.");
  }
}

export async function createPartnerServiceOrder(input: { userId: number; slug: string; quantity?: number; customerNote?: string }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (await countPendingKhqrPayments(input.userId) >= pendingKhqrPaymentLimit) {
    throw Object.assign(new Error("អ្នកមានការទូទាត់កំពុងរង់ចាំ ២ រួចហាយ។"), { code: "PENDING_PAYMENT_LIMIT" });
  }
  const quantity = input.quantity ?? 1;
  const product = await getPartnerProduct(input.slug, true);
  const quote = buildPartnerQuote(product, quantity);
  const recentOrders = await db.select({ createdAt: orders.createdAt, status: orders.status }).from(orders).where(and(eq(orders.userId, input.userId), gt(orders.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (assessOrderVelocity(recentOrders).blocked) throw Object.assign(new Error(orderVelocityMessageKh), { code: "ORDER_VELOCITY_BLOCKED" });
  const id = nanoid();
  const orderNumber = buildOrderNumber();
  const trackingCode = buildTrackingCode();
  const note = input.customerNote?.trim().slice(0, 400) ?? "";
  await db.insert(orders).values({
    id,
    orderNumber,
    trackingCode,
    userId: input.userId,
    orderType: "topup",
    status: "pending",
    currency: "USD",
    subtotal: quote.totalUsd,
    productName: `${product.provider.name} • ${product.name}`,
    details: {
      kind: "partner_service",
      adminQueue: "partner_service",
      fulfillmentMode: "admin_manual",
      noProviderFulfillment: true,
      partnerSlug: product.slug,
      partnerProductId: product.id,
      partnerDeliveryType: product.deliveryType,
      quantity: quote.quantity,
      unitPriceUsd: quote.unitPriceUsd,
      quoteVersion: quote.quoteVersion,
      customerNote: note || null,
      etaMinutes: { min: 5, max: 10 },
    },
  });
  await db.insert(orderStatusEvents).values({
    id: nanoid(),
    orderId: id,
    eventType: "order_created",
    status: "pending",
    actorType: "customer",
    messageKh: "ការកម្មង់សេវាឌីជីដាលត្រូវបានបង្កើត។ បន្ទាប់ពីទូទាត់ Admin នឹងបំពេញក្នុង ៥–១០ នាទី។",
    providerReference: null,
  });
  return { id, orderNumber, trackingCode, amount: quote.totalUsd, status: "pending" as const };
}

const DELIVERED_EVENT: Record<DeliveryMethod, string> = {
  CDK: "Admin បានផ្ញើលេខកូដ CDK ទៅគណនីរបស់អ្នក។",
  COUPON: "Admin បានផ្ញើលេខកូដ Coupon ទៅគណនីរបស់អ្នក។",
  LINK: "Admin បានផ្ញើតំណ Activation ទៅគណនីរបស់អ្នក។",
  READY_ACCOUNT: "Admin បានផ្ញើ email និងពាក្យសម្ងាត់ទៅគណនីរបស់អ្នក។",
  NOTE: "Admin បានផ្ញើព័ត៌មានសេវាទៅគណនីរបស់អ្នក។",
};

export async function deliverPartnerService(input: {
  orderId: string;
  actorUserId: number;
  method: DeliveryMethod;
  coupon?: string;
  link?: string;
  accountEmail?: string;
  accountPassword?: string;
  note?: string;
  instructions?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const row = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const order = row[0];
  if (!order) throw new Error("មិនរកឃើញការកម្មង់។");
  const details = order.details && typeof order.details === "object" && !Array.isArray(order.details) ? order.details as Record<string, unknown> : {};
  if (details.kind !== "partner_service" && details.adminQueue !== "partner_service") {
    throw new Error("ការកម្មង់នេះមិនមែនសេវាឌីជីថលទេ។");
  }
  if (!["paid", "delivered"].includes(order.status)) {
    throw new Error("បង់ប្រាក់រួចទើបផ្ញើសេវា។");
  }
  const delivery = buildPartnerDelivery({
    method: input.method,
    coupon: input.coupon,
    link: input.link,
    accountEmail: input.accountEmail,
    accountPassword: input.accountPassword,
    note: input.note,
    instructions: input.instructions,
    deliveredByUserId: input.actorUserId,
  });
  await db.update(orders).set({
    status: "delivered",
    details: { ...details, delivery, fulfilledAt: delivery.deliveredAt },
  }).where(eq(orders.id, order.id));
  await db.insert(orderStatusEvents).values({
    id: nanoid(),
    orderId: order.id,
    eventType: "partner_delivered",
    status: "delivered",
    actorType: "admin",
    messageKh: DELIVERED_EVENT[delivery.method],
    providerReference: null,
  });
  return { success: true as const, delivery: publicPartnerDelivery({ delivery }, "delivered") };
}

function sealCdkToken(token: string) {
  return { t: "plain" as const, v: token };
}

export async function submitCdkToken(input: { userId: number; orderId: string; token: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const token = validateCdkToken(input.token);
  const row = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  const order = row[0];
  if (!order) throw new Error("មិនរកឃើញការកម្មង់។");
  const details = order.details && typeof order.details === "object" && !Array.isArray(order.details) ? order.details as Record<string, unknown> : {};
  if (!isCdkOrder(details)) throw new Error("ការកម្មង់នេះមិនត្រូវការ token ទេ។");
  if (order.status !== "paid") throw new Error("បង់ប្រាក់រួចទើប paste token។");
  const submittedAt = new Date().toISOString();
  await db.update(orders).set({
    details: {
      ...details,
      cdkTokenSubmitted: true,
      cdkTokenSubmittedAt: submittedAt,
      cdkTokenPreview: tokenPreview(token),
      cdkTokenSecret: sealCdkToken(token),
    },
  }).where(eq(orders.id, order.id));
  await db.insert(orderStatusEvents).values({
    id: nanoid(),
    orderId: order.id,
    eventType: "cdk_token_received",
    status: "paid",
    actorType: "customer",
    messageKh: "បានទទួល token។ កំពុង upgrade plan — សូមរង់ចាំបន្តិច។",
    providerReference: null,
  });
  return publicCdkStatus({ ...details, cdkTokenSubmitted: true, cdkTokenPreview: tokenPreview(token) }, "paid");
}

export async function confirmCdkUpgrade(input: { orderId: string; actorUserId: number }) {
  return deliverPartnerService({
    orderId: input.orderId,
    actorUserId: input.actorUserId,
    method: "NOTE",
    note: "Plan បាន upgrade លើគណនីរបស់អ្នក។ សូម refresh ទំព័រសេវា។",
    instructions: "បើ plan មិនទាន់ឃើញ សូមចេញ រួចចូលគណនីម្ដងទៀត។",
  });
}
