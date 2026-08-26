import { and, asc, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  adminRoleAudits, customerWallets, gamePackages, gameProducts, gmailSenderConnections, InsertUser, marketplaceContacts, marketplaceDisclosureRequests, marketplaceEvidenceAccessLogs, marketplaceFavorites, marketplaceFraudReports, marketplaceListings, marketplaceVerificationEvidence, marketplaceVerifications, orders, orderStatusEvents, orderSupportTickets, paymentTransactions, providerPackageArtworkAudits, providerPackageArtworkOverrides, savedPlayerIds, siteContent, smmServices, smmTiers, User, users, walletTopups, welcomeEmailDeliveries,
} from "../drizzle/schema";
import { createAppwriteMarketplaceListing, createAppwriteWalletTopup, deleteAppwriteMarketplaceListing, getAppwriteAdminRoleAudits, getAppwriteCustomerOrders, getAppwriteCustomerPaymentHistory, getAppwritePaymentControl, getAppwriteProviderCatalog, getAppwriteUserByEmail, getAppwriteUserByOpenId, getAppwriteWalletSummary, getAppwriteWalletTopup, isAppwriteStoreConfigured, listAppwriteMarketplaceListings, listAppwriteUsers, setAppwritePaymentControl, setAppwriteUserRole, syncAppwriteFzrCatalog, syncAppwriteSmmCatalog, updateAppwriteMarketplaceListing, updateAppwriteProviderOffer, updateAppwriteUserDisplayName, updateAppwriteWalletTopup, upsertAppwriteUser } from "./appwriteStore";
import { buildOrderNumber, isSingleAdminEmail } from "./storefrontDomain";
import { validateAdminRoleChange } from "./adminRoles";
import { buildEvidenceRetentionAuditReason, canApproveMarketplaceVerification, hasOnlyOwnedMarketplaceScreenshotKeys, type DisclosureRequestStatus, type FraudReportStatus } from "./marketplaceSafety";
import { getPublicPaymentReadiness } from "./paymentReadiness";
import { checkBakongKhqrPayment, createBakongKhqrPayment, registerBakongKhqrWorkerWatch } from "./bakongKhqr";
import { getKhqrReconciliationDisposition, getKhqrWalletReconciliationDisposition } from "./khqrReconciliation";
import type { FzrProviderSyncSnapshot, SmmProviderCatalogResponse } from "./providerCatalog";
import { submitSmmProviderOrder } from "./providerCatalog";

let _db: ReturnType<typeof drizzle> | null = null;

function normalizeOwnerRole<T extends { email: string | null; role: "admin" | "user" } | undefined>(user: T): T {
  if (user && isSingleAdminEmail(user.email) && user.role !== "admin") return { ...user, role: "admin" } as T;
  return user;
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<User | undefined> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? upsertAppwriteUser(user) : undefined;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Partial<InsertUser> = { lastSignedIn: values.lastSignedIn };
  if (user.name !== undefined) { values.name = user.name; updateSet.name = user.name; }
  if (user.loginMethod !== undefined) { values.loginMethod = user.loginMethod; updateSet.loginMethod = user.loginMethod; }
  if (user.email !== undefined) {
    const email = user.email?.trim().toLowerCase() ?? null;
    values.email = email;
    updateSet.email = email;
    const role = isSingleAdminEmail(email) ? "admin" : "user";
    values.role = role;
    updateSet.role = role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  return undefined;
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return normalizeOwnerRole(isAppwriteStoreConfigured() ? await getAppwriteUserByOpenId(openId) : undefined);
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return normalizeOwnerRole(result[0]);
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return normalizeOwnerRole(isAppwriteStoreConfigured() ? await getAppwriteUserByEmail(email) : undefined);
  const normalized = email.trim().toLowerCase();
  const result = await db.select().from(users).where(sql`lower(trim(${users.email})) = ${normalized}`).limit(1);
  return normalizeOwnerRole(result[0]);
}

export async function upsertGmailSenderConnection(input: { ownerUserId: number; senderEmail: string; encryptedRefreshToken: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: gmailSenderConnections.id }).from(gmailSenderConnections).where(eq(gmailSenderConnections.ownerUserId, input.ownerUserId)).limit(1);
  if (existing[0]) {
    await db.update(gmailSenderConnections).set({ senderEmail: input.senderEmail, encryptedRefreshToken: input.encryptedRefreshToken }).where(eq(gmailSenderConnections.id, existing[0].id));
    return { id: existing[0].id, senderEmail: input.senderEmail };
  }
  const id = nanoid();
  await db.insert(gmailSenderConnections).values({ id, ...input });
  return { id, senderEmail: input.senderEmail };
}

export async function getGmailSenderConnection() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gmailSenderConnections).orderBy(desc(gmailSenderConnections.updatedAt)).limit(1);
  return result[0];
}

export async function getWelcomeEmailDelivery(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(welcomeEmailDeliveries).where(eq(welcomeEmailDeliveries.recipientUserId, userId)).limit(1);
  return result[0];
}

export async function recordWelcomeEmailDelivery(input: { recipientUserId: number; recipientEmail: string; senderConnectionId: string; providerMessageId?: string | null; status: "sent" | "failed" }) {
  const db = await getDb();
  if (!db) return;
  const existing = await getWelcomeEmailDelivery(input.recipientUserId);
  if (existing) return existing;
  const id = nanoid();
  await db.insert(welcomeEmailDeliveries).values({ id, ...input, providerMessageId: input.providerMessageId ?? null });
  return { id, ...input };
}

export async function updateUserDisplayName(input: { user: User; displayName: string }) {
  const db = await getDb();
  if (!db) { if (isAppwriteStoreConfigured()) return updateAppwriteUserDisplayName({ user: input.user, displayName: input.displayName }); throw new Error("Database unavailable"); }
  await db.update(users).set({ displayName: input.displayName }).where(eq(users.id, input.user.id));
  return { displayName: input.displayName };
}

export async function getCustomerWalletSummary(userId: number) {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteWalletSummary(userId) : { balanceKhr: "0.00", currency: "KHR" as const, available: false };
  const existing = await db.select().from(customerWallets).where(eq(customerWallets.userId, userId)).limit(1);
  if (existing[0]) return { balanceKhr: String(existing[0].balanceKhr), currency: "KHR" as const, available: true };
  await db.insert(customerWallets).values({ userId, balanceKhr: "0.00" }).onDuplicateKeyUpdate({ set: { userId } });
  return { balanceKhr: "0.00", currency: "KHR" as const, available: true };
}

function buildWalletTopupReference() {
  return `WLT-${randomBytes(5).toString("hex").toUpperCase()}`;
}

function walletTopupPayload(row: typeof walletTopups.$inferSelect) {
  const payload = row.paymentPayload && typeof row.paymentPayload === "object" ? row.paymentPayload as Record<string, unknown> : {};
  return {
    id: row.id,
    referenceCode: row.referenceCode,
    status: row.status,
    amountKhr: String(row.amountKhr),
    currency: "KHR" as const,
    expiresAt: row.expiresAt,
    paidAt: row.paidAt,
    creditedAt: row.creditedAt,
    qrImageDataUrl: typeof payload.qrImageDataUrl === "string" ? payload.qrImageDataUrl : null,
    deeplink: typeof payload.deeplink === "string" ? payload.deeplink : null,
  };
}

export async function getWalletTopupAvailability() {
  const db = await getDb();
  if (!db && !isAppwriteStoreConfigured()) return { available: false, reason: "verified_ledger_unavailable" as const };
  const readiness = await getPublicPaymentAvailability();
  return readiness.ready ? { available: true, reason: null } as const : { available: false, reason: readiness.reason } as const;
}

export async function beginWalletTopup(input: { userId: number; amountKhr: string }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db && !isAppwriteStoreConfigured()) throw new Error("Wallet top-up requires the verified transaction ledger. Please try again later.");
  const amount = Number(input.amountKhr);
  if (!Number.isInteger(amount) || amount < 100 || amount > 10_000_000) throw new Error("Wallet top-up amount must be between 100 and 10,000,000 KHR.");
  const now = new Date();
  if (db) {
    const active = await db.select().from(walletTopups).where(and(eq(walletTopups.userId, input.userId), eq(walletTopups.provider, "bakong_khqr"), eq(walletTopups.status, "pending"), gt(walletTopups.expiresAt, now))).orderBy(desc(walletTopups.createdAt)).limit(1);
    if (active[0]) return walletTopupPayload(active[0]);
  }
  const referenceCode = buildWalletTopupReference();
  const generated = await createBakongKhqrPayment({ trackingCode: referenceCode, amount: String(amount), currency: "KHR" });
  const record = { id: nanoid(), userId: input.userId, referenceCode, provider: "bakong_khqr", providerRequestId: generated.md5, status: "pending" as const, amountKhr: String(amount), paymentPayload: { bakongMd5: generated.md5, merchantAccountId: generated.merchantAccountId, qrImageDataUrl: generated.qrImageDataUrl, deeplink: generated.deeplink }, expiresAt: generated.expiresAt, createdAt: now, updatedAt: now };
  if (!db) return walletTopupPayload(await createAppwriteWalletTopup(record));
  await db.insert(walletTopups).values(record);
  try {
    await registerBakongKhqrWorkerWatch({ md5: generated.md5, orderId: `wallet:${record.id}`, amount: String(amount), currency: "KHR" });
  } catch (error) {
    await db.update(walletTopups).set({ status: "failed" }).where(and(eq(walletTopups.id, record.id), eq(walletTopups.status, "pending")));
    throw error;
  }
  return walletTopupPayload({ ...record, providerTransactionId: null, paidAt: null, creditedAt: null });
}

export async function getWalletTopupSession(input: { userId: number; topupId: string }) {
  const db = await getDb();
  if (!db) {
    const current = isAppwriteStoreConfigured() ? await getAppwriteWalletTopup(input) : undefined;
    if (!current) throw new Error("Wallet top-up session was not found");
    return walletTopupPayload(current);
  }
  const rows = await db.select().from(walletTopups).where(and(eq(walletTopups.id, input.topupId), eq(walletTopups.userId, input.userId))).limit(1);
  if (!rows[0]) throw new Error("Wallet top-up session was not found");
  return walletTopupPayload(rows[0]);
}

export async function refreshWalletTopup(input: { userId: number; topupId: string }) {
  const db = await getDb();
  if (!db) return refreshAppwriteWalletTopup(input);
  const rows = await db.select().from(walletTopups).where(and(eq(walletTopups.id, input.topupId), eq(walletTopups.userId, input.userId))).limit(1);
  const current = rows[0];
  if (!current) throw new Error("Wallet top-up session was not found");
  if (current.status === "paid") return { topup: walletTopupPayload(current), wallet: await getCustomerWalletSummary(input.userId) };
  if (current.status !== "pending") return { topup: walletTopupPayload(current), wallet: await getCustomerWalletSummary(input.userId) };
  if (current.expiresAt.getTime() <= Date.now()) {
    await db.update(walletTopups).set({ status: "expired" }).where(and(eq(walletTopups.id, current.id), eq(walletTopups.status, "pending")));
    return { topup: await getWalletTopupSession(input), wallet: await getCustomerWalletSummary(input.userId) };
  }
  // The worker is the sole automatic Bakong checker. This customer refresh only
  // reads the primary ledger, so browser polling cannot consume provider quota
  // or create a second path that credits a Wallet.
  return { topup: await getWalletTopupSession(input), wallet: await getCustomerWalletSummary(input.userId) };
}

async function refreshAppwriteWalletTopup(input: { userId: number; topupId: string }) {
  if (!isAppwriteStoreConfigured()) throw new Error("Wallet top-up ledger is unavailable");
  const current = await getAppwriteWalletTopup(input);
  if (!current) throw new Error("Wallet top-up session was not found");
  if (current.status !== "pending") return { topup: walletTopupPayload(current), wallet: await getCustomerWalletSummary(input.userId) };
  if (current.expiresAt.getTime() <= Date.now()) {
    const topup = await updateAppwriteWalletTopup({ ...input, status: "expired" });
    return { topup: walletTopupPayload(topup), wallet: await getCustomerWalletSummary(input.userId) };
  }
  // Keep browser-driven refresh ledger-only; worker callbacks perform exact
  // Bakong verification and the idempotent credit transition.
  return { topup: walletTopupPayload(current), wallet: await getCustomerWalletSummary(input.userId) };
}

export async function getGameCatalog() {
  const db = await getDb();
  if (!db) return [];
  const products = await db.select().from(gameProducts).where(eq(gameProducts.isActive, true)).orderBy(asc(gameProducts.sortOrder));
  const packages = await db.select().from(gamePackages).where(eq(gamePackages.isActive, true)).orderBy(asc(gamePackages.sortOrder));
  return products.map((product) => ({ ...product, packages: packages.filter((item) => item.productId === product.id) }));
}

export async function getSmmCatalog() {
  const db = await getDb();
  if (!db) return [];
  const services = await db.select().from(smmServices).where(eq(smmServices.isActive, true)).orderBy(asc(smmServices.sortOrder));
  const tiers = await db.select().from(smmTiers).where(eq(smmTiers.isActive, true)).orderBy(asc(smmTiers.sortOrder));
  return services.map((service) => ({ ...service, tiers: tiers.filter((item) => item.serviceId === service.id) }));
}

export async function getAdminCatalog(): Promise<{ games: any[]; smm: any[] }> {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteProviderCatalog() : { games: [], smm: [] };
  const games = await db.select().from(gameProducts).orderBy(asc(gameProducts.sortOrder));
  const packages = await db.select().from(gamePackages).orderBy(asc(gamePackages.sortOrder));
  const services = await db.select().from(smmServices).orderBy(asc(smmServices.sortOrder));
  const tiers = await db.select().from(smmTiers).orderBy(asc(smmTiers.sortOrder));
  const primaryCatalog = { games: games.map((game) => ({ ...game, packages: packages.filter((item) => item.productId === game.id) })), smm: services.map((service) => ({ ...service, tiers: tiers.filter((item) => item.serviceId === service.id) })) };
  if (primaryCatalog.games.length || primaryCatalog.smm.length || !isAppwriteStoreConfigured()) return primaryCatalog;
  return getAppwriteProviderCatalog();
}

function providerRecordId(prefix: string, source: string) {
  return `${prefix}-${createHash("sha256").update(source).digest("hex").slice(0, 40)}`;
}

type OrderStatus = "pending" | "awaiting_payment" | "paid" | "delivered" | "failed" | "expired" | "refunded";
type TicketStatus = "open" | "reviewing" | "resolved" | "closed";

function buildTrackingCode() { return `ZRS-${randomBytes(10).toString("hex").toUpperCase()}`; }
function buildTicketNumber() { return `TKT-${randomBytes(8).toString("hex").toUpperCase()}`; }
function statusMessageKh(status: OrderStatus) {
  return ({
    pending: "ការបញ្ជាទិញត្រូវបានបង្កើត និងកំពុងរង់ចាំការទូទាត់។",
    awaiting_payment: "បានបង្កើតសំណើទូទាត់។ សូមបំពេញការទូទាត់តាមវិធីសាស្ត្រដែលបានជ្រើស។",
    paid: "បានទទួលការទូទាត់។ ប្រព័ន្ធកំពុងដំណើរការសេវារបស់អ្នក។",
    delivered: "សេវាកម្មត្រូវបានបញ្ចប់ដោយជោគជ័យ។",
    failed: "ការបញ្ជាទិញមិនអាចដំណើរការបានទេ។ អ្នកអាចបើក ticket ដើម្បីស្នើជំនួយ។",
    expired: "សំណើទូទាត់ផុតកំណត់។ សូមបង្កើតការបញ្ជាទិញថ្មី។",
    refunded: "ការបញ្ជាទិញត្រូវបានសម្គាល់ថាបានសងប្រាក់វិញ។",
  } as const)[status];
}

async function appendOrderStatusEvent(input: { orderId: string; eventType: string; status: OrderStatus; actorType: "system" | "customer" | "admin" | "provider"; messageKh: string; providerReference?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(orderStatusEvents).values({ id: nanoid(), orderId: input.orderId, eventType: input.eventType, status: input.status, actorType: input.actorType, messageKh: input.messageKh, providerReference: input.providerReference ?? null });
}

export async function syncFzrCatalog(snapshot: Extract<FzrProviderSyncSnapshot, { status: "ready" }>) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Provider catalog storage is unavailable");
    return syncAppwriteFzrCatalog(snapshot);
  }
  let gamesImported = 0;
  let offersImported = 0;
  for (let sortOrder = 0; sortOrder < snapshot.games.length; sortOrder += 1) {
    const game = snapshot.games[sortOrder]!;
    const gameId = providerRecordId("fzr-game", game.providerGameId);
    const requiresZone = game.requiredFields.some((field: { key: string }) => /zone|server|region/i.test(field.key));
    const existingGame = await db.select({ id: gameProducts.id }).from(gameProducts).where(eq(gameProducts.id, gameId)).limit(1);
    if (existingGame[0]) {
      await db.update(gameProducts).set({ titleKh: game.name, titleEn: game.name, currencyLabel: "Top-up", requiresZone, sortOrder }).where(eq(gameProducts.id, gameId));
    } else {
      await db.insert(gameProducts).values({ id: gameId, slug: `fzr-${createHash("sha256").update(game.providerGameId).digest("hex").slice(0, 32)}`, titleKh: game.name, titleEn: game.name, currencyLabel: "Top-up", iconLabel: "G", accent: "#4f46e5", requiresZone, isActive: false, sortOrder });
      gamesImported += 1;
    }
    for (let offerOrder = 0; offerOrder < game.offers.length; offerOrder += 1) {
      const offer = game.offers[offerOrder]!;
      const source = `fzr_cards:${game.providerGameId}:${offer.providerOfferId}`;
      const packageId = providerRecordId("fzr-offer", source);
      const existing = await db.select({ id: gamePackages.id, profitMarginPercent: gamePackages.profitMarginPercent }).from(gamePackages).where(eq(gamePackages.id, packageId)).limit(1);
      if (existing[0]) {
        const margin = String(existing[0].profitMarginPercent);
        await db.update(gamePackages).set({ amountLabel: offer.name, providerAuthorized: true, providerSource: source, basePriceUsd: offer.priceUsd, priceUsd: salePriceFromMargin(offer.priceUsd, margin), sortOrder: offerOrder }).where(eq(gamePackages.id, packageId));
      } else {
        await db.insert(gamePackages).values({ id: packageId, productId: gameId, amountLabel: offer.name, providerAuthorized: true, providerSource: source, basePriceUsd: offer.priceUsd, profitMarginPercent: "0.00", priceUsd: offer.priceUsd, featured: false, isActive: false, sortOrder: offerOrder });
        offersImported += 1;
      }
    }
  }
  return { gamesImported, offersImported, provider: "FZR Cards" as const };
}

export async function syncSmmCatalog(snapshot: Extract<SmmProviderCatalogResponse, { status: "ready" }>) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Provider catalog storage is unavailable");
    return syncAppwriteSmmCatalog(snapshot);
  }
  let servicesImported = 0;
  let tiersImported = 0;
  for (let sortOrder = 0; sortOrder < snapshot.services.length; sortOrder += 1) {
    const service = snapshot.services[sortOrder]!;
    const serviceId = providerRecordId("smm-service", service.providerServiceId);
    const slug = `smm-${createHash("sha256").update(service.providerServiceId).digest("hex").slice(0, 32)}`;
    const descriptionKh = `${service.name} · អប្បបរមា ${service.min.toLocaleString()} និងអតិបរមា ${service.max.toLocaleString()}។`;
    const existingService = await db.select({ id: smmServices.id }).from(smmServices).where(eq(smmServices.id, serviceId)).limit(1);
    if (existingService[0]) {
      await db.update(smmServices).set({ platform: service.category, serviceType: service.serviceType, titleKh: service.name, titleEn: service.name, descriptionKh, sortOrder }).where(eq(smmServices.id, serviceId));
    } else {
      await db.insert(smmServices).values({ id: serviceId, slug, platform: service.category, serviceType: service.serviceType, titleKh: service.name, titleEn: service.name, descriptionKh, iconLabel: "S", isActive: false, sortOrder });
      servicesImported += 1;
    }
    const source = `smmglob:${service.providerServiceId}:min=${service.min}:max=${service.max}`;
    const tierId = providerRecordId("smm-tier", source);
    const basePrice = (Number(service.rateUsdPerThousand) * Math.max(service.min, 1) / 1000).toFixed(2);
    const existingTier = await db.select({ id: smmTiers.id, profitMarginPercent: smmTiers.profitMarginPercent }).from(smmTiers).where(eq(smmTiers.id, tierId)).limit(1);
    if (existingTier[0]) {
      const margin = String(existingTier[0].profitMarginPercent);
      await db.update(smmTiers).set({ quantity: Math.max(service.min, 1), providerAuthorized: true, providerSource: source, basePriceUsd: basePrice, priceUsd: salePriceFromMargin(basePrice, margin), sortOrder }).where(eq(smmTiers.id, tierId));
    } else {
      await db.insert(smmTiers).values({ id: tierId, serviceId, quantity: Math.max(service.min, 1), providerAuthorized: true, providerSource: source, basePriceUsd: basePrice, profitMarginPercent: "0.00", priceUsd: basePrice, isActive: false, sortOrder });
      tiersImported += 1;
    }
  }
  return { servicesImported, tiersImported, provider: "SMMGlob" as const };
}

export async function createTopupOrder(input: { userId: number; packageId: string; playerId: string; zoneId?: string | null; quantity: number }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select({ game: gameProducts, package: gamePackages }).from(gamePackages).innerJoin(gameProducts, eq(gamePackages.productId, gameProducts.id)).where(and(eq(gamePackages.id, input.packageId), eq(gamePackages.isActive, true), eq(gameProducts.isActive, true))).limit(1);
  const item = result[0];
  if (!item) throw new Error("Selected game package is unavailable");
  if (item.game.requiresZone && !input.zoneId?.trim()) throw new Error("Server or zone ID is required for this game");
  const subtotal = Number(item.package.priceUsd) * input.quantity;
  const id = nanoid(); const orderNumber = buildOrderNumber(); const trackingCode = buildTrackingCode();
  await db.insert(orders).values({ id, orderNumber, trackingCode, userId: input.userId, orderType: "topup", status: "pending", subtotal: subtotal.toFixed(2), productName: `${item.game.titleEn} • ${item.package.amountLabel} ${item.game.currencyLabel}`, details: { packageId: item.package.id, gameProductId: item.game.id, playerId: input.playerId.trim(), zoneId: input.zoneId?.trim() ?? null, quantity: input.quantity } });
  await appendOrderStatusEvent({ orderId: id, eventType: "order_created", status: "pending", actorType: "customer", messageKh: statusMessageKh("pending") });
  return { id, orderNumber, trackingCode, amount: subtotal.toFixed(2), status: "pending" as const };
}

export async function createSmmOrder(input: { userId: number; tierId: string; target: string }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select({ service: smmServices, tier: smmTiers }).from(smmTiers).innerJoin(smmServices, eq(smmTiers.serviceId, smmServices.id)).where(and(eq(smmTiers.id, input.tierId), eq(smmTiers.isActive, true), eq(smmServices.isActive, true))).limit(1);
  const item = result[0];
  if (!item) throw new Error("Selected SMM tier is unavailable");
  const id = nanoid(); const orderNumber = buildOrderNumber(); const trackingCode = buildTrackingCode();
  await db.insert(orders).values({ id, orderNumber, trackingCode, userId: input.userId, orderType: "smm", status: "pending", subtotal: item.tier.priceUsd, productName: `${item.service.platform} • ${item.service.titleEn} (${item.tier.quantity.toLocaleString()})`, details: { serviceId: item.service.id, tierId: item.tier.id, target: input.target.trim(), quantity: item.tier.quantity, providerSource: item.tier.providerSource } });
  await appendOrderStatusEvent({ orderId: id, eventType: "order_created", status: "pending", actorType: "customer", messageKh: statusMessageKh("pending") });
  return { id, orderNumber, trackingCode, amount: item.tier.priceUsd, status: "pending" as const };
}

export async function getCustomerOrders(userId: number) {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteCustomerOrders(userId) : [];
  const customerOrders = await db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
  if (!customerOrders.length) return [];
  const events = await db.select().from(orderStatusEvents).where(inArray(orderStatusEvents.orderId, customerOrders.map((order) => order.id))).orderBy(asc(orderStatusEvents.createdAt));
  return customerOrders.map((order) => ({ ...order, events: events.filter((event) => event.orderId === order.id) }));
}

export async function getCustomerPaymentHistory(userId: number) {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteCustomerPaymentHistory(userId) : [];
  return db.select({ id: paymentTransactions.id, orderId: paymentTransactions.orderId, provider: paymentTransactions.provider, status: paymentTransactions.status, amount: paymentTransactions.amount, currency: paymentTransactions.currency, createdAt: paymentTransactions.createdAt, updatedAt: paymentTransactions.updatedAt, paidAt: paymentTransactions.paidAt, orderNumber: orders.orderNumber, productName: orders.productName, orderStatus: orders.status }).from(paymentTransactions).innerJoin(orders, eq(paymentTransactions.orderId, orders.id)).where(eq(orders.userId, userId)).orderBy(desc(paymentTransactions.createdAt));
}

export async function beginStagedPayment(input: { orderId: string; userId: number }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0]) throw new Error("Order not found");
  if (["paid", "delivered", "failed", "expired", "refunded"].includes(order[0].status)) throw new Error("This order cannot begin a payment session");
  const existing = await db.select().from(paymentTransactions).where(and(eq(paymentTransactions.orderId, input.orderId), eq(paymentTransactions.provider, "bakong_khqr"))).orderBy(desc(paymentTransactions.createdAt)).limit(1);
  const existingData = existing[0]?.callbackPayload && typeof existing[0].callbackPayload === "object" ? existing[0].callbackPayload as Record<string, unknown> : null;
  const canReuse = existing[0] && existing[0].status === "pending" && existing[0].expiresAt && existing[0].expiresAt.getTime() > Date.now() && typeof existingData?.qrImageDataUrl === "string" && typeof existingData.bakongMd5 === "string";
  const currency = order[0].currency === "KHR" ? "KHR" : "USD" as const;
  const generated = canReuse ? null : await createBakongKhqrPayment({ trackingCode: order[0].trackingCode, amount: String(order[0].subtotal), currency });
  const transaction = existing[0] && canReuse ? existing[0] : { id: nanoid(), orderId: input.orderId, provider: "bakong_khqr", providerRequestId: generated!.md5, status: "pending" as const, amount: order[0].subtotal, currency, checkoutUrl: generated!.deeplink ?? `/checkout/${input.orderId}`, callbackPayload: { bakongMd5: generated!.md5, merchantAccountId: generated!.merchantAccountId, qrImageDataUrl: generated!.qrImageDataUrl, deeplink: generated!.deeplink }, expiresAt: generated!.expiresAt };
  if (!canReuse) {
    await db.insert(paymentTransactions).values(transaction);
    await registerBakongKhqrWorkerWatch({ md5: generated!.md5, orderId: input.orderId, amount: String(order[0].subtotal), currency });
  }
  if (order[0].status !== "awaiting_payment") await appendOrderStatusEvent({ orderId: input.orderId, eventType: "payment_session_created", status: "awaiting_payment", actorType: "system", messageKh: statusMessageKh("awaiting_payment") });
  await db.update(orders).set({ status: "awaiting_payment" }).where(eq(orders.id, input.orderId));
  const payload = transaction.callbackPayload && typeof transaction.callbackPayload === "object" ? transaction.callbackPayload as Record<string, unknown> : {};
  return { order: { id: order[0].id, orderNumber: order[0].orderNumber, trackingCode: order[0].trackingCode, productName: order[0].productName, subtotal: order[0].subtotal, status: "awaiting_payment" as const }, payment: { id: transaction.id, provider: transaction.provider, status: transaction.status, checkoutUrl: transaction.checkoutUrl, qrImageDataUrl: typeof payload.qrImageDataUrl === "string" ? payload.qrImageDataUrl : null, deeplink: typeof payload.deeplink === "string" ? payload.deeplink : null, expiresAt: transaction.expiresAt } };
}

export async function getCustomerPaymentSession(input: { orderId: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0]) throw new Error("Order not found");
  const payment = await db.select().from(paymentTransactions).where(eq(paymentTransactions.orderId, input.orderId)).orderBy(desc(paymentTransactions.createdAt)).limit(1);
  const current = payment[0];
  const payload = current?.callbackPayload && typeof current.callbackPayload === "object" ? current.callbackPayload as Record<string, unknown> : {};
  return { order: order[0], payment: current ? { id: current.id, provider: current.provider, status: current.status, amount: current.amount, currency: current.currency, checkoutUrl: current.checkoutUrl, expiresAt: current.expiresAt, paidAt: current.paidAt, qrImageDataUrl: typeof payload.qrImageDataUrl === "string" ? payload.qrImageDataUrl : null, deeplink: typeof payload.deeplink === "string" ? payload.deeplink : null } : null };
}

export async function refreshBakongPayment(input: { orderId: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0]) throw new Error("Order not found");
  const payment = await db.select().from(paymentTransactions).where(and(eq(paymentTransactions.orderId, input.orderId), eq(paymentTransactions.provider, "bakong_khqr"))).orderBy(desc(paymentTransactions.createdAt)).limit(1);
  const current = payment[0];
  if (!current) throw new Error("Bakong payment session not found");
  if (current.status === "paid") return getCustomerPaymentSession(input);
  if (current.expiresAt && current.expiresAt.getTime() <= Date.now()) { await db.update(paymentTransactions).set({ status: "expired" }).where(eq(paymentTransactions.id, current.id)); await updateOrderStatus({ orderId: input.orderId, status: "expired" }); return getCustomerPaymentSession(input); }
  // The worker owns provider polling and signed confirmation. This endpoint only
  // returns the current ledger session (and expires stale rows above), preventing
  // the browser from issuing duplicate Bakong lookups every ten seconds.
  return getCustomerPaymentSession(input);
}

export async function recordKhqrWorkerVerificationDeferred(input: { md5: string; orderId: string; amount: string | number; currency: "KHR" | "USD"; reason: "bakong_daily_request_limit" }) {
  const db = await getDb();
  if (!db) throw new Error("Payment verification status requires the primary ledger database.");
  const recordedAt = new Date().toISOString();
  if (input.orderId.startsWith("wallet:")) {
    const walletId = input.orderId.slice("wallet:".length);
    const rows = await db.select().from(walletTopups).where(eq(walletTopups.id, walletId)).limit(1);
    const wallet = rows[0];
    const payload = wallet?.paymentPayload && typeof wallet.paymentPayload === "object" ? wallet.paymentPayload as Record<string, unknown> : {};
    const storedMd5 = typeof payload.bakongMd5 === "string" ? payload.bakongMd5 : "";
    if (!wallet || wallet.provider !== "bakong_khqr" || wallet.status !== "pending" || storedMd5 !== input.md5 || String(wallet.amountKhr) !== String(input.amount) || input.currency !== "KHR") throw new Error("Deferred verification did not match an eligible wallet session.");
    await db.update(walletTopups).set({ paymentPayload: { ...payload, lastWorkerVerificationAt: recordedAt, lastWorkerVerificationMd5: input.md5, lastWorkerVerificationStatus: "verification_deferred", lastWorkerVerificationError: input.reason } }).where(and(eq(walletTopups.id, wallet.id), eq(walletTopups.status, "pending")));
    return { recorded: true };
  }
  const match = await db.select().from(paymentTransactions).where(and(eq(paymentTransactions.provider, "bakong_khqr"), eq(paymentTransactions.providerRequestId, input.md5), eq(paymentTransactions.orderId, input.orderId))).limit(1);
  const payment = match[0];
  const payload = payment?.callbackPayload && typeof payment.callbackPayload === "object" ? payment.callbackPayload as Record<string, unknown> : {};
  if (!payment || payment.status !== "pending" || String(payment.amount) !== String(input.amount) || payment.currency !== input.currency) throw new Error("Deferred verification did not match an eligible checkout payment session.");
  await db.update(paymentTransactions).set({ callbackPayload: { ...payload, lastWorkerVerificationAt: recordedAt, lastWorkerVerificationMd5: input.md5, lastWorkerVerificationStatus: "verification_deferred", lastWorkerVerificationError: input.reason } }).where(and(eq(paymentTransactions.id, payment.id), eq(paymentTransactions.status, "pending")));
  return { recorded: true };
}

export async function reconcileKhqrWorkerPayment(input: { md5: string; orderId: string; amount: string | number; currency: "KHR" | "USD" }) {
  const db = await getDb();
  if (!db) throw new Error("Payment reconciliation requires the primary ledger database.");
  if (input.orderId.startsWith("wallet:")) {
    const walletId = input.orderId.slice("wallet:".length);
    if (!walletId) throw new Error("Wallet callback did not identify a stored session.");
    const rows = await db.select().from(walletTopups).where(eq(walletTopups.id, walletId)).limit(1);
    const wallet = rows[0];
    const payload = wallet?.paymentPayload && typeof wallet.paymentPayload === "object" ? wallet.paymentPayload as Record<string, unknown> : {};
    const storedMd5 = typeof payload.bakongMd5 === "string" ? payload.bakongMd5 : "";
    const walletDisposition = getKhqrWalletReconciliationDisposition(wallet ? {
      provider: wallet.provider,
      md5: storedMd5,
      walletId: wallet.id,
      amount: wallet.amountKhr,
      status: wallet.status,
    } : undefined, input);
    if (walletDisposition === "reject") throw new Error("Payment callback did not match an eligible wallet session.");
    if (walletDisposition === "idempotent") return { idempotent: true };
    const merchantAccountId = typeof payload.merchantAccountId === "string" ? payload.merchantAccountId : undefined;
    const verification = await checkBakongKhqrPayment({ md5: input.md5, expectedAmount: String(wallet.amountKhr), expectedCurrency: "KHR", expectedMerchantAccountId: merchantAccountId });
    if (verification.status !== "paid") {
      await db.update(walletTopups).set({ paymentPayload: { ...payload, lastWorkerVerificationAt: new Date().toISOString(), lastWorkerVerificationMd5: input.md5, lastWorkerVerificationStatus: verification.status, lastWorkerVerificationError: verification.reason } }).where(and(eq(walletTopups.id, wallet.id), eq(walletTopups.status, "pending")));
      throw new Error("Bakong did not confirm the stored Wallet payment session.");
    }
    await db.transaction(async (tx) => {
      const transition = await tx.update(walletTopups).set({ status: "paid", providerTransactionId: verification.transactionHash, paidAt: new Date(), creditedAt: new Date() }).where(and(eq(walletTopups.id, wallet.id), eq(walletTopups.status, "pending")));
      const affectedRows = Array.isArray(transition) ? Number((transition[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) : 0;
      if (affectedRows > 0) await tx.insert(customerWallets).values({ userId: wallet.userId, balanceKhr: String(wallet.amountKhr) }).onDuplicateKeyUpdate({ set: { balanceKhr: sql`${customerWallets.balanceKhr} + ${wallet.amountKhr}` } });
    });
    return { idempotent: false };
  }
  const match = await db.select({ payment: paymentTransactions, order: orders }).from(paymentTransactions).innerJoin(orders, eq(paymentTransactions.orderId, orders.id)).where(and(eq(paymentTransactions.provider, "bakong_khqr"), eq(paymentTransactions.providerRequestId, input.md5), eq(paymentTransactions.orderId, input.orderId))).limit(1);
  const record = match[0];
  const disposition = getKhqrReconciliationDisposition(record ? {
    provider: record.payment.provider,
    md5: record.payment.providerRequestId ?? "",
    orderId: record.payment.orderId,
    amount: record.payment.amount,
    currency: record.payment.currency as "KHR" | "USD",
    paymentStatus: record.payment.status,
    orderStatus: record.order.status,
  } : undefined, input);
  if (disposition === "reject") throw new Error("Payment callback did not match an eligible stored payment session.");
  if (disposition === "idempotent") return { idempotent: true };
  const existingPayload = record.payment.callbackPayload && typeof record.payment.callbackPayload === "object" ? record.payment.callbackPayload as Record<string, unknown> : {};
  const merchantAccountId = typeof existingPayload.merchantAccountId === "string" ? existingPayload.merchantAccountId : undefined;
  const verification = await checkBakongKhqrPayment({ md5: input.md5, expectedAmount: String(record.payment.amount), expectedCurrency: record.payment.currency as "KHR" | "USD", expectedMerchantAccountId: merchantAccountId });
  if (verification.status !== "paid") {
    await db.update(paymentTransactions).set({ callbackPayload: { ...existingPayload, lastWorkerVerificationAt: new Date().toISOString(), lastWorkerVerificationMd5: input.md5, lastWorkerVerificationStatus: verification.status, lastWorkerVerificationError: verification.reason } }).where(and(eq(paymentTransactions.id, record.payment.id), eq(paymentTransactions.status, "pending")));
    throw new Error("Bakong did not confirm the stored checkout payment session.");
  }
  await db.update(paymentTransactions).set({ status: "paid", providerTransactionId: verification.transactionHash, paidAt: new Date(), callbackPayload: { ...existingPayload, workerVerifiedAt: new Date().toISOString(), workerMd5: input.md5, transactionHash: verification.transactionHash } }).where(eq(paymentTransactions.id, record.payment.id));
  await db.update(orders).set({ status: "paid" }).where(eq(orders.id, record.order.id));
  await appendOrderStatusEvent({ orderId: record.order.id, eventType: "payment_confirmed", status: "paid", actorType: "system", messageKh: statusMessageKh("paid"), providerReference: input.md5 });
  return { idempotent: false };
}

export async function getCustomerOrderTracking(input: { userId: number; trackingCode: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const row = await db.select().from(orders).where(and(eq(orders.userId, input.userId), eq(orders.trackingCode, input.trackingCode.trim().toUpperCase()))).limit(1);
  const order = row[0];
  if (!order) throw new Error("Purchase ID was not found in your account");
  const events = await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, order.id)).orderBy(asc(orderStatusEvents.createdAt));
  const tickets = await db.select().from(orderSupportTickets).where(and(eq(orderSupportTickets.orderId, order.id), eq(orderSupportTickets.userId, input.userId))).orderBy(desc(orderSupportTickets.createdAt));
  const visibleOrder = { id: order.id, orderNumber: order.orderNumber, trackingCode: order.trackingCode, orderType: order.orderType, status: order.status, productName: order.productName, subtotal: order.subtotal, currency: order.currency, createdAt: order.createdAt, updatedAt: order.updatedAt };
  const fallback = events.length ? events : [{ id: `created-${order.id}`, orderId: order.id, eventType: "order_created", status: order.status, actorType: "system" as const, messageKh: statusMessageKh(order.status), providerReference: null, createdAt: order.createdAt }];
  return { order: visibleOrder, events: fallback, tickets };
}

export async function createOrderSupportTicket(input: { userId: number; trackingCode: string; subject: string; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const row = await db.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.userId, input.userId), eq(orders.trackingCode, input.trackingCode.trim().toUpperCase()))).limit(1);
  const order = row[0];
  if (!order) throw new Error("Purchase ID was not found in your account");
  const id = nanoid(); const ticketNumber = buildTicketNumber();
  await db.insert(orderSupportTickets).values({ id, ticketNumber, orderId: order.id, userId: input.userId, subject: input.subject.trim(), message: input.message.trim(), status: "open" });
  await appendOrderStatusEvent({ orderId: order.id, eventType: "ticket_opened", status: order.status, actorType: "customer", messageKh: `បានបើក ticket ${ticketNumber} សម្រាប់ស្នើជំនួយ។` });
  return { id, ticketNumber, status: "open" as const };
}

export async function getSavedPlayerIds(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ saved: savedPlayerIds, game: gameProducts }).from(savedPlayerIds).innerJoin(gameProducts, eq(savedPlayerIds.gameProductId, gameProducts.id)).where(eq(savedPlayerIds.userId, userId)).orderBy(desc(savedPlayerIds.createdAt));
}

export async function savePlayerId(input: { userId: number; gameProductId: string; playerId: string; zoneId?: string | null; label?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const product = await db.select({ id: gameProducts.id }).from(gameProducts).where(eq(gameProducts.id, input.gameProductId)).limit(1);
  if (!product[0]) throw new Error("Game product not found");
  const id = nanoid(); await db.insert(savedPlayerIds).values({ id, ...input, playerId: input.playerId.trim(), zoneId: input.zoneId?.trim() ?? null, label: input.label?.trim() ?? null });
  return { id };
}

export async function updateSavedPlayerId(input: { id: string; userId: number; gameProductId: string; playerId: string; zoneId?: string | null; label?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(savedPlayerIds).set({ gameProductId: input.gameProductId, playerId: input.playerId.trim(), zoneId: input.zoneId?.trim() ?? null, label: input.label?.trim() ?? null }).where(and(eq(savedPlayerIds.id, input.id), eq(savedPlayerIds.userId, input.userId)));
  return { success: true };
}

export async function deleteSavedPlayerId(input: { id: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(savedPlayerIds).where(and(eq(savedPlayerIds.id, input.id), eq(savedPlayerIds.userId, input.userId)));
  return { success: true };
}

export async function listMarketplace(input: { listingType?: "sale" | "swap" | "wanted"; game?: string; search?: string }) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) return [];
    const rows = await listAppwriteMarketplaceListings("approved");
    const search = input.search?.trim().toLowerCase();
    return rows.map(({ listing }) => listing).filter((listing) => {
      if (input.listingType && listing.listingType !== input.listingType) return false;
      if (input.game && listing.game !== input.game) return false;
      return !search || `${listing.title} ${listing.description}`.toLowerCase().includes(search);
    });
  }
  const conditions = [eq(marketplaceListings.status, "approved")];
  if (input.listingType) conditions.push(eq(marketplaceListings.listingType, input.listingType));
  if (input.game) conditions.push(eq(marketplaceListings.game, input.game));
  const results = await db.select().from(marketplaceListings).where(and(...conditions)).orderBy(desc(marketplaceListings.createdAt));
  const search = input.search?.trim().toLowerCase();
  return search ? results.filter((listing) => `${listing.title} ${listing.description}`.toLowerCase().includes(search)) : results;
}

export async function getMarketplaceFavorites(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ favorite: marketplaceFavorites, listing: marketplaceListings }).from(marketplaceFavorites).innerJoin(marketplaceListings, eq(marketplaceFavorites.listingId, marketplaceListings.id)).where(and(eq(marketplaceFavorites.userId, userId), eq(marketplaceListings.status, "approved"))).orderBy(desc(marketplaceFavorites.createdAt));
}

export async function addMarketplaceFavorite(input: { userId: number; listingId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const listing = await db.select({ id: marketplaceListings.id }).from(marketplaceListings).where(and(eq(marketplaceListings.id, input.listingId), eq(marketplaceListings.status, "approved"))).limit(1);
  if (!listing[0]) throw new Error("Listing is unavailable");
  const existing = await db.select({ id: marketplaceFavorites.id }).from(marketplaceFavorites).where(and(eq(marketplaceFavorites.userId, input.userId), eq(marketplaceFavorites.listingId, input.listingId))).limit(1);
  if (existing[0]) return { id: existing[0].id, saved: true as const };
  const id = nanoid();
  await db.insert(marketplaceFavorites).values({ id, userId: input.userId, listingId: input.listingId });
  return { id, saved: true as const };
}

export async function removeMarketplaceFavorite(input: { userId: number; listingId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(marketplaceFavorites).where(and(eq(marketplaceFavorites.userId, input.userId), eq(marketplaceFavorites.listingId, input.listingId)));
  return { success: true };
}

export async function getMarketplaceEligibility(userId: number) {
  const db = await getDb();
  if (!db) return { id: null, status: "not_started" as const, locationCountry: null, locationAccuracyMeters: null, networkRisk: "unknown" as const, providerDecision: "pending" as const, verificationNote: null };
  const result = await db.select().from(marketplaceVerifications).where(eq(marketplaceVerifications.userId, userId)).orderBy(desc(marketplaceVerifications.createdAt)).limit(1);
  const verification = result[0];
  if (!verification) return { id: null, status: "not_started" as const, locationCountry: null, locationAccuracyMeters: null, networkRisk: "unknown" as const, providerDecision: "pending" as const, verificationNote: null };
  return { id: verification.id, status: verification.status, locationCountry: verification.locationCountry, locationAccuracyMeters: verification.locationAccuracyMeters, networkRisk: verification.networkRisk, providerDecision: verification.providerDecision, verificationNote: verification.verificationNote };
}

export async function recordMarketplaceLocationAttestation(input: { userId: number; locationCountry: string; locationAccuracyMeters: number; networkRisk: "low" | "medium" | "high" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const verification = await db.select({ id: marketplaceVerifications.id, status: marketplaceVerifications.status }).from(marketplaceVerifications).where(eq(marketplaceVerifications.userId, input.userId)).orderBy(desc(marketplaceVerifications.createdAt)).limit(1);
  if (!verification[0]) throw new Error("Start identity verification before confirming location");
  if (verification[0].status === "rejected") throw new Error("A rejected verification cannot be updated with a location attestation");
  await db.update(marketplaceVerifications).set({ locationCountry: input.locationCountry, locationAccuracyMeters: Math.round(input.locationAccuracyMeters), networkRisk: input.networkRisk }).where(eq(marketplaceVerifications.id, verification[0].id));
  return { verificationId: verification[0].id, locationCountry: input.locationCountry, networkRisk: input.networkRisk };
}

export async function beginMarketplaceVerification(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select().from(marketplaceVerifications).where(and(eq(marketplaceVerifications.userId, userId), eq(marketplaceVerifications.status, "pending"))).orderBy(desc(marketplaceVerifications.createdAt)).limit(1);
  if (existing[0]) return existing[0];
  const id = nanoid();
  const values = { id, userId, status: "pending" as const, documentType: "Cambodian national ID", providerDecision: "review" as const, autoApprovalEligible: false, networkRisk: "unknown" as const };
  await db.insert(marketplaceVerifications).values(values);
  return { ...values, createdAt: new Date(), updatedAt: new Date(), providerSessionId: null, locationCountry: null, locationAccuracyMeters: null, verificationNote: null, reviewedByUserId: null, reviewedAt: null };
}

export async function linkMarketplaceVerificationProvider(input: { verificationId: string; userId: number; providerSessionId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(marketplaceVerifications).set({ providerSessionId: input.providerSessionId, status: "pending", providerDecision: "pending" }).where(and(eq(marketplaceVerifications.id, input.verificationId), eq(marketplaceVerifications.userId, input.userId)));
  return { success: true };
}

export async function updateMarketplaceVerificationDecision(input: { providerSessionId: string; status: "approved" | "rejected" | "manual_review"; decision: "pass" | "fail" | "review"; networkRisk?: "low" | "medium" | "high" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(marketplaceVerifications).set({ status: input.status, providerDecision: input.decision, autoApprovalEligible: input.status === "approved" && input.decision === "pass", ...(input.networkRisk ? { networkRisk: input.networkRisk } : {}) }).where(eq(marketplaceVerifications.providerSessionId, input.providerSessionId));
}

export async function addMarketplaceVerificationEvidence(input: { verificationId: string; userId: number; evidenceType: "national_id_front" | "national_id_back" | "selfie_liveness"; storageKey: string; mimeType: string; byteSize: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const verification = await db.select({ id: marketplaceVerifications.id }).from(marketplaceVerifications).where(and(eq(marketplaceVerifications.id, input.verificationId), eq(marketplaceVerifications.userId, input.userId))).limit(1);
  if (!verification[0]) throw new Error("Verification session unavailable");
  const id = nanoid(); await db.insert(marketplaceVerificationEvidence).values({ id, ...input });
  return { id };
}

export async function submitMarketplaceListing(input: { sellerUserId: number; listingType: "sale" | "swap" | "wanted"; game: string; title: string; rankLevel: string; priceUsd?: string | null; description: string; contactMethod: string; telegramUsername?: string | null; screenshots?: string[] }) {
  const db = await getDb();
  if (!hasOnlyOwnedMarketplaceScreenshotKeys(input.screenshots, input.sellerUserId)) throw new Error("Marketplace screenshots must be your own uploaded private references");
  if (!db) {
    if (isAppwriteStoreConfigured()) return createAppwriteMarketplaceListing(input);
    throw new Error("Marketplace submission is temporarily unavailable");
  }
  const verification = await db.select().from(marketplaceVerifications).where(eq(marketplaceVerifications.userId, input.sellerUserId)).orderBy(desc(marketplaceVerifications.createdAt)).limit(1);
  if (verification[0]?.status !== "approved" || verification[0]?.locationCountry !== "KH") throw new Error("Marketplace verification with a Cambodia eligibility result is required before submitting a listing");
  const autoPublish = verification[0].autoApprovalEligible && verification[0].providerDecision === "pass";
  const id = nanoid(); await db.insert(marketplaceListings).values({ id, sellerUserId: input.sellerUserId, listingType: input.listingType, status: autoPublish ? "approved" : "pending", game: input.game.trim(), title: input.title.trim(), rankLevel: input.rankLevel.trim(), priceUsd: input.priceUsd ?? null, description: input.description.trim(), contactMethod: input.contactMethod.trim(), telegramUsername: input.telegramUsername?.trim().replace(/^@/, "") || null, screenshots: input.screenshots ?? [] });
  return { id, status: autoPublish ? "approved" as const : "pending" as const };
}

export async function initiateMarketplaceContact(input: { listingId: string; initiatorUserId: number; message: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const listing = await db.select().from(marketplaceListings).where(and(eq(marketplaceListings.id, input.listingId), eq(marketplaceListings.status, "approved"))).limit(1);
  if (!listing[0]) throw new Error("This listing is unavailable");
  if (listing[0].sellerUserId === input.initiatorUserId) throw new Error("You cannot contact your own listing");
  const id = nanoid(); await db.insert(marketplaceContacts).values({ id, listingId: input.listingId, initiatorUserId: input.initiatorUserId, message: input.message.trim() });
  return { id, status: "requested" as const };
}

export async function markMarketplaceListingSold(input: { listingId: string; sellerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const listing = await db.select().from(marketplaceListings).where(and(eq(marketplaceListings.id, input.listingId), eq(marketplaceListings.sellerUserId, input.sellerUserId))).limit(1);
  if (!listing[0] || !["approved", "pending"].includes(listing[0].status)) throw new Error("Listing cannot be marked sold");
  const soldAt = new Date(); const cleanupAt = new Date(soldAt.getTime() + 5 * 60 * 60 * 1000);
  await db.update(marketplaceListings).set({ status: "sold", soldAt, cleanupAt }).where(eq(marketplaceListings.id, input.listingId));
  return { status: "sold" as const, cleanupAt };
}

export async function getSellerMarketplaceListings(sellerUserId: number) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) return [];
    const rows = await listAppwriteMarketplaceListings();
    return rows.map(({ listing }) => listing).filter((listing) => listing.sellerUserId === sellerUserId);
  }
  return db.select().from(marketplaceListings).where(eq(marketplaceListings.sellerUserId, sellerUserId)).orderBy(desc(marketplaceListings.createdAt));
}

export async function cleanupExpiredSoldMarketplaceListings(now = new Date()) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(marketplaceListings).where(and(eq(marketplaceListings.status, "sold"), lt(marketplaceListings.cleanupAt, now)));
  return { success: true };
}

export async function createMarketplaceFraudReport(input: { listingId: string; reporterUserId: number; details: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const listing = await db.select({ id: marketplaceListings.id }).from(marketplaceListings).where(eq(marketplaceListings.id, input.listingId)).limit(1);
  if (!listing[0]) throw new Error("Listing not found");
  const id = nanoid(); await db.insert(marketplaceFraudReports).values({ id, listingId: input.listingId, reporterUserId: input.reporterUserId, details: input.details.trim() });
  return { id, status: "received" as const };
}

export async function getPublicSiteContent() {
  const db = await getDb();
  if (!db) return [];
  return (await db.select().from(siteContent).where(eq(siteContent.isActive, true)).orderBy(desc(siteContent.updatedAt))).filter((content) => content.contentKey !== paymentControlContentKey);
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { orders: 0, pendingOrders: 0, paidOrders: 0, revenue: "0.00", pendingListings: 0, totalUsers: 0 };
  const [allOrders, listings, allUsers] = await Promise.all([db.select().from(orders), db.select().from(marketplaceListings), db.select({ count: sql<number>`count(*)` }).from(users)]);
  const paidOrders = allOrders.filter((order) => ["paid", "delivered"].includes(order.status));
  const now = new Date(); const salesTrend = Array.from({ length: 7 }, (_, index) => { const date = new Date(now); date.setDate(now.getDate() - (6 - index)); const dayKey = date.toISOString().slice(0, 10); return { day: dayKey, revenue: paidOrders.filter((order) => order.createdAt.toISOString().slice(0, 10) === dayKey).reduce((sum, order) => sum + Number(order.subtotal), 0).toFixed(2), orders: paidOrders.filter((order) => order.createdAt.toISOString().slice(0, 10) === dayKey).length }; });
  return { orders: allOrders.length, pendingOrders: allOrders.filter((order) => ["pending", "awaiting_payment"].includes(order.status)).length, paidOrders: paidOrders.length, revenue: paidOrders.reduce((sum, order) => sum + Number(order.subtotal), 0).toFixed(2), pendingListings: listings.filter((listing) => listing.status === "pending").length, totalUsers: Number(allUsers[0]?.count ?? 0), salesTrend };
}

export async function getAdminOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ order: orders, user: { id: users.id, name: users.name, email: users.email } }).from(orders).leftJoin(users, eq(orders.userId, users.id)).orderBy(desc(orders.createdAt));
}

export async function updateOrderStatus(input: { orderId: string; status: OrderStatus; actorUserId?: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const current = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  const order = current[0];
  if (!order) throw new Error("Order not found");
  if (input.status === "paid" && order.orderType === "smm" && order.status !== "paid") {
    const details = (order.details && typeof order.details === "object" ? order.details : {}) as Record<string, unknown>;
    const providerSource = typeof details.providerSource === "string" ? details.providerSource : "";
    const providerServiceId = /^smmglob:(\d+)(?::|$)/.exec(providerSource)?.[1];
    const target = typeof details.target === "string" ? details.target : "";
    const quantity = typeof details.quantity === "number" ? details.quantity : Number(details.quantity);
    if (providerServiceId && !details.providerOrderId) {
      const result = await submitSmmProviderOrder({ providerServiceId, target, quantity });
      if (result.status !== "submitted") throw new Error("SMM provider fulfillment could not be started. Please retry after the provider is available.");
      await db.update(orders).set({ details: { ...details, providerOrderId: result.providerOrderId, providerFulfillment: "submitted" } }).where(eq(orders.id, input.orderId));
      await appendOrderStatusEvent({ orderId: input.orderId, eventType: "provider_submitted", status: "paid", actorType: "provider", providerReference: result.providerOrderId, messageKh: "សំណើ SMM ត្រូវបានបញ្ជូនទៅកាន់ provider រួចរាល់។" });
    }
  }
  await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.orderId));
  if (input.status === "refunded") await db.update(paymentTransactions).set({ status: "refunded" }).where(eq(paymentTransactions.orderId, input.orderId));
  if (order.status !== input.status) await appendOrderStatusEvent({ orderId: input.orderId, eventType: "status_changed", status: input.status, actorType: input.actorUserId ? "admin" : "system", messageKh: statusMessageKh(input.status) });
  return { success: true };
}

export async function getAdminOrderSupportTickets() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ ticket: orderSupportTickets, order: { orderNumber: orders.orderNumber, trackingCode: orders.trackingCode, productName: orders.productName, status: orders.status }, customer: { id: users.id, displayName: users.displayName, email: users.email } }).from(orderSupportTickets).innerJoin(orders, eq(orderSupportTickets.orderId, orders.id)).leftJoin(users, eq(orderSupportTickets.userId, users.id)).orderBy(desc(orderSupportTickets.updatedAt));
}

export async function reviewOrderSupportTicket(input: { ticketId: string; reviewerUserId: number; status: TicketStatus; adminReply?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const row = await db.select().from(orderSupportTickets).where(eq(orderSupportTickets.id, input.ticketId)).limit(1);
  const ticket = row[0];
  if (!ticket) throw new Error("Ticket not found");
  await db.update(orderSupportTickets).set({ status: input.status, adminReply: input.adminReply?.trim() || null, reviewedByUserId: input.reviewerUserId, reviewedAt: new Date() }).where(eq(orderSupportTickets.id, ticket.id));
  const statusRow = await db.select({ status: orders.status }).from(orders).where(eq(orders.id, ticket.orderId)).limit(1);
  const resolved = input.status === "resolved" || input.status === "closed";
  await appendOrderStatusEvent({ orderId: ticket.orderId, eventType: "ticket_reviewed", status: statusRow[0]?.status ?? "pending", actorType: "admin", messageKh: resolved ? `Ticket ${ticket.ticketNumber} ត្រូវបានឆ្លើយតប និងបិទរួចរាល់។` : `Ticket ${ticket.ticketNumber} កំពុងត្រូវបានក្រុមគាំទ្រពិនិត្យ។` });
  return { success: true };
}

export async function getAdminMarketplaceListings(status?: "draft" | "pending" | "approved" | "rejected" | "closed" | "sold") {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? listAppwriteMarketplaceListings(status) : [];
  const query = db.select({ listing: marketplaceListings, seller: { id: users.id, name: users.name, email: users.email } }).from(marketplaceListings).leftJoin(users, eq(marketplaceListings.sellerUserId, users.id));
  return status ? query.where(eq(marketplaceListings.status, status)).orderBy(desc(marketplaceListings.createdAt)) : query.orderBy(desc(marketplaceListings.createdAt));
}

export async function reviewMarketplaceListing(input: { listingId: string; status: "approved" | "rejected" | "closed"; reviewNote?: string | null; reviewerUserId: number }) {
  const db = await getDb();
  if (!db) {
    if (isAppwriteStoreConfigured()) return updateAppwriteMarketplaceListing(input);
    throw new Error("Marketplace administration is temporarily unavailable");
  }
  await db.update(marketplaceListings).set({ status: input.status, reviewNote: input.reviewNote?.trim() ?? null, reviewedByUserId: input.reviewerUserId, reviewedAt: new Date() }).where(eq(marketplaceListings.id, input.listingId));
  return { success: true };
}

export async function deleteMarketplaceListingByAdmin(input: { listingId: string }) {
  const db = await getDb();
  if (!db) {
    if (isAppwriteStoreConfigured()) return deleteAppwriteMarketplaceListing(input.listingId);
    throw new Error("Marketplace administration is temporarily unavailable");
  }
  await db.delete(marketplaceListings).where(eq(marketplaceListings.id, input.listingId));
  return { success: true };
}

export async function getAdminMarketplaceFraudReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ report: marketplaceFraudReports, listing: { id: marketplaceListings.id, title: marketplaceListings.title, game: marketplaceListings.game }, reporter: { id: users.id, displayName: users.displayName, email: users.email } }).from(marketplaceFraudReports).leftJoin(marketplaceListings, eq(marketplaceFraudReports.listingId, marketplaceListings.id)).leftJoin(users, eq(marketplaceFraudReports.reporterUserId, users.id)).orderBy(desc(marketplaceFraudReports.createdAt));
}

export async function updateMarketplaceFraudReport(input: { reportId: string; status: FraudReportStatus; adminNote?: string | null; reviewerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(marketplaceFraudReports).set({ status: input.status, adminNote: input.adminNote?.trim() ?? null, reviewedByUserId: input.reviewerUserId }).where(eq(marketplaceFraudReports.id, input.reportId));
  return { success: true };
}

export async function getAdminMarketplaceDisclosureRequests() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ request: marketplaceDisclosureRequests, report: { id: marketplaceFraudReports.id, status: marketplaceFraudReports.status }, listing: { id: marketplaceListings.id, title: marketplaceListings.title } }).from(marketplaceDisclosureRequests).leftJoin(marketplaceFraudReports, eq(marketplaceDisclosureRequests.fraudReportId, marketplaceFraudReports.id)).leftJoin(marketplaceListings, eq(marketplaceFraudReports.listingId, marketplaceListings.id)).orderBy(desc(marketplaceDisclosureRequests.createdAt));
}

export async function createMarketplaceDisclosureRequest(input: { fraudReportId: string; requestBasis: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const report = await db.select({ id: marketplaceFraudReports.id }).from(marketplaceFraudReports).where(eq(marketplaceFraudReports.id, input.fraudReportId)).limit(1);
  if (!report[0]) throw new Error("Fraud report not found");
  const id = nanoid();
  await db.insert(marketplaceDisclosureRequests).values({ id, fraudReportId: input.fraudReportId, requestBasis: input.requestBasis.trim() });
  return { id };
}

export async function reviewMarketplaceDisclosureRequest(input: { requestId: string; status: DisclosureRequestStatus; reviewNote?: string | null; reviewerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(marketplaceDisclosureRequests).set({ status: input.status, reviewNote: input.reviewNote?.trim() ?? null, reviewedByUserId: input.reviewerUserId }).where(eq(marketplaceDisclosureRequests.id, input.requestId));
  return { success: true };
}

export async function getAdminMarketplaceVerifications(status?: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ verification: marketplaceVerifications, user: { id: users.id, displayName: users.displayName, name: users.name, email: users.email } }).from(marketplaceVerifications).leftJoin(users, eq(marketplaceVerifications.userId, users.id));
  return status ? query.where(eq(marketplaceVerifications.status, status)).orderBy(desc(marketplaceVerifications.createdAt)) : query.orderBy(desc(marketplaceVerifications.createdAt));
}

export async function getAdminVerificationEvidence(verificationId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: marketplaceVerificationEvidence.id, evidenceType: marketplaceVerificationEvidence.evidenceType, mimeType: marketplaceVerificationEvidence.mimeType, byteSize: marketplaceVerificationEvidence.byteSize, createdAt: marketplaceVerificationEvidence.createdAt }).from(marketplaceVerificationEvidence).where(eq(marketplaceVerificationEvidence.verificationId, verificationId)).orderBy(desc(marketplaceVerificationEvidence.createdAt));
}

export async function getAdminMarketplaceEvidenceAccessLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ log: marketplaceEvidenceAccessLogs, evidence: { id: marketplaceVerificationEvidence.id, verificationId: marketplaceVerificationEvidence.verificationId, evidenceType: marketplaceVerificationEvidence.evidenceType }, admin: { id: users.id, displayName: users.displayName, name: users.name, email: users.email } }).from(marketplaceEvidenceAccessLogs).leftJoin(marketplaceVerificationEvidence, eq(marketplaceEvidenceAccessLogs.evidenceId, marketplaceVerificationEvidence.id)).leftJoin(users, eq(marketplaceEvidenceAccessLogs.adminUserId, users.id)).orderBy(desc(marketplaceEvidenceAccessLogs.createdAt));
}

export async function logMarketplaceEvidenceAccess(input: { evidenceId: string; adminUserId: number; action: "view" | "case_review"; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const evidence = await db.select({ id: marketplaceVerificationEvidence.id, storageKey: marketplaceVerificationEvidence.storageKey }).from(marketplaceVerificationEvidence).where(eq(marketplaceVerificationEvidence.id, input.evidenceId)).limit(1);
  if (!evidence[0]) throw new Error("Evidence not found");
  await db.insert(marketplaceEvidenceAccessLogs).values({ id: nanoid(), evidenceId: input.evidenceId, adminUserId: input.adminUserId, action: input.action, reason: input.reason.trim() });
  return evidence[0];
}

export async function removeMarketplaceEvidenceReference(input: { evidenceId: string; adminUserId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const evidence = await db.select({ id: marketplaceVerificationEvidence.id, evidenceType: marketplaceVerificationEvidence.evidenceType, verificationId: marketplaceVerificationEvidence.verificationId }).from(marketplaceVerificationEvidence).where(eq(marketplaceVerificationEvidence.id, input.evidenceId)).limit(1);
  if (!evidence[0]) throw new Error("Evidence not found");
  await db.insert(marketplaceEvidenceAccessLogs).values({ id: nanoid(), evidenceId: evidence[0].id, adminUserId: input.adminUserId, action: "case_review", reason: buildEvidenceRetentionAuditReason(evidence[0].evidenceType, evidence[0].verificationId, input.reason) });
  await db.delete(marketplaceVerificationEvidence).where(eq(marketplaceVerificationEvidence.id, evidence[0].id));
  return { success: true };
}

export async function reviewMarketplaceVerification(input: { verificationId: string; status: "approved" | "rejected"; verificationNote?: string | null; reviewerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const record = await db.select().from(marketplaceVerifications).where(eq(marketplaceVerifications.id, input.verificationId)).limit(1);
  if (!record[0]) throw new Error("Verification not found");
  if (input.status === "approved" && !canApproveMarketplaceVerification(record[0].locationCountry)) throw new Error("Only Cambodia-eligible verification records can be approved");
  await db.update(marketplaceVerifications).set({ status: input.status, verificationNote: input.verificationNote?.trim() ?? null, reviewedByUserId: input.reviewerUserId, reviewedAt: new Date() }).where(eq(marketplaceVerifications.id, input.verificationId));
  return { success: true };
}

function salePriceFromMargin(basePriceUsd: string, profitMarginPercent: string) {
  return (Number(basePriceUsd) * (1 + Number(profitMarginPercent) / 100)).toFixed(2);
}

export async function updateGamePackage(input: { packageId: string; basePriceUsd: string; profitMarginPercent: string; isActive: boolean; featured: boolean }) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Provider catalog storage is unavailable");
    return updateAppwriteProviderOffer({ kind: "game", offerId: input.packageId, basePriceUsd: input.basePriceUsd, profitMarginPercent: input.profitMarginPercent, isActive: input.isActive, featured: input.featured });
  }
  const existing = await db.select({ providerAuthorized: gamePackages.providerAuthorized }).from(gamePackages).where(eq(gamePackages.id, input.packageId)).limit(1);
  if (!existing[0]?.providerAuthorized) throw new Error("Only provider-authorized offers can be activated or repriced.");
  await db.update(gamePackages).set({ basePriceUsd: input.basePriceUsd, profitMarginPercent: input.profitMarginPercent, priceUsd: salePriceFromMargin(input.basePriceUsd, input.profitMarginPercent), isActive: input.isActive, featured: input.featured }).where(eq(gamePackages.id, input.packageId));
  return { success: true };
}

export async function updateSmmTier(input: { tierId: string; basePriceUsd: string; profitMarginPercent: string; isActive: boolean }) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Provider catalog storage is unavailable");
    return updateAppwriteProviderOffer({ kind: "smm", offerId: input.tierId, basePriceUsd: input.basePriceUsd, profitMarginPercent: input.profitMarginPercent, isActive: input.isActive });
  }
  const existing = await db.select({ providerAuthorized: smmTiers.providerAuthorized }).from(smmTiers).where(eq(smmTiers.id, input.tierId)).limit(1);
  if (!existing[0]?.providerAuthorized) throw new Error("Only provider-authorized offers can be activated or repriced.");
  await db.update(smmTiers).set({ basePriceUsd: input.basePriceUsd, profitMarginPercent: input.profitMarginPercent, priceUsd: salePriceFromMargin(input.basePriceUsd, input.profitMarginPercent), isActive: input.isActive }).where(eq(smmTiers.id, input.tierId));
  return { success: true };
}

export async function deleteGamePackage(packageId: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(gamePackages).where(eq(gamePackages.id, packageId)); return { success: true }; }
export async function deleteSmmTier(tierId: string) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.delete(smmTiers).where(eq(smmTiers.id, tierId)); return { success: true }; }

export async function getPaymentTransactions() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ payment: paymentTransactions, order: orders }).from(paymentTransactions).leftJoin(orders, eq(paymentTransactions.orderId, orders.id)).orderBy(desc(paymentTransactions.createdAt));
}

export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? listAppwriteUsers() : [];
  return db.select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt)).limit(100);
}

export async function setAdminUserRole(input: { actorUserId: number; targetUserId: number; nextRole: "user" | "admin"; confirmationEmail: string; reason: string }) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Role management is unavailable until the administrator storage is connected.");
    return setAppwriteUserRole(input);
  }
  const target = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
  if (!target[0]) throw new Error("The target account was not found.");
  validateAdminRoleChange({ targetEmail: target[0].email, previousRole: target[0].role, nextRole: input.nextRole, confirmationEmail: input.confirmationEmail, reason: input.reason });
  await db.update(users).set({ role: input.nextRole }).where(eq(users.id, input.targetUserId));
  await db.insert(adminRoleAudits).values({ id: nanoid(), actorUserId: input.actorUserId, targetUserId: input.targetUserId, previousRole: target[0].role, nextRole: input.nextRole, reason: input.reason.trim() });
  return { success: true };
}

export async function getAdminRoleAudits() {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteAdminRoleAudits() : [];
  const rows = await db.select({ audit: adminRoleAudits, actor: users }).from(adminRoleAudits).leftJoin(users, eq(adminRoleAudits.actorUserId, users.id)).orderBy(desc(adminRoleAudits.createdAt)).limit(100);
  return rows;
}

export async function getSiteContent() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteContent).orderBy(asc(siteContent.contentKey));
}

const paymentControlContentKey = "system-payment-control";

export async function getPaymentControl() {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwritePaymentControl() : { enabled: false, updatedByUserId: null, updatedAt: new Date(0) };
  const record = await db.select().from(siteContent).where(eq(siteContent.contentKey, paymentControlContentKey)).limit(1);
  return { enabled: record[0]?.isActive === true, updatedByUserId: record[0]?.updatedByUserId ?? null, updatedAt: record[0]?.updatedAt ?? new Date(0) };
}

export async function setPaymentControl(input: { enabled: boolean; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Payment-control storage is unavailable.");
    return setAppwritePaymentControl(input);
  }
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, paymentControlContentKey)).limit(1);
  const values = { titleKh: "Payment Control", bodyKh: "System-only payment master switch", mediaUrl: null, isActive: input.enabled, updatedByUserId: input.updatedByUserId };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey: paymentControlContentKey, ...values });
  return getPaymentControl();
}

export async function getPublicPaymentAvailability() {
  const control = await getPaymentControl();
  return await getPublicPaymentReadiness(control.enabled);
}

async function requirePublicPaymentEnabled() {
  const readiness = await getPublicPaymentAvailability();
  if (!readiness.ready) throw new Error(readiness.reason === "payment_switch_off" ? "Payments are temporarily turned off by the store administrator." : "Automatic Cambodian payment is not available yet. Purchases are temporarily disabled.");
  return readiness;
}

export async function saveSiteContent(input: { contentKey: string; titleKh?: string | null; bodyKh?: string | null; mediaUrl?: string | null; isActive: boolean; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, input.contentKey)).limit(1);
  const values = { titleKh: input.titleKh?.trim() || null, bodyKh: input.bodyKh?.trim() || null, mediaUrl: input.mediaUrl?.trim() || null, isActive: input.isActive, updatedByUserId: input.updatedByUserId };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey: input.contentKey.trim(), ...values });
  return { success: true };
}

function isSafeArtworkMediaUrl(mediaUrl: string) {
  if (mediaUrl.startsWith("/manus-storage/")) return true;
  try { return new URL(mediaUrl).protocol === "https:"; } catch { return false; }
}

function artworkStorageKey(mediaUrl: string) {
  return mediaUrl.startsWith("/manus-storage/") ? mediaUrl.slice("/manus-storage/".length) : null;
}

export async function getProviderPackageArtworkOverrides(gameId?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = gameId
    ? await db.select().from(providerPackageArtworkOverrides).where(eq(providerPackageArtworkOverrides.gameId, gameId.trim())).orderBy(desc(providerPackageArtworkOverrides.updatedAt))
    : await db.select().from(providerPackageArtworkOverrides).orderBy(desc(providerPackageArtworkOverrides.updatedAt));
  return rows.map((row) => ({ gameId: row.gameId, offerId: row.offerId, mediaUrl: row.mediaUrl, updatedAt: row.updatedAt, updatedByUserId: row.updatedByUserId }));
}

export async function saveProviderPackageArtworkOverride(input: { gameId: string; offerId: string; mediaUrl: string; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Artwork override storage is unavailable");
  const gameId = input.gameId.trim();
  const offerId = input.offerId.trim();
  const mediaUrl = input.mediaUrl.trim();
  if (!isSafeArtworkMediaUrl(mediaUrl)) throw new Error("Artwork URL must use managed storage or HTTPS");
  const current = await db.select().from(providerPackageArtworkOverrides).where(and(eq(providerPackageArtworkOverrides.gameId, gameId), eq(providerPackageArtworkOverrides.offerId, offerId))).limit(1);
  const values = { mediaUrl, storageKey: artworkStorageKey(mediaUrl), updatedByUserId: input.updatedByUserId };
  if (current[0]) await db.update(providerPackageArtworkOverrides).set(values).where(eq(providerPackageArtworkOverrides.id, current[0].id));
  else await db.insert(providerPackageArtworkOverrides).values({ id: nanoid(), gameId, offerId, ...values });
  await db.insert(providerPackageArtworkAudits).values({ id: nanoid(), gameId, offerId, action: "set", previousMediaUrl: current[0]?.mediaUrl ?? null, nextMediaUrl: mediaUrl, actorUserId: input.updatedByUserId });
  return { success: true };
}

export async function resetProviderPackageArtworkOverride(input: { gameId: string; offerId: string; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Artwork override storage is unavailable");
  const gameId = input.gameId.trim();
  const offerId = input.offerId.trim();
  const current = await db.select().from(providerPackageArtworkOverrides).where(and(eq(providerPackageArtworkOverrides.gameId, gameId), eq(providerPackageArtworkOverrides.offerId, offerId))).limit(1);
  if (!current[0]) return { success: true, reset: false };
  await db.delete(providerPackageArtworkOverrides).where(eq(providerPackageArtworkOverrides.id, current[0].id));
  await db.insert(providerPackageArtworkAudits).values({ id: nanoid(), gameId, offerId, action: "reset", previousMediaUrl: current[0].mediaUrl, nextMediaUrl: null, actorUserId: input.updatedByUserId });
  return { success: true, reset: true };
}

export async function getProviderPackageArtworkAudits(gameId?: string) {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(providerPackageArtworkAudits).orderBy(desc(providerPackageArtworkAudits.createdAt)).limit(100);
  const rows = gameId ? await query.where(eq(providerPackageArtworkAudits.gameId, gameId.trim())) : await query;
  return rows.map((row) => ({ gameId: row.gameId, offerId: row.offerId, action: row.action, previousMediaUrl: row.previousMediaUrl, nextMediaUrl: row.nextMediaUrl, actorUserId: row.actorUserId, createdAt: row.createdAt }));
}
