import { and, asc, desc, eq, gt, inArray, like, lt, or, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { notifyPurchase } from "./purchaseNotifier";
import {
    adminRoleAudits, customerWallets, gamePackages, gameProducts, gmailSenderConnections, InsertUser, marketplaceContacts, marketplaceDisclosureRequests, marketplaceEvidenceAccessLogs, marketplaceFavorites, marketplaceFraudReports, marketplaceListings, marketplaceVerificationEvidence, marketplaceVerifications, orders, orderStatusEvents, orderSupportTickets, paymentTransactions, paymentLinkAudits, paymentLinkTokens, providerPackageArtworkAudits, providerPackageArtworkOverrides, providerPackageCategoryAudits, providerPackageCategoryOverrides, savedPlayerIds, siteContent, smmServices, smmTiers, User,
users, walletTopups, welcomeEmailDeliveries,
} from "../drizzle/schema";
import { createAppwriteMarketplaceListing, createAppwriteWalletTopup, deleteAppwriteMarketplaceListing, getAppwriteAdminPermissions, getAppwriteAdminRoleAudits, getAppwriteCustomerOrders, getAppwriteCustomerPaymentHistory, getAppwritePaymentControl, getAppwriteProviderCatalog, getAppwriteUserByEmail, getAppwriteUserByOpenId, getAppwriteWalletSummary, getAppwriteWalletTopup, isAppwriteStoreConfigured, listAppwriteMarketplaceListings, listAppwriteUsers, setAppwriteAdminPermissions, setAppwritePaymentControl, setAppwriteUserRole, syncAppwriteFzrCatalog, syncAppwriteSmmCatalog, updateAppwriteMarketplaceListing, updateAppwriteProviderOffer, updateAppwriteUserDisplayName, updateAppwriteWalletTopup, upsertAppwriteUser } from "./appwriteStore";
import { buildOrderNumber, isSingleAdminEmail } from "./storefrontDomain";
import { validateAdminRoleChange } from "./adminRoles";
import { delegatedAdminPermissionKeys, normalizeDelegatedAdminPermissions, type DelegatedAdminPermission } from "./adminPermissions";
import { buildEvidenceRetentionAuditReason, canApproveMarketplaceVerification, hasOnlyOwnedMarketplaceScreenshotKeys, type DisclosureRequestStatus, type FraudReportStatus } from "./marketplaceSafety";
import { getPublicPaymentReadiness } from "./paymentReadiness";
import { checkBakongKhqrPayment, createBakongKhqrPayment, registerBakongKhqrWorkerWatch } from "./bakongKhqr";
import { getKhqrReconciliationDisposition, getKhqrWalletReconciliationDisposition } from "./khqrReconciliation";
import { assertOrderAmountIntegrity, assertPackagePriceIntegrity, assessOrderVelocity, moneyEquals } from "./paymentSecurity";
import type { FzrProviderSyncSnapshot, SmmProviderCatalogResponse } from "./providerCatalog";
import { submitSmmProviderOrder, submitFzrTopupOrder } from "./providerCatalog";
import { publicPartnerDelivery } from "../shared/partnerDelivery";
import { publicCdkStatus, redactCdkSecret } from "../shared/cdkToken";

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

export type PrimaryProviderAvailability = { hiddenGameIds: string[]; hiddenSmmServiceIds: string[]; activeGameIds?: string[]; updatedAt: Date };
const providerAvailabilityContentKey = "provider-availability:global";

function normalizePrimaryProviderAvailability(value: unknown, updatedAt: Date): PrimaryProviderAvailability | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Partial<PrimaryProviderAvailability>;
  const ids = (input: unknown) => Array.isArray(input) ? Array.from(new Set(input.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 120))) : [];
  return { hiddenGameIds: ids(data.hiddenGameIds), hiddenSmmServiceIds: ids(data.hiddenSmmServiceIds), activeGameIds: Array.isArray(data.activeGameIds) ? ids(data.activeGameIds) : undefined, updatedAt };
}

export async function getPrimaryProviderAvailability(): Promise<PrimaryProviderAvailability | null> {
  const db = await getDb();
  if (!db) return null;
  const record = await db.select({ bodyKh: siteContent.bodyKh, updatedAt: siteContent.updatedAt }).from(siteContent).where(eq(siteContent.contentKey, providerAvailabilityContentKey)).limit(1);
  if (!record[0]?.bodyKh) return null;
  try { return normalizePrimaryProviderAvailability(JSON.parse(record[0].bodyKh), record[0].updatedAt); } catch { return null; }
}

export async function setPrimaryProviderAvailability(input: { kind: "game" | "smm"; providerId: string; isActive: boolean; legacyActiveGameIds?: string[]; updatedByUserId?: number }): Promise<PrimaryProviderAvailability | null> {
  const db = await getDb();
  if (!db) return null;
  const current = await getPrimaryProviderAvailability() ?? { hiddenGameIds: [], hiddenSmmServiceIds: [], activeGameIds: undefined, updatedAt: new Date(0) };
  const source = input.kind === "game" ? current.hiddenGameIds : current.hiddenSmmServiceIds;
  const nextSource = input.isActive ? source.filter((id) => id !== input.providerId) : Array.from(new Set([...source, input.providerId]));
  const currentActiveGames = current.activeGameIds ?? input.legacyActiveGameIds ?? [];
  const next: PrimaryProviderAvailability = input.kind === "game"
    ? { hiddenGameIds: nextSource, hiddenSmmServiceIds: current.hiddenSmmServiceIds, activeGameIds: input.isActive ? Array.from(new Set([...currentActiveGames, input.providerId])) : currentActiveGames.filter((id) => id !== input.providerId), updatedAt: new Date() }
    : { hiddenGameIds: current.hiddenGameIds, hiddenSmmServiceIds: nextSource, activeGameIds: current.activeGameIds, updatedAt: new Date() };
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, providerAvailabilityContentKey)).limit(1);
  const values = { titleKh: "Provider availability policy", bodyKh: JSON.stringify(next), mediaUrl: null, isActive: false, updatedByUserId: input.updatedByUserId ?? null };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey: providerAvailabilityContentKey, ...values });
  return next;
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
    // A sign-in refresh must never demote an Owner-approved delegated Admin.
    // Only the designated owner is force-promoted; all other stored roles are
    // preserved and can be changed exclusively through the owner-only role route.
    if (isSingleAdminEmail(email)) {
      values.role = "admin";
      updateSet.role = "admin";
    }
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

const delegatedAdminPermissionsContentKey = (userId: number) => `admin-permissions:${userId}`;

export async function getDelegatedAdminPermissions(userId: number): Promise<DelegatedAdminPermission[]> {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteAdminPermissions(userId) : [];
  const rows = await db.select({ bodyKh: siteContent.bodyKh }).from(siteContent).where(eq(siteContent.contentKey, delegatedAdminPermissionsContentKey(userId))).limit(1);
  if (!rows[0]?.bodyKh) return [];
  try { return normalizeDelegatedAdminPermissions(JSON.parse(rows[0].bodyKh)); } catch { return []; }
}

export async function setDelegatedAdminPermissions(input: { actorUserId: number; targetUserId: number; permissions: DelegatedAdminPermission[] }) {
  const permissions = normalizeDelegatedAdminPermissions(input.permissions);
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Delegated Admin permission storage is unavailable.");
    return setAppwriteAdminPermissions({ userId: input.targetUserId, permissions, updatedByUserId: input.actorUserId });
  }
  const target = await db.select({ role: users.role }).from(users).where(eq(users.id, input.targetUserId)).limit(1);
  if (!target[0] || target[0].role !== "admin") throw new Error("Only an existing delegated Admin can receive Admin permissions.");
  const key = delegatedAdminPermissionsContentKey(input.targetUserId);
  await db.insert(siteContent).values({ id: nanoid(), contentKey: key, titleKh: "Delegated Admin permissions", bodyKh: JSON.stringify(permissions), isActive: false, updatedByUserId: input.actorUserId }).onDuplicateKeyUpdate({ set: { bodyKh: JSON.stringify(permissions), isActive: false, updatedByUserId: input.actorUserId } });
  return { permissions };
}

export function getOwnerAdminPermissions() { return [...delegatedAdminPermissionKeys]; }

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
    await registerBakongKhqrWorkerWatch({ md5: generated.md5, orderId: `wallet:${record.id}`, amount: String(amount), currency: "KHR", expiresAt: generated.expiresAt });
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

export async function getActiveProviderPackageIds(packageIds: string[]): Promise<string[] | null> {
  const normalizedIds = Array.from(new Set(packageIds.map((id) => id.trim()).filter(Boolean)));
  if (!normalizedIds.length) return [];
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select({ id: gamePackages.id }).from(gamePackages).where(and(inArray(gamePackages.id, normalizedIds), eq(gamePackages.isActive, true), eq(gamePackages.providerAuthorized, true)));
  return rows.map((row) => row.id);
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

export async function getAdminSyncedProviderPackages(providerGameIds: string[]) {
  const normalizedGameIds = Array.from(new Set(providerGameIds.map((id) => id.trim()).filter(Boolean)));
  if (!normalizedGameIds.length) return [];
  const db = await getDb();
  if (!db) return null;
  const productIds = normalizedGameIds.map((id) => providerRecordId("fzr-game", id));
  const products = await db.select({ id: gameProducts.id }).from(gameProducts).where(inArray(gameProducts.id, productIds));
  if (!products.length) return [];
  const packages = await db.select({ id: gamePackages.id, amountLabel: gamePackages.amountLabel, priceUsd: gamePackages.priceUsd, providerSource: gamePackages.providerSource, sortOrder: gamePackages.sortOrder }).from(gamePackages).where(and(inArray(gamePackages.productId, products.map((product) => product.id)), eq(gamePackages.providerAuthorized, true))).orderBy(asc(gamePackages.sortOrder));
  return packages.map((item) => ({ id: item.id, label: item.amountLabel, amountLabel: item.amountLabel, priceLabel: `$${Number(item.priceUsd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] }));
}

/** Public fallback for an authorized synced catalog: inactive rows never reach the storefront. */
export async function getPublicSyncedProviderPackages(providerGameIds: string[]) {
  const normalizedGameIds = Array.from(new Set(providerGameIds.map((id) => id.trim()).filter(Boolean)));
  if (!normalizedGameIds.length) return [];
  const db = await getDb();
  if (!db) return null;
  const productIds = normalizedGameIds.map((id) => providerRecordId("fzr-game", id));
  const products = await db.select({ id: gameProducts.id }).from(gameProducts).where(and(inArray(gameProducts.id, productIds), eq(gameProducts.isActive, true)));
  if (!products.length) return [];
  const packages = await db.select({ id: gamePackages.id, amountLabel: gamePackages.amountLabel, priceUsd: gamePackages.priceUsd, providerSource: gamePackages.providerSource, sortOrder: gamePackages.sortOrder }).from(gamePackages).where(and(inArray(gamePackages.productId, products.map((product) => product.id)), eq(gamePackages.isActive, true), eq(gamePackages.providerAuthorized, true))).orderBy(asc(gamePackages.sortOrder));
  return packages.map((item) => ({ id: item.id, label: item.amountLabel, amountLabel: item.amountLabel, priceLabel: `$${Number(item.priceUsd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] }));
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
      await db.insert(gameProducts).values({ id: gameId, slug: `fzr-${createHash("sha256").update(game.providerGameId).digest("hex").slice(0, 32)}`, titleKh: game.name, titleEn: game.name, currencyLabel: "Top-up", iconLabel: "G", accent: "#4f46e5", requiresZone, isActive: true, sortOrder });
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
        await db.insert(gamePackages).values({ id: packageId, productId: gameId, amountLabel: offer.name, providerAuthorized: true, providerSource: source, basePriceUsd: offer.priceUsd, profitMarginPercent: "0.00", priceUsd: offer.priceUsd, featured: false, isActive: true, sortOrder: offerOrder });
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

/** Counts the customer's live pending KHQR payment sessions (unexpired, still awaiting money). Used to cap concurrent pending payments at two. */
export async function countPendingKhqrPayments(userId: number, excludeOrderId?: string) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db.select({ orderId: paymentTransactions.orderId }).from(paymentTransactions).innerJoin(orders, eq(paymentTransactions.orderId, orders.id)).where(and(eq(orders.userId, userId), eq(paymentTransactions.provider, "bakong_khqr"), eq(paymentTransactions.status, "pending"), gt(paymentTransactions.expiresAt, new Date())));
  const unique = new Set(rows.map((row) => row.orderId).filter((orderId) => orderId !== excludeOrderId));
  return unique.size;
}

export const pendingKhqrPaymentLimit = 2;
const pendingPaymentLimitMessageKh = "អ្នកមានការទូទាត់កំពុងរង់ចាំ ២ រួចហើយ។ សូមបញ្ចប់ការទូទាត់ចាស់ ឬរង់ចាំ QR ផុតកំណត់សិន មុននឹងបង្កើតការទូទាត់ថ្មី។";
const orderVelocityMessageKh = "មានការបង្កើតការបញ្ជាទិញច្រើនពេកក្នុងមួយម៉ោង តែមិនមានការទូទាត់បានជោគជ័យ។ សូមបញ្ចប់ការទូទាត់មួយជាមុនសិន ឬសូមទាក់ទង Admin។";

async function assertPendingKhqrPaymentCapacity(userId: number, excludeOrderId?: string) {
  if (await countPendingKhqrPayments(userId, excludeOrderId) >= pendingKhqrPaymentLimit) throw Object.assign(new Error(pendingPaymentLimitMessageKh), { code: "PENDING_PAYMENT_LIMIT" });
}

export async function createTopupOrder(input: { userId: number; packageId: string; playerId: string; zoneId?: string | null; quantity: number }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  // No more than two concurrent pending KHQR payments per account. Checked at
  // order creation so a customer cannot stack unpaid QR sessions.
  await assertPendingKhqrPaymentCapacity(input.userId);
  const result = await db.select({ game: gameProducts, package: gamePackages }).from(gamePackages).innerJoin(gameProducts, eq(gamePackages.productId, gameProducts.id)).where(and(eq(gamePackages.id, input.packageId), eq(gamePackages.isActive, true), eq(gameProducts.isActive, true))).limit(1);
  const item = result[0];
  if (!item) throw new Error("Selected game package is unavailable");
  if (item.game.requiresZone && !input.zoneId?.trim()) throw new Error("Server or zone ID is required for this game");
  // Anti-tamper. The storefront never sends a price, but the catalog row is
  // still untrusted input: it can be edited directly, left stale by a failed
  // provider sync, or zeroed by a half-applied margin change. Recompute the
  // sale price from provider cost + margin and refuse anything that would sell
  // below cost, at zero, or outside the accepted band.
  const priceCheck = assertPackagePriceIntegrity({
    priceUsd: item.package.priceUsd,
    basePriceUsd: (item.package as { basePriceUsd?: string | null }).basePriceUsd ?? null,
    profitMarginPercent: (item.package as { profitMarginPercent?: string | null }).profitMarginPercent ?? null,
    quantity: input.quantity,
  });
  // Behavioural anti-cheat: an account stacking unpaid orders with nothing ever
  // settled is farming sessions, not shopping.
  const recentOrders = await db.select({ createdAt: orders.createdAt, status: orders.status }).from(orders).where(and(eq(orders.userId, input.userId), gt(orders.createdAt, new Date(Date.now() - 60 * 60 * 1000))));
  if (assessOrderVelocity(recentOrders).blocked) throw Object.assign(new Error(orderVelocityMessageKh), { code: "ORDER_VELOCITY_BLOCKED" });
  const subtotal = priceCheck.subtotal;
  const id = nanoid(); const orderNumber = buildOrderNumber(); const trackingCode = buildTrackingCode();
  await db.insert(orders).values({ id, orderNumber, trackingCode, userId: input.userId, orderType: "topup", status: "pending", subtotal, productName: `${item.game.titleEn} • ${item.package.amountLabel} ${item.game.currencyLabel}`, details: { packageId: item.package.id, gameProductId: item.game.id, playerId: input.playerId.trim(), zoneId: input.zoneId?.trim() ?? null, quantity: input.quantity } });
  await appendOrderStatusEvent({ orderId: id, eventType: "order_created", status: "pending", actorType: "customer", messageKh: statusMessageKh("pending") });
  return { id, orderNumber, trackingCode, amount: subtotal, status: "pending" as const };
}

const adminKhqrTestProduct = {
  code: "admin-khqr-test-002",
  name: "Admin KHQR Test Product",
  amountUsd: "0.02",
} as const;

/** Creates a ledger-only test purchase. It is callable exclusively through ownerProcedure and is never sent to a top-up provider. */
export async function createAdminKhqrTestOrder(input: { userId: number }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const id = nanoid();
  const orderNumber = buildOrderNumber();
  const trackingCode = buildTrackingCode();
  await db.insert(orders).values({
    id,
    orderNumber,
    trackingCode,
    userId: input.userId,
    orderType: "topup",
    status: "pending",
    currency: "USD",
    subtotal: adminKhqrTestProduct.amountUsd,
    productName: adminKhqrTestProduct.name,
    details: {
      testPurchase: true,
      testProductCode: adminKhqrTestProduct.code,
      providerFulfillment: "not_applicable",
      noProviderFulfillment: true,
    },
  });
  await appendOrderStatusEvent({ orderId: id, eventType: "admin_test_order_created", status: "pending", actorType: "admin", messageKh: "បានបង្កើត Admin KHQR Test Product សម្រាប់សាកល្បងការទូទាត់។" });
  return { id, orderNumber, trackingCode, amount: adminKhqrTestProduct.amountUsd, status: "pending" as const, productName: adminKhqrTestProduct.name };
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
  return customerOrders.map((order) => ({ ...order, details: redactCdkSecret(order.details), events: events.filter((event) => event.orderId === order.id), delivery: publicPartnerDelivery(order.details, order.status), cdk: publicCdkStatus(order.details, order.status) }));
}

export async function getCustomerPaymentHistory(userId: number) {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwriteCustomerPaymentHistory(userId) : [];
  return db.select({ id: paymentTransactions.id, orderId: paymentTransactions.orderId, provider: paymentTransactions.provider, status: paymentTransactions.status, amount: paymentTransactions.amount, currency: paymentTransactions.currency, createdAt: paymentTransactions.createdAt, updatedAt: paymentTransactions.updatedAt, paidAt: paymentTransactions.paidAt, orderNumber: orders.orderNumber, productName: orders.productName, orderStatus: orders.status }).from(paymentTransactions).innerJoin(orders, eq(paymentTransactions.orderId, orders.id)).where(eq(orders.userId, userId)).orderBy(desc(paymentTransactions.createdAt));
}

export const securePaymentLinkTtlMs = 15 * 60 * 1000;
const paymentLinkHash = (value: string) => createHash("sha256").update(value).digest("hex");

async function appendPaymentLinkAudit(input: { paymentLinkId: string; orderId: string; tokenPrefix: string; event: "issued" | "bound" | "qr_issued" | "paid" | "cancelled" | "expired" | "blocked" | "gate_closed"; ipHash?: string | null; detail?: string | null }) {
  const database = await getDb();
  if (!database) return;
  await database.insert(paymentLinkAudits).values({ id: nanoid(), paymentLinkId: input.paymentLinkId, orderId: input.orderId, tokenPrefix: input.tokenPrefix, event: input.event, ipHash: input.ipHash ?? null, detail: input.detail ?? null });
}

export function createPaymentLinkProof(value: string) { return paymentLinkHash(value); }

export async function issueSecurePaymentLink(input: { orderId: string; userId: number; ipHash?: string | null }) {
  const readiness = await getPublicPaymentAvailability();
  if (!readiness.ready) {
    const gate = await getPaymentControl();
    if (!gate.enabled) throw Object.assign(new Error("PAYMENTS_CLOSED"), { code: "PAYMENTS_CLOSED" });
    throw Object.assign(new Error("PAYMENT_UNAVAILABLE"), { code: "PAYMENT_UNAVAILABLE" });
  }
  const database = await getDb();
  if (!database) throw new Error("Payment-link storage is unavailable.");
  const order = await database.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0] || !["pending", "awaiting_payment"].includes(order[0].status)) throw new Error("Order is not eligible for payment.");
  const active = await database.select().from(paymentLinkTokens).where(and(eq(paymentLinkTokens.orderId, input.orderId), inArray(paymentLinkTokens.status, ["issued", "bound", "qr_issued"]), gt(paymentLinkTokens.expiresAt, new Date()))).orderBy(desc(paymentLinkTokens.createdAt)).limit(1);
  if (active[0]) return { token: null, tokenPrefix: active[0].tokenPrefix, expiresAt: active[0].expiresAt, reuseExisting: true };
  const token = randomBytes(24).toString("base64url");
  const record = { id: nanoid(), orderId: input.orderId, userId: input.userId, tokenHash: paymentLinkHash(token), tokenPrefix: token.slice(0, 8), status: "issued" as const, expiresAt: new Date(Date.now() + securePaymentLinkTtlMs) };
  await database.insert(paymentLinkTokens).values(record);
  await appendPaymentLinkAudit({ paymentLinkId: record.id, orderId: record.orderId, tokenPrefix: record.tokenPrefix, event: "issued", ipHash: input.ipHash });
  return { token, tokenPrefix: record.tokenPrefix, expiresAt: record.expiresAt, reuseExisting: false };
}

export async function bindSecurePaymentLink(input: { token: string; userId: number; sessionHash: string; deviceHash: string; ipHash?: string | null }) {
  const database = await getDb();
  if (!database) throw new Error("Payment-link storage is unavailable.");
  const row = await database.select().from(paymentLinkTokens).where(eq(paymentLinkTokens.tokenHash, paymentLinkHash(input.token))).limit(1);
  const link = row[0];
  if (!link || link.userId !== input.userId) return { state: "used" as const };
  if (link.expiresAt.getTime() <= Date.now()) { if (link.status !== "expired") { await database.update(paymentLinkTokens).set({ status: "expired", consumedAt: new Date() }).where(eq(paymentLinkTokens.id, link.id)); await appendPaymentLinkAudit({ paymentLinkId: link.id, orderId: link.orderId, tokenPrefix: link.tokenPrefix, event: "expired", ipHash: input.ipHash }); } return { state: "expired" as const }; }
  if (["paid", "cancelled", "expired"].includes(link.status)) return { state: "used" as const };
  if (link.boundSessionHash && (link.boundSessionHash !== input.sessionHash || link.boundDeviceHash !== input.deviceHash)) { await appendPaymentLinkAudit({ paymentLinkId: link.id, orderId: link.orderId, tokenPrefix: link.tokenPrefix, event: "blocked", ipHash: input.ipHash, detail: "binding_mismatch" }); return { state: "used" as const }; }
  if (!link.boundSessionHash) { await database.update(paymentLinkTokens).set({ status: "bound", boundSessionHash: input.sessionHash, boundDeviceHash: input.deviceHash }).where(eq(paymentLinkTokens.id, link.id)); await appendPaymentLinkAudit({ paymentLinkId: link.id, orderId: link.orderId, tokenPrefix: link.tokenPrefix, event: "bound", ipHash: input.ipHash }); }
  return { state: "ready" as const, link: { id: link.id, orderId: link.orderId, tokenPrefix: link.tokenPrefix, expiresAt: link.expiresAt, status: link.status } };
}

export async function markSecurePaymentLinkQrIssued(input: { token: string; userId: number; sessionHash: string; deviceHash: string; ipHash?: string | null }) {
  const binding = await bindSecurePaymentLink(input);
  if (binding.state !== "ready") return binding;
  const database = await getDb();
  if (!database || !binding.link) throw new Error("Payment-link storage is unavailable.");
  await database.update(paymentLinkTokens).set({ status: "qr_issued" }).where(eq(paymentLinkTokens.id, binding.link.id));
  await appendPaymentLinkAudit({ paymentLinkId: binding.link.id, orderId: binding.link.orderId, tokenPrefix: binding.link.tokenPrefix, event: "qr_issued", ipHash: input.ipHash });
  return binding;
}

export async function cancelSecurePaymentLink(input: { token: string; userId: number; sessionHash: string; deviceHash: string; ipHash?: string | null }) {
  const binding = await bindSecurePaymentLink(input);
  if (binding.state !== "ready" || !binding.link) return binding;
  const database = await getDb();
  if (!database) throw new Error("Payment-link storage is unavailable.");
  await database.transaction(async (tx) => {
    await tx.update(paymentLinkTokens).set({ status: "cancelled", consumedAt: new Date() }).where(eq(paymentLinkTokens.id, binding.link!.id));
    await tx.update(paymentTransactions).set({ status: "expired" }).where(and(eq(paymentTransactions.orderId, binding.link!.orderId), eq(paymentTransactions.provider, "bakong_khqr"), eq(paymentTransactions.status, "pending")));
    await tx.update(orders).set({ status: "pending" }).where(and(eq(orders.id, binding.link!.orderId), eq(orders.status, "awaiting_payment")));
  });
  await appendPaymentLinkAudit({ paymentLinkId: binding.link.id, orderId: binding.link.orderId, tokenPrefix: binding.link.tokenPrefix, event: "cancelled", ipHash: input.ipHash });
  return { state: "cancelled" as const };
}

export async function settleSecurePaymentLinks(orderId: string, event: "paid" | "expired") {
  const database = await getDb();
  if (!database) return;
  const links = await database.select().from(paymentLinkTokens).where(and(eq(paymentLinkTokens.orderId, orderId), inArray(paymentLinkTokens.status, ["issued", "bound", "qr_issued"])));
  const status = event === "paid" ? "paid" as const : "expired" as const;
  for (const link of links) {
    await database.update(paymentLinkTokens).set({ status, consumedAt: new Date() }).where(eq(paymentLinkTokens.id, link.id));
    await appendPaymentLinkAudit({ paymentLinkId: link.id, orderId, tokenPrefix: link.tokenPrefix, event });
  }
}

export async function beginStagedPayment(input: { orderId: string; userId: number }) {
  await requirePublicPaymentEnabled();
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0]) throw new Error("Order not found");
  if (["paid", "delivered", "failed", "expired", "refunded"].includes(order[0].status)) throw new Error("This order cannot begin a payment session");
  // The same two-pending cap is enforced when the QR session itself is issued.
  // The current order is excluded so refreshing or reusing an existing session keeps working.
  await assertPendingKhqrPaymentCapacity(input.userId, input.orderId);
  const existing = await db.select().from(paymentTransactions).where(and(eq(paymentTransactions.orderId, input.orderId), eq(paymentTransactions.provider, "bakong_khqr"))).orderBy(desc(paymentTransactions.createdAt)).limit(1);
  const existingData = existing[0]?.callbackPayload && typeof existing[0].callbackPayload === "object" ? existing[0].callbackPayload as Record<string, unknown> : null;
  const currency = order[0].currency === "KHR" ? "KHR" : "USD" as const;
  // A cached QR may only be reused while it still encodes what the order is
  // worth RIGHT NOW. If a price or profit margin was edited after the QR was
  // minted, the stored transaction amount no longer matches the order
  // subtotal, so reuse is refused here and a fresh QR is generated at the new
  // price. Without this check a shopper could be shown a stale amount that
  // reconciliation would later refuse to match.
  const amountStillCurrent = existing[0] ? Number(existing[0].amount) === Number(order[0].subtotal) && existing[0].currency === currency : false;
  const canReuse = existing[0] && existing[0].status === "pending" && existing[0].expiresAt && existing[0].expiresAt.getTime() > Date.now() && typeof existingData?.qrImageDataUrl === "string" && typeof existingData.bakongMd5 === "string" && amountStillCurrent;
  // Never mint a QR for an amount the ledger would refuse to reconcile later.
  assertOrderAmountIntegrity({ amount: String(order[0].subtotal), currency });
  const generated = canReuse ? null : await createBakongKhqrPayment({ trackingCode: order[0].trackingCode, amount: String(order[0].subtotal), currency });
  const transaction = existing[0] && canReuse ? existing[0] : { id: nanoid(), orderId: input.orderId, provider: "bakong_khqr", providerRequestId: generated!.md5, status: "pending" as const, amount: order[0].subtotal, currency, checkoutUrl: generated!.deeplink ?? `/checkout/${input.orderId}`, callbackPayload: { bakongMd5: generated!.md5, merchantAccountId: generated!.merchantAccountId, qrImageDataUrl: generated!.qrImageDataUrl, deeplink: generated!.deeplink }, expiresAt: generated!.expiresAt };
  if (!canReuse) {
    await db.insert(paymentTransactions).values(transaction);
    await registerBakongKhqrWorkerWatch({ md5: generated!.md5, orderId: input.orderId, amount: String(order[0].subtotal), currency, expiresAt: generated!.expiresAt });
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
  return { order: { ...order[0], details: redactCdkSecret(order[0].details) }, payment: current ? { id: current.id, provider: current.provider, status: current.status, amount: current.amount, currency: current.currency, checkoutUrl: current.checkoutUrl, expiresAt: current.expiresAt, paidAt: current.paidAt, qrImageDataUrl: typeof payload.qrImageDataUrl === "string" ? payload.qrImageDataUrl : null, deeplink: typeof payload.deeplink === "string" ? payload.deeplink : null } : null };
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
  const payload = current.callbackPayload && typeof current.callbackPayload === "object" ? current.callbackPayload as Record<string, unknown> : {};
  const md5 = typeof payload.bakongMd5 === "string" ? payload.bakongMd5 : current.providerRequestId;
  if (!md5) throw new Error("Bakong payment session is missing its verification reference");
  // Keep the browser refresh path as a safe fallback when the background worker
  // is delayed or unavailable. Reconciliation still verifies the official
  // Bakong response against the stored amount, currency, merchant, and pending
  // ledger row before moving the order to paid.
  const result = await reconcileKhqrWorkerPayment({ md5, orderId: input.orderId, amount: String(current.amount), currency: current.currency as "KHR" | "USD" });
  if (!result.idempotent) await settleSecurePaymentLinks(input.orderId, "paid");
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

export async function recordKhqrWorkerPaymentExpired(input: { md5: string; orderId: string; amount: string | number; currency: "KHR" | "USD" }) {
  const db = await getDb();
  if (!db) throw new Error("Payment expiry status requires the primary ledger database.");
  if (input.orderId.startsWith("wallet:")) {
    const walletId = input.orderId.slice("wallet:".length);
    const rows = await db.select().from(walletTopups).where(eq(walletTopups.id, walletId)).limit(1);
    const wallet = rows[0];
    const payload = wallet?.paymentPayload && typeof wallet.paymentPayload === "object" ? wallet.paymentPayload as Record<string, unknown> : {};
    const storedMd5 = typeof payload.bakongMd5 === "string" ? payload.bakongMd5 : "";
    if (!wallet || wallet.provider !== "bakong_khqr" || storedMd5 !== input.md5 || String(wallet.amountKhr) !== String(input.amount) || input.currency !== "KHR") throw new Error("Expiry callback did not match an eligible wallet session.");
    if (wallet.status === "expired") return { idempotent: true };
    if (wallet.status !== "pending") throw new Error("Expiry callback did not match a pending wallet session.");
    await db.update(walletTopups).set({ status: "expired" }).where(and(eq(walletTopups.id, wallet.id), eq(walletTopups.status, "pending")));
    return { idempotent: false };
  }
  const match = await db.select({ payment: paymentTransactions, order: orders }).from(paymentTransactions).innerJoin(orders, eq(paymentTransactions.orderId, orders.id)).where(and(eq(paymentTransactions.provider, "bakong_khqr"), eq(paymentTransactions.providerRequestId, input.md5), eq(paymentTransactions.orderId, input.orderId))).limit(1);
  const record = match[0];
  if (!record || record.payment.provider !== "bakong_khqr" || record.payment.providerRequestId !== input.md5 || String(record.payment.amount) !== String(input.amount) || record.payment.currency !== input.currency) throw new Error("Expiry callback did not match an eligible checkout payment session.");
  if (record.payment.status === "expired" && record.order.status === "expired") return { idempotent: true };
  if (record.payment.status !== "pending" || record.order.status !== "awaiting_payment") throw new Error("Expiry callback did not match a pending checkout payment session.");
  let transitioned = false;
  await db.transaction(async (tx) => {
    const transition = await tx.update(paymentTransactions).set({ status: "expired" }).where(and(eq(paymentTransactions.id, record.payment.id), eq(paymentTransactions.status, "pending")));
    const affectedRows = Array.isArray(transition) ? Number((transition[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) : 0;
    if (affectedRows <= 0) return;
    transitioned = true;
    await tx.update(orders).set({ status: "expired" }).where(and(eq(orders.id, record.order.id), eq(orders.status, "awaiting_payment")));
    await tx.insert(orderStatusEvents).values({ id: nanoid(), orderId: record.order.id, eventType: "payment_expired", status: "expired", actorType: "system", messageKh: statusMessageKh("expired"), providerReference: input.md5 });
  });
  return { idempotent: !transitioned };
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
    if (!moneyEquals(wallet.amountKhr, input.amount, "KHR")) throw new Error("Confirmed amount did not match the stored wallet session.");
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
  const details = record.order.details && typeof record.order.details === "object" ? record.order.details as Record<string, unknown> : {};
  const isAdminTestPurchase = details.testPurchase === true && details.testProductCode === adminKhqrTestProduct.code && details.noProviderFulfillment === true;
  const completedStatus = isAdminTestPurchase ? "delivered" as const : "paid" as const;
  // Final gate before money is recognised: Bakong's own confirmed amount and
  // currency must match the stored session exactly, in minor units.
  if (!moneyEquals(record.payment.amount, input.amount, record.payment.currency as "KHR" | "USD")) throw new Error("Confirmed amount did not match the stored payment session.");
  // The transition is a compare-and-set inside one transaction: the update only
  // applies while the row is still `pending`, and the order/event rows move with
  // it. Two concurrent deliveries of the same callback therefore cannot both
  // credit the order — the loser sees zero affected rows and reports idempotent.
  let credited = false;
  await db.transaction(async (tx) => {
    const transition = await tx.update(paymentTransactions).set({ status: "paid", providerTransactionId: verification.transactionHash, paidAt: new Date(), callbackPayload: { ...existingPayload, workerVerifiedAt: new Date().toISOString(), workerMd5: input.md5, transactionHash: verification.transactionHash } }).where(and(eq(paymentTransactions.id, record.payment.id), eq(paymentTransactions.status, "pending")));
    const affectedRows = Array.isArray(transition) ? Number((transition[0] as { affectedRows?: number } | undefined)?.affectedRows ?? 0) : 0;
    if (affectedRows <= 0) return;
    credited = true;
    await tx.update(orders).set({ status: completedStatus }).where(and(eq(orders.id, record.order.id), eq(orders.status, "awaiting_payment")));
    await tx.insert(orderStatusEvents).values({ id: nanoid(), orderId: record.order.id, eventType: isAdminTestPurchase ? "admin_test_purchase_completed" : "payment_confirmed", status: completedStatus, actorType: "system", messageKh: isAdminTestPurchase ? "ការទូទាត់ Admin KHQR Test Product បានជោគជ័យ។ មិនមាន top-up ពិតត្រូវបានបញ្ជូនទៅ provider ទេ។" : statusMessageKh("paid"), providerReference: input.md5 });
  });
  // The paid top-up must now be DELIVERED to the player's game account. This runs
  // OUTSIDE the money transaction so a provider hiccup never rolls back a
  // confirmed payment. fulfillTopupOrder is idempotent and, on provider failure,
  // keeps the order at "paid" and flags it for manual delivery.
  if (credited && !isAdminTestPurchase && record.order.orderType === "topup") {
    try { await fulfillTopupOrder(record.order.id); } catch { /* flagged inside fulfillTopupOrder */ }
  }
  // Push the sale to the operator's Telegram. Guarded by `credited` so a
  // duplicate webhook does not produce a duplicate notification, and voided so
  // a Telegram outage can never fail a confirmed payment.
  if (credited) {
    void notifyPurchase({ orderId: input.orderId, amount: input.amount, currency: input.currency, reference: input.md5 });
  }
  return { idempotent: !credited };
}

export async function getCustomerOrderTracking(input: { userId: number; trackingCode: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const row = await db.select().from(orders).where(and(eq(orders.userId, input.userId), eq(orders.trackingCode, input.trackingCode.trim().toUpperCase()))).limit(1);
  const order = row[0];
  if (!order) throw new Error("Purchase ID was not found in your account");
  const events = await db.select().from(orderStatusEvents).where(eq(orderStatusEvents.orderId, order.id)).orderBy(asc(orderStatusEvents.createdAt));
  const tickets = await db.select().from(orderSupportTickets).where(and(eq(orderSupportTickets.orderId, order.id), eq(orderSupportTickets.userId, input.userId))).orderBy(desc(orderSupportTickets.createdAt));
  const visibleOrder = { id: order.id, orderNumber: order.orderNumber, trackingCode: order.trackingCode, orderType: order.orderType, status: order.status, productName: order.productName, subtotal: order.subtotal, currency: order.currency, createdAt: order.createdAt, updatedAt: order.updatedAt, delivery: publicPartnerDelivery(order.details, order.status), cdk: publicCdkStatus(order.details, order.status) };
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
  return (await db.select().from(siteContent).where(eq(siteContent.isActive, true)).orderBy(desc(siteContent.updatedAt))).filter((content) => content.contentKey !== paymentControlContentKey && !content.contentKey.startsWith("psvc:"));
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

const topupManualReviewMessageKh = "ការទូទាត់ជោគជ័យ ប៉ុន្តែការដឹកជញ្ជូនកញ្ចប់ទៅ provider មិនទាន់សម្រេច។ ក្រុមការងារនឹងដឹកជញ្ជូនដោយដៃ ឬសាកម្ដងទៀតឆាប់ៗ។";

/**
 * Delivers a PAID top-up order to the provider (FZR Cards) and moves it to
 * "delivered" on success. This is the missing half of the top-up flow: money was
 * being recognised but the diamonds were never sent to the player's account.
 * It is idempotent (guards on details.providerOrderId), never throws, and on
 * failure keeps the order at "paid" and appends a manual-review event so the
 * owner sees it in the admin orders list instead of the customer silently
 * losing money.
 */
export async function fulfillTopupOrder(orderId: string): Promise<{ delivered: boolean; reason?: string }> {
  const db = await getDb();
  if (!db) return { delivered: false, reason: "database_unavailable" };
  const rows = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = rows[0];
  if (!order || order.orderType !== "topup") return { delivered: false, reason: "not_topup_order" };
  const details = (order.details && typeof order.details === "object" ? order.details : {}) as Record<string, unknown>;
  // Admin test purchases and anything explicitly flagged never touch a provider.
  if (details.noProviderFulfillment === true || details.testPurchase === true) return { delivered: false, reason: "no_provider_fulfillment" };
  // Idempotency: never submit the same order to the provider twice.
  if (typeof details.providerOrderId === "string" && details.providerOrderId) return { delivered: true };
  // Only fulfil orders whose payment is recognised.
  if (!["paid", "delivered"].includes(order.status)) return { delivered: false, reason: "not_paid" };
  const packageId = typeof details.packageId === "string" ? details.packageId : "";
  const playerId = typeof details.playerId === "string" ? details.playerId.trim() : "";
  const zoneId = typeof details.zoneId === "string" ? details.zoneId.trim() : "";
  const flagManualReview = async (reason: string) => {
    await db.update(orders).set({ details: { ...details, providerFulfillment: "failed", providerFulfillmentReason: reason, providerFulfillmentAt: new Date().toISOString() } }).where(eq(orders.id, orderId));
    await appendOrderStatusEvent({ orderId, eventType: "provider_fulfillment_failed", status: order.status as OrderStatus, actorType: "system", messageKh: topupManualReviewMessageKh });
  };
  if (!packageId || !playerId) { await flagManualReview("missing_order_details"); return { delivered: false, reason: "missing_order_details" }; }
  const pkgRows = await db.select({ providerSource: gamePackages.providerSource }).from(gamePackages).where(eq(gamePackages.id, packageId)).limit(1);
  const providerSource = pkgRows[0]?.providerSource ?? "";
  const parsed = /^fzr_cards:([^:]+):(.+)$/.exec(providerSource);
  if (!parsed) { await flagManualReview("unmapped_provider_package"); return { delivered: false, reason: "unmapped_provider_package" }; }
  const categoryId = parsed[1]!;
  const offerId = parsed[2]!;
  const result = await submitFzrTopupOrder({ categoryId, offerId, playerId, serverId: zoneId || null });
  if (result.status === "submitted") {
    await db.update(orders).set({ status: "delivered", details: { ...details, providerOrderId: result.providerOrderId, providerFulfillment: "submitted", providerFulfillmentAt: new Date().toISOString() } }).where(eq(orders.id, orderId));
    await appendOrderStatusEvent({ orderId, eventType: "provider_submitted", status: "delivered", actorType: "provider", providerReference: result.providerOrderId, messageKh: "កញ្ចប់ត្រូវបានបញ្ជូន និងដឹកជញ្ជូនទៅគណនីហ្គេមរបស់អ្នកដោយស្វ័យប្រវត្តិ។" });
    return { delivered: true };
  }
  await flagManualReview(result.status);
  return { delivered: false, reason: result.status };
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
  // Admin manually confirming a top-up as paid triggers the same automatic
  // provider delivery as the KHQR worker path (idempotent; flags manual review
  // on failure). Manually setting "delivered" is a human override and is NOT
  // re-sent to the provider.
  if (order.orderType === "topup" && input.status === "paid" && order.status !== "paid") { try { await fulfillTopupOrder(input.orderId); } catch { /* fulfillTopupOrder flags manual review on failure */ } }
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

export async function grantDelegatedAdminAccess(input: { actorUserId: number; targetUserId: number; permissions: DelegatedAdminPermission[]; confirmationEmail: string; reason: string }) {
  const permissions = normalizeDelegatedAdminPermissions(input.permissions);
  if (!permissions.length) throw new Error("Select at least one Admin section before granting access.");
  const db = await getDb();
  if (!db) {
    if (!isAppwriteStoreConfigured()) throw new Error("Role management is unavailable until the administrator storage is connected.");
    await setAppwriteUserRole({ ...input, nextRole: "admin" });
    return setAppwriteAdminPermissions({ userId: input.targetUserId, permissions, updatedByUserId: input.actorUserId });
  }
  const target = await db.select().from(users).where(eq(users.id, input.targetUserId)).limit(1);
  if (!target[0]) throw new Error("The target account was not found.");
  validateAdminRoleChange({ targetEmail: target[0].email, previousRole: target[0].role, nextRole: "admin", confirmationEmail: input.confirmationEmail, reason: input.reason });
  const key = delegatedAdminPermissionsContentKey(input.targetUserId);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ role: "admin" }).where(eq(users.id, input.targetUserId));
    await tx.insert(siteContent).values({ id: nanoid(), contentKey: key, titleKh: "Delegated Admin permissions", bodyKh: JSON.stringify(permissions), isActive: false, updatedByUserId: input.actorUserId }).onDuplicateKeyUpdate({ set: { bodyKh: JSON.stringify(permissions), isActive: false, updatedByUserId: input.actorUserId } });
    await tx.insert(adminRoleAudits).values({ id: nanoid(), actorUserId: input.actorUserId, targetUserId: input.targetUserId, previousRole: target[0].role, nextRole: "admin", reason: input.reason.trim() });
  });
  return { permissions };
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
const paymentMethodContentPrefix = "payment-method:";

type PaymentMethodConfig = {
  id: string;
  name: string;
  descriptionKh: string;
  iconUrl: string | null;
  providerKey: "bakong_khqr" | "manual";
  isActive: boolean;
  sortOrder: number;
  updatedAt: Date;
};

const paymentMethodSeeds: Array<Omit<PaymentMethodConfig, "updatedAt">> = [
  { id: "khqr", name: "KHQR", descriptionKh: "ទូទាត់ដោយស្កេនតាមកម្មវិធីធនាគារ ឬ Bakong ដែលគាំទ្រ", iconUrl: null, providerKey: "bakong_khqr", isActive: true, sortOrder: 10 },
];

function paymentMethodContentKey(id: string) { return `${paymentMethodContentPrefix}${id}`; }

function paymentMethodFromContent(row: typeof siteContent.$inferSelect): PaymentMethodConfig | null {
  if (!row.contentKey.startsWith(paymentMethodContentPrefix)) return null;
  const id = row.contentKey.slice(paymentMethodContentPrefix.length);
  const seed = paymentMethodSeeds.find((method) => method.id === id);
  const data = parseJsonRecord(row.bodyKh);
  const providerKey = data.providerKey === "bakong_khqr" ? "bakong_khqr" : "manual";
  return {
    id,
    name: row.titleKh ?? seed?.name ?? id,
    descriptionKh: typeof data.descriptionKh === "string" ? data.descriptionKh : seed?.descriptionKh ?? "",
    iconUrl: row.mediaUrl ?? seed?.iconUrl ?? null,
    providerKey,
    isActive: row.isActive,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : seed?.sortOrder ?? 999,
    updatedAt: row.updatedAt,
  };
}

async function ensurePaymentMethodSeeds() {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select({ contentKey: siteContent.contentKey }).from(siteContent);
  const keys = new Set(rows.map((row) => row.contentKey));
  for (const method of paymentMethodSeeds) {
    const contentKey = paymentMethodContentKey(method.id);
    if (keys.has(contentKey)) continue;
    await db.insert(siteContent).values({ id: nanoid(), contentKey, titleKh: method.name, bodyKh: JSON.stringify({ descriptionKh: method.descriptionKh, providerKey: method.providerKey, sortOrder: method.sortOrder }), mediaUrl: method.iconUrl, isActive: method.isActive, updatedByUserId: null });
  }
}

export async function getPaymentMethods(includeHidden = false) {
  const db = await getDb();
  if (!db) return includeHidden ? paymentMethodSeeds.map((method) => ({ ...method, updatedAt: new Date(0) })) : paymentMethodSeeds.filter((method) => method.isActive).map((method) => ({ ...method, updatedAt: new Date(0) }));
  await ensurePaymentMethodSeeds();
  const methods = (await db.select().from(siteContent)).map(paymentMethodFromContent).filter((method): method is PaymentMethodConfig => Boolean(method));
  return methods.filter((method) => includeHidden || method.isActive).sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
}

export async function savePaymentMethod(input: { id: string; name: string; descriptionKh: string; iconUrl?: string | null; providerKey: "bakong_khqr" | "manual"; isActive: boolean; sortOrder: number; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Payment-method storage is unavailable.");
  const id = input.id.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{1,47}$/.test(id)) throw new Error("Payment method ID must use lowercase letters, numbers, dashes, or underscores.");
  const iconUrl = input.iconUrl?.trim() || null;
  if (iconUrl && !isSafeArtworkMediaUrl(iconUrl)) throw new Error("Payment method icon must use managed storage or HTTPS.");
  const contentKey = paymentMethodContentKey(id);
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, contentKey)).limit(1);
  const values = { titleKh: input.name.trim(), bodyKh: JSON.stringify({ descriptionKh: input.descriptionKh.trim(), providerKey: input.providerKey, sortOrder: input.sortOrder }), mediaUrl: iconUrl, isActive: input.isActive, updatedByUserId: input.updatedByUserId };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey, ...values });
  return { success: true };
}

export async function getPaymentControl() {
  const db = await getDb();
  if (!db) return isAppwriteStoreConfigured() ? getAppwritePaymentControl() : { enabled: true, updatedByUserId: null, updatedAt: new Date(0) };
  const record = await db.select().from(siteContent).where(eq(siteContent.contentKey, paymentControlContentKey)).limit(1);
  // Store is open by default unless an administrator has explicitly turned it off.
  return { enabled: record[0] ? record[0].isActive === true : true, updatedByUserId: record[0]?.updatedByUserId ?? null, updatedAt: record[0]?.updatedAt ?? new Date(0) };
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
  if (mediaUrl.startsWith("/api/media/") || mediaUrl.startsWith("/manus-storage/")) return true;
  try { return new URL(mediaUrl).protocol === "https:"; } catch { return false; }
}

function artworkStorageKey(mediaUrl: string) {
  if (mediaUrl.startsWith("/api/media/")) return mediaUrl.slice("/api/media/".length);
  return mediaUrl.startsWith("/manus-storage/") ? mediaUrl.slice("/manus-storage/".length) : null;
}

/**
 * The storefront combines regional provider catalogs into a single game page
 * (for example `/topup/mobile_legends`). Overrides are saved against the
 * real provider route (`mobile_legends_global`, `mobile_legends_promo`, …),
 * so the public lookup must include its regional children. Without this, an
 * upload can appear saved in Admin while customers on the combined page only
 * receive the default artwork.
 */
export function providerFamilyMetadataPrefix(gameId?: string) {
  const normalized = gameId?.trim().toLowerCase() ?? "";
  return ["mobile_legends", "free_fire", "pubg_mobile"].includes(normalized) ? `${normalized}_%` : null;
}

export async function getProviderPackageArtworkOverrides(gameId?: string) {
  const db = await getDb();
  if (!db) return [];
  const normalizedGameId = gameId?.trim() ?? "";
  const familyPrefix = providerFamilyMetadataPrefix(normalizedGameId);
  const rows = gameId
    ? await db.select().from(providerPackageArtworkOverrides).where(familyPrefix ? or(eq(providerPackageArtworkOverrides.gameId, normalizedGameId), like(providerPackageArtworkOverrides.gameId, familyPrefix)) : eq(providerPackageArtworkOverrides.gameId, normalizedGameId)).orderBy(desc(providerPackageArtworkOverrides.updatedAt))
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

/** Display-only package categories are maintained independently of pricing, checkout, and provider fulfillment. */
export async function getProviderPackageCategoryOverrides(gameId?: string) {
  const db = await getDb();
  if (!db) return [];
  const normalizedGameId = gameId?.trim() ?? "";
  const familyPrefix = providerFamilyMetadataPrefix(normalizedGameId);
  const rows = gameId
    ? await db.select().from(providerPackageCategoryOverrides).where(familyPrefix ? or(eq(providerPackageCategoryOverrides.gameId, normalizedGameId), like(providerPackageCategoryOverrides.gameId, familyPrefix)) : eq(providerPackageCategoryOverrides.gameId, normalizedGameId)).orderBy(asc(providerPackageCategoryOverrides.categoryLabel))
    : await db.select().from(providerPackageCategoryOverrides).orderBy(desc(providerPackageCategoryOverrides.updatedAt));
  return rows.map((row) => ({ gameId: row.gameId, offerId: row.offerId, categoryLabel: row.categoryLabel, updatedAt: row.updatedAt }));
}

export async function saveProviderPackageCategoryOverride(input: { gameId: string; offerId: string; categoryLabel: string; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Package category storage is unavailable");
  const gameId = input.gameId.trim();
  const offerId = input.offerId.trim();
  const categoryLabel = input.categoryLabel.trim();
  if (!categoryLabel || categoryLabel.length > 80) throw new Error("Package category must be between 1 and 80 characters");
  const current = await db.select().from(providerPackageCategoryOverrides).where(and(eq(providerPackageCategoryOverrides.gameId, gameId), eq(providerPackageCategoryOverrides.offerId, offerId))).limit(1);
  const previousCategoryLabel = current[0]?.categoryLabel ?? null;
  if (current[0]) await db.update(providerPackageCategoryOverrides).set({ categoryLabel, updatedByUserId: input.updatedByUserId }).where(eq(providerPackageCategoryOverrides.id, current[0].id));
  else await db.insert(providerPackageCategoryOverrides).values({ id: nanoid(), gameId, offerId, categoryLabel, updatedByUserId: input.updatedByUserId });
  if (previousCategoryLabel !== categoryLabel) await db.insert(providerPackageCategoryAudits).values({ id: nanoid(), gameId, offerId, action: "set", previousCategoryLabel, nextCategoryLabel: categoryLabel, actorUserId: input.updatedByUserId });
  return { success: true, categoryLabel };
}

export async function resetProviderPackageCategoryOverride(input: { gameId: string; offerId: string; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Package category storage is unavailable");
  const gameId = input.gameId.trim();
  const offerId = input.offerId.trim();
  const current = await db.select().from(providerPackageCategoryOverrides).where(and(eq(providerPackageCategoryOverrides.gameId, gameId), eq(providerPackageCategoryOverrides.offerId, offerId))).limit(1);
  if (!current[0]) return { success: true, reset: false };
  await db.delete(providerPackageCategoryOverrides).where(eq(providerPackageCategoryOverrides.id, current[0].id));
  await db.insert(providerPackageCategoryAudits).values({ id: nanoid(), gameId, offerId, action: "reset", previousCategoryLabel: current[0].categoryLabel, nextCategoryLabel: null, actorUserId: input.updatedByUserId });
  return { success: true, reset: true };
}

/*
 * Round 9: an owner-editable banner on any single package, e.g. "DISCOUNT".
 * These live in site_content instead of a new table so no database migration is
 * needed, and every row is written with isActive:false so it can never leak into
 * the public content feed.
 */
const packageBadgeContentPrefix = "package-badge:";
export const packageBadgeTones = ["discount", "hot", "new", "best", "gold"] as const;
export type PackageBadgeTone = (typeof packageBadgeTones)[number];

function packageBadgeContentKey(gameId: string, offerId: string) {
  return `${packageBadgeContentPrefix}${gameId}:${offerId}`;
}

function parsePackageBadgeRow(row: { contentKey: string; titleKh: string | null; bodyKh: string | null; updatedAt: Date }) {
  const rest = row.contentKey.slice(packageBadgeContentPrefix.length);
  const separator = rest.indexOf(":");
  if (separator <= 0) return null;
  const gameId = rest.slice(0, separator);
  const offerId = rest.slice(separator + 1);
  const label = (row.titleKh ?? "").trim();
  if (!gameId || !offerId || !label) return null;
  const rawTone = (row.bodyKh ?? "").trim();
  const tone: PackageBadgeTone = (packageBadgeTones as readonly string[]).includes(rawTone) ? (rawTone as PackageBadgeTone) : "gold";
  return { gameId, offerId, label, tone, updatedAt: row.updatedAt };
}

export async function getPackageBadgeOverrides(gameId?: string) {
  const db = await getDb();
  if (!db) return [];
  const normalizedGameId = gameId?.trim() ?? "";
  const familyPrefix = providerFamilyMetadataPrefix(normalizedGameId);
  const rows = await db.select().from(siteContent).where(like(siteContent.contentKey, `${packageBadgeContentPrefix}%`)).orderBy(asc(siteContent.contentKey));
  const parsed = rows.map(parsePackageBadgeRow).filter((item): item is NonNullable<typeof item> => Boolean(item));
  if (!normalizedGameId) return parsed;
  // Mirrors the artwork/category overrides: a family page also shows its variants.
  const family = familyPrefix ? familyPrefix.replace(/%$/, "") : null;
  return parsed.filter((item) => item.gameId === normalizedGameId || (family ? item.gameId.startsWith(family) : false));
}

export async function savePackageBadgeOverride(input: { gameId: string; offerId: string; label: string; tone?: string; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Package banner storage is unavailable");
  const gameId = input.gameId.trim();
  const offerId = input.offerId.trim();
  const label = input.label.trim().slice(0, 40);
  if (!gameId || !offerId) throw new Error("Package banner needs both a game and an offer");
  if (!label) throw new Error("Package banner text must not be empty");
  const rawTone = (input.tone ?? "").trim();
  const tone: PackageBadgeTone = (packageBadgeTones as readonly string[]).includes(rawTone) ? (rawTone as PackageBadgeTone) : "gold";
  const contentKey = packageBadgeContentKey(gameId, offerId);
  const current = await db.select().from(siteContent).where(eq(siteContent.contentKey, contentKey)).limit(1);
  const values = { titleKh: label, bodyKh: tone, mediaUrl: null, isActive: false, updatedByUserId: input.updatedByUserId };
  if (current[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, current[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey, ...values });
  return { success: true, label, tone };
}

export async function resetPackageBadgeOverride(input: { gameId: string; offerId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Package banner storage is unavailable");
  const contentKey = packageBadgeContentKey(input.gameId.trim(), input.offerId.trim());
  await db.delete(siteContent).where(eq(siteContent.contentKey, contentKey));
  return { success: true, reset: true };
}

const contactAdminContentPrefix = "support-contact-admin:";
const providerGameImageContentPrefix = "provider-game-image:";

type ContactAdminProfile = {
  id: string;
  displayName: string;
  telegramUsername: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  replyTimeText: string;
  photoUrl: string | null;
  isVisible: boolean;
  sortOrder: number;
  updatedAt: Date;
};

const contactAdminSeeds: Array<Omit<ContactAdminProfile, "updatedAt">> = [
  { id: "admin-makara", displayName: "Admin Makara", telegramUsername: "zurs_makara", workingHoursStart: "08:00", workingHoursEnd: "22:00", replyTimeText: "~5 នាទី", photoUrl: null, isVisible: true, sortOrder: 10 },
  { id: "admin-lymeng", displayName: "Admin Lymeng", telegramUsername: "zurs_lymeng", workingHoursStart: "08:00", workingHoursEnd: "22:00", replyTimeText: "~10 នាទី", photoUrl: null, isVisible: true, sortOrder: 20 },
];

function contactAdminContentKey(id: string) { return `${contactAdminContentPrefix}${id}`; }
function providerGameImageContentKey(gameId: string) { return `${providerGameImageContentPrefix}${gameId}`; }

function parseJsonRecord(value: string | null) {
  if (!value) return {} as Record<string, unknown>;
  try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {}; } catch { return {}; }
}

function contactAdminFromContent(row: typeof siteContent.$inferSelect): ContactAdminProfile | null {
  if (!row.contentKey.startsWith(contactAdminContentPrefix)) return null;
  const id = row.contentKey.slice(contactAdminContentPrefix.length);
  const seed = contactAdminSeeds.find((admin) => admin.id === id);
  const data = parseJsonRecord(row.bodyKh);
  return {
    id,
    displayName: typeof data.displayName === "string" ? data.displayName : row.titleKh ?? seed?.displayName ?? "Admin",
    telegramUsername: typeof data.telegramUsername === "string" ? data.telegramUsername : seed?.telegramUsername ?? "",
    workingHoursStart: typeof data.workingHoursStart === "string" ? data.workingHoursStart : seed?.workingHoursStart ?? "08:00",
    workingHoursEnd: typeof data.workingHoursEnd === "string" ? data.workingHoursEnd : seed?.workingHoursEnd ?? "22:00",
    replyTimeText: typeof data.replyTimeText === "string" ? data.replyTimeText : seed?.replyTimeText ?? "~5 នាទី",
    photoUrl: row.mediaUrl ?? null,
    isVisible: row.isActive,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : seed?.sortOrder ?? 999,
    updatedAt: row.updatedAt,
  };
}

async function ensureContactAdminSeeds() {
  const db = await getDb();
  if (!db) return;
  const rows = await db.select().from(siteContent);
  const keys = new Set(rows.map((row) => row.contentKey));
  for (const admin of contactAdminSeeds) {
    const contentKey = contactAdminContentKey(admin.id);
    if (keys.has(contentKey)) continue;
    await db.insert(siteContent).values({ id: nanoid(), contentKey, titleKh: admin.displayName, bodyKh: JSON.stringify({ displayName: admin.displayName, telegramUsername: admin.telegramUsername, workingHoursStart: admin.workingHoursStart, workingHoursEnd: admin.workingHoursEnd, replyTimeText: admin.replyTimeText, sortOrder: admin.sortOrder }), mediaUrl: null, isActive: admin.isVisible, updatedByUserId: null });
  }
}

export async function getContactAdmins(includeHidden = false) {
  const db = await getDb();
  if (!db) return contactAdminSeeds.map((admin) => ({ ...admin, updatedAt: new Date(0) }));
  await ensureContactAdminSeeds();
  const admins = (await db.select().from(siteContent)).map(contactAdminFromContent).filter((admin): admin is ContactAdminProfile => Boolean(admin));
  return admins.filter((admin) => includeHidden || admin.isVisible).sort((a, b) => a.sortOrder - b.sortOrder || a.displayName.localeCompare(b.displayName));
}

export async function saveContactAdmin(input: { id: string; displayName: string; telegramUsername: string; workingHoursStart: string; workingHoursEnd: string; replyTimeText: string; photoUrl?: string | null; isVisible: boolean; sortOrder: number; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Contact-admin storage is unavailable");
  await ensureContactAdminSeeds();
  const id = input.id.trim();
  if (!contactAdminSeeds.some((admin) => admin.id === id)) throw new Error("Contact admin not found");
  const photoUrl = input.photoUrl?.trim() || null;
  if (photoUrl && !isSafeArtworkMediaUrl(photoUrl)) throw new Error("Photo URL must use managed storage or HTTPS");
  const contentKey = contactAdminContentKey(id);
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, contentKey)).limit(1);
  const values = { titleKh: input.displayName.trim(), bodyKh: JSON.stringify({ displayName: input.displayName.trim(), telegramUsername: input.telegramUsername.replace(/^@+/, "").trim(), workingHoursStart: input.workingHoursStart.trim(), workingHoursEnd: input.workingHoursEnd.trim(), replyTimeText: input.replyTimeText.trim(), sortOrder: input.sortOrder }), mediaUrl: photoUrl, isActive: input.isVisible, updatedByUserId: input.updatedByUserId };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey, ...values });
  return { success: true };
}

type ProviderGameImageOverride = { gameId: string; logoUrl: string | null; cardArtworkUrl: string | null; updatedAt: Date };

function providerGameImageFromContent(row: typeof siteContent.$inferSelect): ProviderGameImageOverride | null {
  if (!row.contentKey.startsWith(providerGameImageContentPrefix)) return null;
  const data = parseJsonRecord(row.bodyKh);
  return { gameId: row.contentKey.slice(providerGameImageContentPrefix.length), logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null, cardArtworkUrl: typeof data.cardArtworkUrl === "string" ? data.cardArtworkUrl : null, updatedAt: row.updatedAt };
}

export async function getProviderGameImageOverrides() {
  const db = await getDb();
  if (!db) return [];
  return (await db.select().from(siteContent)).map(providerGameImageFromContent).filter((item): item is ProviderGameImageOverride => Boolean(item)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export async function saveProviderGameImageOverride(input: { gameId: string; logoUrl?: string | null; cardArtworkUrl?: string | null; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Game-image override storage is unavailable");
  const gameId = input.gameId.trim();
  const logoUrl = input.logoUrl?.trim() || null;
  const cardArtworkUrl = input.cardArtworkUrl?.trim() || null;
  if (logoUrl && !isSafeArtworkMediaUrl(logoUrl)) throw new Error("Logo URL must use managed storage or HTTPS");
  if (cardArtworkUrl && !isSafeArtworkMediaUrl(cardArtworkUrl)) throw new Error("Artwork URL must use managed storage or HTTPS");
  const contentKey = providerGameImageContentKey(gameId);
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, contentKey)).limit(1);
  const values = { titleKh: `Game image override · ${gameId}`, bodyKh: JSON.stringify({ logoUrl, cardArtworkUrl }), mediaUrl: cardArtworkUrl, isActive: true, updatedByUserId: input.updatedByUserId };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey, ...values });
  return { success: true };
}

export async function resetProviderGameImageSlot(input: { gameId: string; slot: "logo" | "cardArtwork" }) {
  const db = await getDb();
  if (!db) throw new Error("Game-image override storage is unavailable");
  const gameId = input.gameId.trim();
  const contentKey = providerGameImageContentKey(gameId);
  const current = await db.select().from(siteContent).where(eq(siteContent.contentKey, contentKey)).limit(1);
  if (!current[0]) return { success: true, reset: false };
  const data = parseJsonRecord(current[0].bodyKh);
  const logoUrl = input.slot === "logo" ? null : typeof data.logoUrl === "string" ? data.logoUrl : null;
  const cardArtworkUrl = input.slot === "cardArtwork" ? null : typeof data.cardArtworkUrl === "string" ? data.cardArtworkUrl : null;
  if (!logoUrl && !cardArtworkUrl) await db.delete(siteContent).where(eq(siteContent.id, current[0].id));
  else await db.update(siteContent).set({ bodyKh: JSON.stringify({ logoUrl, cardArtworkUrl }), mediaUrl: cardArtworkUrl }).where(eq(siteContent.id, current[0].id));
  return { success: true, reset: true };
}
