import { and, asc, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import {
  gamePackages, gameProducts, InsertUser, marketplaceContacts, marketplaceFraudReports, marketplaceListings, marketplaceVerificationEvidence, marketplaceVerifications, orders, paymentTransactions, savedPlayerIds, siteContent, smmServices, smmTiers, users,
} from "../drizzle/schema";
import { defaultGamePackages, defaultGames, defaultSmmServices, defaultSmmTiers } from "./catalogDefaults";
import { buildOrderNumber, isSingleAdminEmail } from "./storefrontDomain";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, lastSignedIn: user.lastSignedIn ?? new Date() };
  const updateSet: Partial<InsertUser> = { lastSignedIn: values.lastSignedIn };
  if (user.name !== undefined) { values.name = user.name; updateSet.name = user.name; }
  if (user.loginMethod !== undefined) { values.loginMethod = user.loginMethod; updateSet.loginMethod = user.loginMethod; }
  if (user.email !== undefined) {
    values.email = user.email;
    updateSet.email = user.email;
    const role = isSingleAdminEmail(user.email) ? "admin" : "user";
    values.role = role;
    updateSet.role = role;
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function updateUserDisplayName(input: { userId: number; displayName: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ displayName: input.displayName }).where(eq(users.id, input.userId));
  return { displayName: input.displayName };
}

async function ensureDefaultCatalog() {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select({ count: sql<number>`count(*)` }).from(gameProducts);
  if (Number(existing[0]?.count ?? 0) === 0) {
    await db.insert(gameProducts).values([...defaultGames]);
    await db.insert(gamePackages).values([...defaultGamePackages]);
  }
  const services = await db.select({ count: sql<number>`count(*)` }).from(smmServices);
  if (Number(services[0]?.count ?? 0) === 0) {
    await db.insert(smmServices).values([...defaultSmmServices]);
    await db.insert(smmTiers).values([...defaultSmmTiers]);
  }
  return db;
}

export async function getGameCatalog() {
  const db = await ensureDefaultCatalog();
  if (!db) return [];
  const products = await db.select().from(gameProducts).where(eq(gameProducts.isActive, true)).orderBy(asc(gameProducts.sortOrder));
  const packages = await db.select().from(gamePackages).where(eq(gamePackages.isActive, true)).orderBy(asc(gamePackages.sortOrder));
  return products.map((product) => ({ ...product, packages: packages.filter((item) => item.productId === product.id) }));
}

export async function getSmmCatalog() {
  const db = await ensureDefaultCatalog();
  if (!db) return [];
  const services = await db.select().from(smmServices).where(eq(smmServices.isActive, true)).orderBy(asc(smmServices.sortOrder));
  const tiers = await db.select().from(smmTiers).where(eq(smmTiers.isActive, true)).orderBy(asc(smmTiers.sortOrder));
  return services.map((service) => ({ ...service, tiers: tiers.filter((item) => item.serviceId === service.id) }));
}

export async function createTopupOrder(input: { userId: number; packageId: string; playerId: string; zoneId?: string | null; quantity: number }) {
  const db = await ensureDefaultCatalog();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select({ game: gameProducts, package: gamePackages }).from(gamePackages).innerJoin(gameProducts, eq(gamePackages.productId, gameProducts.id)).where(and(eq(gamePackages.id, input.packageId), eq(gamePackages.isActive, true), eq(gameProducts.isActive, true))).limit(1);
  const item = result[0];
  if (!item) throw new Error("Selected game package is unavailable");
  if (item.game.requiresZone && !input.zoneId?.trim()) throw new Error("Server or zone ID is required for this game");
  const subtotal = Number(item.package.priceUsd) * input.quantity;
  const id = nanoid(); const orderNumber = buildOrderNumber();
  await db.insert(orders).values({ id, orderNumber, userId: input.userId, orderType: "topup", status: "pending", subtotal: subtotal.toFixed(2), productName: `${item.game.titleEn} • ${item.package.amountLabel} ${item.game.currencyLabel}`, details: { packageId: item.package.id, gameProductId: item.game.id, playerId: input.playerId.trim(), zoneId: input.zoneId?.trim() ?? null, quantity: input.quantity } });
  return { id, orderNumber, amount: subtotal.toFixed(2), status: "pending" as const };
}

export async function createSmmOrder(input: { userId: number; tierId: string; target: string }) {
  const db = await ensureDefaultCatalog();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select({ service: smmServices, tier: smmTiers }).from(smmTiers).innerJoin(smmServices, eq(smmTiers.serviceId, smmServices.id)).where(and(eq(smmTiers.id, input.tierId), eq(smmTiers.isActive, true), eq(smmServices.isActive, true))).limit(1);
  const item = result[0];
  if (!item) throw new Error("Selected SMM tier is unavailable");
  const id = nanoid(); const orderNumber = buildOrderNumber();
  await db.insert(orders).values({ id, orderNumber, userId: input.userId, orderType: "smm", status: "pending", subtotal: item.tier.priceUsd, productName: `${item.service.platform} • ${item.service.titleEn} (${item.tier.quantity.toLocaleString()})`, details: { serviceId: item.service.id, tierId: item.tier.id, target: input.target.trim(), quantity: item.tier.quantity } });
  return { id, orderNumber, amount: item.tier.priceUsd, status: "pending" as const };
}

export async function getCustomerOrders(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
}

export async function beginStagedPayment(input: { orderId: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0]) throw new Error("Order not found");
  if (["paid", "delivered", "failed", "expired", "refunded"].includes(order[0].status)) throw new Error("This order cannot begin a payment session");
  const existing = await db.select().from(paymentTransactions).where(eq(paymentTransactions.orderId, input.orderId)).limit(1);
  const transaction = existing[0] ?? { id: nanoid(), orderId: input.orderId, provider: "toanchetpay_staged", status: "pending" as const, amount: order[0].subtotal, currency: order[0].currency, checkoutUrl: `/checkout/${input.orderId}` };
  if (!existing[0]) await db.insert(paymentTransactions).values(transaction);
  await db.update(orders).set({ status: "awaiting_payment" }).where(eq(orders.id, input.orderId));
  return { order: { id: order[0].id, orderNumber: order[0].orderNumber, productName: order[0].productName, subtotal: order[0].subtotal, status: "awaiting_payment" as const }, payment: { id: transaction.id, provider: transaction.provider, status: transaction.status, checkoutUrl: transaction.checkoutUrl } };
}

export async function getCustomerPaymentSession(input: { orderId: string; userId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const order = await db.select().from(orders).where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId))).limit(1);
  if (!order[0]) throw new Error("Order not found");
  const payment = await db.select().from(paymentTransactions).where(eq(paymentTransactions.orderId, input.orderId)).orderBy(desc(paymentTransactions.createdAt)).limit(1);
  return { order: order[0], payment: payment[0] ?? null };
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
  if (!db) return [];
  const conditions = [eq(marketplaceListings.status, "approved")];
  if (input.listingType) conditions.push(eq(marketplaceListings.listingType, input.listingType));
  if (input.game) conditions.push(eq(marketplaceListings.game, input.game));
  const results = await db.select().from(marketplaceListings).where(and(...conditions)).orderBy(desc(marketplaceListings.createdAt));
  const search = input.search?.trim().toLowerCase();
  return search ? results.filter((listing) => `${listing.title} ${listing.description}`.toLowerCase().includes(search)) : results;
}

export async function getMarketplaceEligibility(userId: number) {
  const db = await getDb();
  if (!db) return { status: "not_started" as const, locationCountry: null, verificationNote: null };
  const result = await db.select().from(marketplaceVerifications).where(eq(marketplaceVerifications.userId, userId)).orderBy(desc(marketplaceVerifications.createdAt)).limit(1);
  const verification = result[0];
  if (!verification) return { status: "not_started" as const, locationCountry: null, verificationNote: null };
  return { status: verification.status, locationCountry: verification.locationCountry, verificationNote: verification.verificationNote };
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
  if (!db) throw new Error("Database unavailable");
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

export async function createMarketplaceFraudReport(input: { listingId: string; reporterUserId: number; details: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const listing = await db.select({ id: marketplaceListings.id }).from(marketplaceListings).where(eq(marketplaceListings.id, input.listingId)).limit(1);
  if (!listing[0]) throw new Error("Listing not found");
  const id = nanoid(); await db.insert(marketplaceFraudReports).values({ id, listingId: input.listingId, reporterUserId: input.reporterUserId, details: input.details.trim() });
  return { id, status: "received" as const };
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

export async function updateOrderStatus(input: { orderId: string; status: "pending" | "awaiting_payment" | "paid" | "delivered" | "failed" | "expired" | "refunded" }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.orderId));
  if (input.status === "refunded") await db.update(paymentTransactions).set({ status: "refunded" }).where(eq(paymentTransactions.orderId, input.orderId));
  return { success: true };
}

export async function getAdminMarketplaceListings(status?: "draft" | "pending" | "approved" | "rejected" | "closed" | "sold") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ listing: marketplaceListings, seller: { id: users.id, name: users.name, email: users.email } }).from(marketplaceListings).leftJoin(users, eq(marketplaceListings.sellerUserId, users.id));
  return status ? query.where(eq(marketplaceListings.status, status)).orderBy(desc(marketplaceListings.createdAt)) : query.orderBy(desc(marketplaceListings.createdAt));
}

export async function reviewMarketplaceListing(input: { listingId: string; status: "approved" | "rejected" | "closed"; reviewNote?: string | null; reviewerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(marketplaceListings).set({ status: input.status, reviewNote: input.reviewNote?.trim() ?? null, reviewedByUserId: input.reviewerUserId, reviewedAt: new Date() }).where(eq(marketplaceListings.id, input.listingId));
  return { success: true };
}

export async function getAdminMarketplaceFraudReports() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ report: marketplaceFraudReports, listing: { id: marketplaceListings.id, title: marketplaceListings.title, game: marketplaceListings.game }, reporter: { id: users.id, displayName: users.displayName, email: users.email } }).from(marketplaceFraudReports).leftJoin(marketplaceListings, eq(marketplaceFraudReports.listingId, marketplaceListings.id)).leftJoin(users, eq(marketplaceFraudReports.reporterUserId, users.id)).orderBy(desc(marketplaceFraudReports.createdAt));
}

export async function getAdminMarketplaceVerifications(status?: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select({ verification: marketplaceVerifications, user: { id: users.id, displayName: users.displayName, name: users.name, email: users.email } }).from(marketplaceVerifications).leftJoin(users, eq(marketplaceVerifications.userId, users.id));
  return status ? query.where(eq(marketplaceVerifications.status, status)).orderBy(desc(marketplaceVerifications.createdAt)) : query.orderBy(desc(marketplaceVerifications.createdAt));
}

export async function reviewMarketplaceVerification(input: { verificationId: string; status: "approved" | "rejected"; verificationNote?: string | null; reviewerUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const record = await db.select().from(marketplaceVerifications).where(eq(marketplaceVerifications.id, input.verificationId)).limit(1);
  if (!record[0]) throw new Error("Verification not found");
  if (input.status === "approved" && record[0].locationCountry !== "KH") throw new Error("Only Cambodia-eligible verification records can be approved");
  await db.update(marketplaceVerifications).set({ status: input.status, verificationNote: input.verificationNote?.trim() ?? null, reviewedByUserId: input.reviewerUserId, reviewedAt: new Date() }).where(eq(marketplaceVerifications.id, input.verificationId));
  return { success: true };
}

export async function updateGamePackage(input: { packageId: string; priceUsd: string; isActive: boolean; featured: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(gamePackages).set({ priceUsd: input.priceUsd, isActive: input.isActive, featured: input.featured }).where(eq(gamePackages.id, input.packageId));
  return { success: true };
}

export async function updateSmmTier(input: { tierId: string; priceUsd: string; isActive: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(smmTiers).set({ priceUsd: input.priceUsd, isActive: input.isActive }).where(eq(smmTiers.id, input.tierId));
  return { success: true };
}

export async function getPaymentTransactions() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ payment: paymentTransactions, order: orders }).from(paymentTransactions).leftJoin(orders, eq(paymentTransactions.orderId, orders.id)).orderBy(desc(paymentTransactions.createdAt));
}

export async function getAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, displayName: users.displayName, email: users.email, role: users.role, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt)).limit(100);
}

export async function getSiteContent() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(siteContent).orderBy(asc(siteContent.contentKey));
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
