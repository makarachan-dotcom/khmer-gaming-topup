import { randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  adminTestOrderAudits,
  gamePackages,
  gameProducts,
  orderStatusEvents,
  orders,
} from "../drizzle/schema";
import { fulfillTopupOrder, getDb } from "./db";
import { buildOrderNumber } from "./storefrontDomain";
import {
  ADMIN_TEST_ORDER_DAILY_LIMIT,
  ADMIN_TEST_ORDER_PRICE_USD,
} from "@shared/adminTestOrder";

const ADMIN_TEST_ORDER_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Name of the Vercel env var holding the secret admin test-purchase code.
 * The plaintext lives ONLY in Vercel's encrypted env storage (production
 * target); it is never committed, logged, or returned to any client.
 */
const PURCHASE_CODE_ENV_VAR = "ADMIN_TEST_PURCHASE_CODE";

/** Brute-force shield: max wrong purchase-code attempts per admin per window. */
export const ADMIN_TEST_PURCHASE_CODE_MAX_ATTEMPTS = 5;
const PURCHASE_CODE_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

// In-memory failed-code tracker (per server instance). Limitation: on
// Vercel's serverless platform each instance keeps its own counters, so a
// distributed attacker could squeeze a few extra attempts per instance. The
// window is short and the code space is large, which keeps this acceptable.
const failedCodeAttempts = new Map<number, { count: number; windowStart: number }>();

/** Test-only hook to reset the brute-force tracker between tests. */
export function __resetPurchaseCodeAttempts() {
  failedCodeAttempts.clear();
}

function readExpectedPurchaseCode(): string | null {
  const value = process.env[PURCHASE_CODE_ENV_VAR];
  return value && value.length > 0 ? value : null;
}

/** Constant-time comparison; safe when lengths differ. */
function purchaseCodesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function assertPurchaseCodeNotLocked(adminUserId: number) {
  const record = failedCodeAttempts.get(adminUserId);
  if (!record) return;
  if (Date.now() - record.windowStart >= PURCHASE_CODE_ATTEMPT_WINDOW_MS) {
    failedCodeAttempts.delete(adminUserId);
    return;
  }
  if (record.count >= ADMIN_TEST_PURCHASE_CODE_MAX_ATTEMPTS) {
    throw Object.assign(
      new Error("Too many wrong purchase codes. Please wait 15 minutes and try again."),
      { code: "ADMIN_TEST_PURCHASE_CODE_LOCKED" },
    );
  }
}

function recordFailedPurchaseCode(adminUserId: number) {
  const now = Date.now();
  const record = failedCodeAttempts.get(adminUserId);
  if (!record || now - record.windowStart >= PURCHASE_CODE_ATTEMPT_WINDOW_MS) {
    failedCodeAttempts.set(adminUserId, { count: 1, windowStart: now });
  } else {
    record.count += 1;
  }
}

/**
 * Check #2 of the test-order pipeline (after the admin-role middleware):
 * verifies the per-order secret purchase code with constant-time comparison.
 * Fails closed when the env var is not configured. The code is never logged.
 */
function verifyPurchaseCode(adminUserId: number, purchaseCode: string) {
  const expected = readExpectedPurchaseCode();
  if (!expected) {
    throw Object.assign(
      new Error("Admin test purchase is not configured. Set the purchase code first."),
      { code: "ADMIN_TEST_PURCHASE_CODE_UNCONFIGURED" },
    );
  }
  assertPurchaseCodeNotLocked(adminUserId);
  if (typeof purchaseCode !== "string" || purchaseCode.length === 0 || !purchaseCodesEqual(purchaseCode, expected)) {
    recordFailedPurchaseCode(adminUserId);
    throw Object.assign(new Error("Purchase code is incorrect."), { code: "ADMIN_TEST_PURCHASE_CODE_INVALID" });
  }
  failedCodeAttempts.delete(adminUserId);
}

function buildTrackingCode() {
  return `ZRS-${randomBytes(10).toString("hex").toUpperCase()}`;
}

type PurchasablePackage = {
  game: typeof gameProducts.$inferSelect;
  package: typeof gamePackages.$inferSelect;
};

/**
 * Same lookup the customer checkout uses: an active package joined to its
 * game, with a fallback for regional packages that stay live while the parent
 * game row is hidden. Lives here (instead of reusing db.ts internals) so this
 * module stays pushable without touching the 155 KB db.ts.
 */
async function resolvePurchasableTopupPackage(packageId: string): Promise<PurchasablePackage | null> {
  const db = await getDb();
  if (!db) return null;
  const active = await db
    .select({ game: gameProducts, package: gamePackages })
    .from(gamePackages)
    .innerJoin(gameProducts, eq(gamePackages.productId, gameProducts.id))
    .where(and(eq(gamePackages.id, packageId), eq(gamePackages.isActive, true), eq(gameProducts.isActive, true)))
    .limit(1);
  if (active[0]) return active[0];
  const packageActive = await db
    .select({ game: gameProducts, package: gamePackages })
    .from(gamePackages)
    .innerJoin(gameProducts, eq(gamePackages.productId, gameProducts.id))
    .where(and(eq(gamePackages.id, packageId), eq(gamePackages.isActive, true), eq(gamePackages.providerAuthorized, true)))
    .limit(1);
  return packageActive[0] ?? null;
}

function isFreeFireItem(item: PurchasablePackage) {
  const providerSource = String(item.package.providerSource ?? "");
  return (
    /^fzr_cards:free_fire(?:_|:|$)/i.test(providerSource) ||
    /free[\s_-]*fire/i.test(`${item.game.titleEn} ${item.game.titleKh}`)
  );
}

function isRobloxItem(item: PurchasablePackage) {
  const providerSource = String(item.package.providerSource ?? "");
  return /roblox|robux/i.test(`${providerSource} ${item.game.titleEn} ${item.game.titleKh}`);
}

function isMobileLegendsItem(item: PurchasablePackage) {
  const providerSource = String(item.package.providerSource ?? "");
  return /mobile[\s_-]*legends/i.test(`${providerSource} ${item.game.titleEn} ${item.game.titleKh}`);
}

/**
 * Creates an admin test order: a real top-up order for ANY catalog package at
 * the fixed $0.01 test price, with no KHQR/payment step, fulfilled through the
 * normal provider path so the top-up actually executes.
 *
 * Security properties (all server-side):
 * - Callable only through `scopedAdminProcedure("orders")` in the router —
 *   unauthenticated and non-admin callers are rejected before this runs.
 * - Check order: (1) admin role [router middleware], (2) purchase code,
 *   (3) rate limit, (4) order creation.
 * - Every order requires the secret purchase code, verified with
 *   constant-time comparison against the ADMIN_TEST_PURCHASE_CODE env var;
 *   fails closed when unconfigured. Max 5 wrong attempts per admin per
 *   15 minutes (in-memory; see note on failedCodeAttempts).
 * - The input carries NO price. The charged price is always the
 *   ADMIN_TEST_ORDER_PRICE_USD constant.
 * - The order is flagged `details.adminTestOrder: true` (deliberately NOT
 *   `details.testPurchase`, which would suppress provider fulfillment).
 * - Every test order writes an audit row; the same table enforces the
 *   per-admin rolling-24h rate limit.
 */
export async function createAdminTestTopupOrder(input: {
  adminUserId: number;
  packageId: string;
  playerId: string;
  zoneId?: string | null;
  purchaseCode: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const adminUserId = input.adminUserId;
  if (!Number.isInteger(adminUserId) || adminUserId <= 0) throw new Error("Invalid admin user");

  const playerId = input.playerId?.trim() ?? "";
  if (playerId.length < 2 || playerId.length > 128) throw new Error("Player ID is invalid");
  const zoneId = input.zoneId?.trim() ? input.zoneId.trim() : null;
  if (zoneId && zoneId.length > 128) throw new Error("Zone ID is invalid");

  // Check #2: purchase code, before any rate-limit accounting or order work.
  verifyPurchaseCode(adminUserId, input.purchaseCode);

  const item = await resolvePurchasableTopupPackage(input.packageId);
  if (!item) throw new Error("Selected game package is unavailable");

  // Same game-specific requirements as the customer checkout.
  if (isRobloxItem(item)) throw new Error("Roblox packages cannot be test-purchased (they need an account login)");
  if ((item.game.requiresZone || isMobileLegendsItem(item)) && !isFreeFireItem(item) && !zoneId) {
    throw new Error("Server or zone ID is required for this game");
  }

  // Rolling-24h rate limit, enforced server-side before anything is created.
  const windowStart = new Date(Date.now() - ADMIN_TEST_ORDER_WINDOW_MS);
  const recent = await db
    .select({ id: adminTestOrderAudits.id })
    .from(adminTestOrderAudits)
    .where(and(eq(adminTestOrderAudits.adminUserId, adminUserId), gt(adminTestOrderAudits.createdAt, windowStart)));
  if (recent.length >= ADMIN_TEST_ORDER_DAILY_LIMIT) {
    throw Object.assign(
      new Error(`Admin test purchase limit reached (${ADMIN_TEST_ORDER_DAILY_LIMIT} per 24 hours).`),
      { code: "ADMIN_TEST_ORDER_LIMIT" },
    );
  }

  const id = nanoid();
  const orderNumber = buildOrderNumber();
  const trackingCode = buildTrackingCode();
  const packageLabel = `${item.game.titleEn} • ${item.package.amountLabel}`;

  // NOTE: subtotal is the server constant, never the package's catalog price
  // and never anything from the client.
  await db.insert(orders).values({
    id,
    orderNumber,
    trackingCode,
    userId: adminUserId,
    orderType: "topup",
    status: "paid",
    currency: "USD",
    subtotal: ADMIN_TEST_ORDER_PRICE_USD,
    productName: `${packageLabel} ${item.game.currencyLabel}`,
    details: {
      packageId: item.package.id,
      gameProductId: item.game.id,
      playerId,
      zoneId,
      quantity: 1,
      adminTestOrder: true,
      testPriceUsd: ADMIN_TEST_ORDER_PRICE_USD,
      noPayment: true,
    },
  });
  await db.insert(orderStatusEvents).values({
    id: nanoid(),
    orderId: id,
    eventType: "admin_test_order_created",
    status: "paid",
    actorType: "admin",
    messageKh: "Admin បានបង្កើត test order តម្លៃ $0.01 (មិនមានការបង់ប្រាក់ពិត)។",
  });
  await db.insert(adminTestOrderAudits).values({
    id: nanoid(),
    orderId: id,
    adminUserId,
    packageId: item.package.id,
    packageName: packageLabel,
    playerId,
    priceUsd: ADMIN_TEST_ORDER_PRICE_USD,
  });

  // Through the NORMAL fulfillment path so the top-up actually executes.
  // fulfillTopupOrder is idempotent and flags manual review on provider failure.
  try {
    await fulfillTopupOrder(id);
  } catch {
    /* flagged inside fulfillTopupOrder */
  }

  return {
    id,
    orderNumber,
    trackingCode,
    amount: ADMIN_TEST_ORDER_PRICE_USD,
    status: "paid" as const,
    packageName: packageLabel,
  };
}

/** Recent test orders by one admin, for the admin panel's history list. */
export async function getAdminTestOrders(input: { adminUserId: number; limit?: number }) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50);
  return db
    .select()
    .from(adminTestOrderAudits)
    .where(eq(adminTestOrderAudits.adminUserId, input.adminUserId))
    .orderBy(desc(adminTestOrderAudits.createdAt))
    .limit(limit);
}
