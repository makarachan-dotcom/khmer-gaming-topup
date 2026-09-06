import { and, eq, gt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { nanoid } from "nanoid";
import { orders, orderStatusEvents } from "../drizzle/schema";
import { buildOrderNumber } from "./storefrontDomain";
import { assessOrderVelocity } from "./paymentSecurity";
import { buildPartnerQuote, getPartnerProduct } from "./partnerCatalog";
import { countPendingKhqrPayments, getDb, getPublicPaymentAvailability, pendingKhqrPaymentLimit } from "./db";

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
