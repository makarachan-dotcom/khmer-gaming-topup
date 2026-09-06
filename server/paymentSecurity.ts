import crypto from "node:crypto";
import { redisRelease, redisSetIfAbsent } from "./rateLimit";

/**
 * Payment hardening / anti-cheat primitives.
 *
 * Threat model this module defends against:
 *
 * 1. **Webhook replay** — a valid signed `payment.paid` body is captured (proxy,
 *    log leak, worker compromise) and re-posted to credit an order twice. The
 *    HMAC alone cannot stop this because a replayed body has a *valid*
 *    signature. We add a freshness window plus a single-use nonce.
 * 2. **Signature brute force / oracle probing** — unbounded webhook posting.
 * 3. **Price tampering** — a catalog row edited (directly, or through a
 *    compromised admin session) to sell below provider cost, at zero, or at an
 *    absurd amount. The storefront never sends a price, but the *row* is still
 *    an input we must validate before it becomes an order total.
 * 4. **Amount / currency mismatch** — paying 100 KHR for a $50 order by
 *    reusing another session's QR, or float drift making 1.999 pass as 2.00.
 * 5. **Session stacking & velocity abuse** — one account (or one device) opening
 *    many QR sessions to hold provider stock or farm race conditions.
 *
 * Everything here is pure and side-effect free except the replay guard, which
 * needs shared state. All comparisons that touch money use integer minor units
 * so no floating point rounding can ever widen an accepted range.
 */

/** A signed callback older than this is refused even if the HMAC is valid. */
export const webhookTimestampToleranceMs = 5 * 60 * 1000;

/** How long a consumed callback nonce stays blocked. */
export const webhookReplayTtlMs = 24 * 60 * 60 * 1000;

/** Hard ceiling for a single order. Blocks absurd totals from a tampered row. */
export const maxOrderAmountUsd = 2_000;
export const maxOrderAmountKhr = 8_000_000;

/** Money below this is treated as a misconfigured/zeroed price, not a promo. */
export const minOrderAmountUsd = 0.01;

/** Accepted margin band. Outside it, the catalog row is considered tampered. */
export const maxProfitMarginPercent = 1_000;

export type PaymentSecurityFailure = {
  code: string;
  /** Safe to log. Never contains secrets or raw customer identifiers. */
  detail: string;
};

export class PaymentSecurityError extends Error {
  readonly code: string;

  constructor(failure: PaymentSecurityFailure) {
    super(failure.detail);
    this.name = "PaymentSecurityError";
    this.code = failure.code;
  }
}

function fail(code: string, detail: string): never {
  throw new PaymentSecurityError({ code, detail });
}

/* ------------------------------------------------------------------ money */

/**
 * Converts a money value to integer minor units (cents / riel).
 *
 * Returns `null` for anything that is not a clean, finite, non-negative decimal
 * within the currency's precision — including `"1e3"`, `"0x10"`, `"2.005"`,
 * `"2,00"`, `"-2.00"`, `NaN` and `Infinity`. A permissive `Number()` is how
 * amount-confusion bugs get in, so every one of those is refused.
 *
 * Surrounding whitespace *is* tolerated (`" 2.00 "` parses as 200). Padding is
 * unambiguous, unlike notation and precision, and these values arrive from
 * decimal columns and signed worker payloads: refusing them would strand a real
 * payment rather than prevent a fraudulent one. Internal whitespace (`"2 0"`)
 * is still rejected.
 */
export function toMinorUnits(value: string | number, currency: "KHR" | "USD"): number | null {
  const raw = typeof value === "number" ? (Number.isInteger(value) ? String(value) : value.toFixed(4)) : value;
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!/^\d{1,12}(\.\d{1,4})?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  // KHR is a zero-decimal currency in Bakong; USD carries two.
  const scale = currency === "KHR" ? 0 : 2;
  const padded = (fraction + "0000").slice(0, 4);
  const extra = padded.slice(scale);
  if (/[1-9]/.test(extra)) return null; // more precision than the currency allows
  const minor = Number(whole) * 10 ** scale + Number(padded.slice(0, scale) || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Exact money equality in minor units. No epsilon, no float compare. */
export function moneyEquals(left: string | number, right: string | number, currency: "KHR" | "USD") {
  const a = toMinorUnits(left, currency);
  const b = toMinorUnits(right, currency);
  return a !== null && b !== null && a === b;
}

/**
 * Validates an order total before it is written to the ledger or turned into a
 * QR. Rejects zero, negative, over-precise and out-of-band amounts.
 */
export function assertOrderAmountIntegrity(input: { amount: string | number; currency: "KHR" | "USD" }) {
  const minor = toMinorUnits(input.amount, input.currency);
  if (minor === null) fail("AMOUNT_MALFORMED", `order amount is not a valid ${input.currency} value`);
  if (minor <= 0) fail("AMOUNT_NOT_POSITIVE", "order amount must be greater than zero");
  const ceiling = input.currency === "KHR" ? maxOrderAmountKhr : Math.round(maxOrderAmountUsd * 100);
  if (minor > ceiling) fail("AMOUNT_ABOVE_CEILING", `order amount exceeds the ${input.currency} ceiling`);
  if (input.currency === "USD" && minor < Math.round(minOrderAmountUsd * 100)) fail("AMOUNT_BELOW_FLOOR", "order amount is below the USD floor");
  return { minorUnits: minor };
}

/**
 * Anti-cheat for the catalog row itself.
 *
 * The sale price is always recomputed from `basePriceUsd + profitMarginPercent`
 * and compared against the stored `priceUsd`. If they disagree by more than one
 * cent, or the row would sell below provider cost, the order is refused. This
 * catches a tampered price column, a half-finished margin edit, and a stale row
 * left behind by a failed provider sync — all before a customer can pay.
 */
export function assertPackagePriceIntegrity(input: {
  priceUsd: string | number;
  basePriceUsd?: string | number | null;
  profitMarginPercent?: string | number | null;
  quantity: number;
}) {
  if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 9) fail("QUANTITY_OUT_OF_RANGE", "quantity must be an integer between 1 and 9");

  const priceMinor = toMinorUnits(input.priceUsd, "USD");
  if (priceMinor === null) fail("PRICE_MALFORMED", "package price is not a valid USD value");
  if (priceMinor <= 0) fail("PRICE_NOT_POSITIVE", "package price must be greater than zero");

  const baseProvided = input.basePriceUsd !== null && input.basePriceUsd !== undefined && String(input.basePriceUsd).trim() !== "";
  const baseMinor = baseProvided ? toMinorUnits(input.basePriceUsd as string | number, "USD") : null;
  if (baseProvided && baseMinor === null) fail("BASE_PRICE_MALFORMED", "package base price is not a valid USD value");
  // `basePriceUsd` defaults to 0.00 in the schema, so a zero base means "cost not
  // recorded yet", not "free". Cross-checking against it would reject every
  // legacy row that predates margin tracking, so the cost-derived checks are
  // skipped and only the absolute bounds above apply.
  if (baseMinor !== null && baseMinor > 0) {
    // Selling under provider cost is always a configuration or tamper problem.
    if (priceMinor < baseMinor) fail("PRICE_BELOW_COST", "package price is below provider cost");

    const marginRaw = input.profitMarginPercent === null || input.profitMarginPercent === undefined ? "0" : String(input.profitMarginPercent).trim();
    const margin = Number(marginRaw);
    if (!Number.isFinite(margin) || margin < 0) fail("MARGIN_MALFORMED", "profit margin is not a valid percentage");
    if (margin > maxProfitMarginPercent) fail("MARGIN_ABOVE_CEILING", "profit margin exceeds the allowed ceiling");

    const expectedMinor = Math.round(baseMinor * (1 + margin / 100));
    // One cent of slack absorbs legitimate rounding in the stored column.
    if (Math.abs(expectedMinor - priceMinor) > 1) fail("PRICE_MARGIN_MISMATCH", "stored price does not match base price and margin");
  }

  const subtotalMinor = priceMinor * input.quantity;
  const subtotal = (subtotalMinor / 100).toFixed(2);
  assertOrderAmountIntegrity({ amount: subtotal, currency: "USD" });
  return { subtotal, subtotalMinor };
}

/* --------------------------------------------------------------- webhooks */

/**
 * Freshness gate for signed callbacks. A replayed body keeps its valid HMAC
 * forever, so time is the only thing that can invalidate it cheaply.
 * Future-dated stamps are rejected with the same tolerance to stop clock-skew
 * abuse from extending a capture's usable life.
 */
export function isFreshWebhookTimestamp(timestamp: string | number | undefined, now = Date.now(), toleranceMs = webhookTimestampToleranceMs) {
  if (timestamp === undefined || timestamp === null) return false;
  const parsed = typeof timestamp === "number" ? timestamp : Date.parse(String(timestamp));
  if (!Number.isFinite(parsed)) return false;
  return Math.abs(now - parsed) <= toleranceMs;
}

/**
 * Stable single-use identity for a callback. Built from the fields that decide
 * money movement, so an attacker cannot get a fresh nonce by editing padding.
 */
export function webhookReplayKey(callback: { event: string; md5: string; orderId: string; amount: string | number; currency: string; timestamp: string }) {
  const canonical = [callback.event, callback.md5.toLowerCase(), callback.orderId, String(callback.amount), callback.currency, callback.timestamp].join("|");
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 40);
}

const seenWebhookNonces = new Map<string, number>();

function memoryConsumeNonce(key: string, ttlMs: number) {
  const now = Date.now();
  // Use forEach, not `for...of`, over this Map. tsconfig.json declares no
  // "target", so tsc defaults to ES5 and `pnpm check` rejects Map iteration
  // (TS2802) even though "lib" is esnext. Map.prototype.forEach needs no
  // downlevel iteration. Deleting while iterating is safe: an entry removed
  // before it is visited is simply skipped.
  seenWebhookNonces.forEach((expiry, nonce) => {
    if (expiry <= now) seenWebhookNonces.delete(nonce);
  });
  if (seenWebhookNonces.has(key)) return false;
  if (seenWebhookNonces.size > 20_000) seenWebhookNonces.clear();
  seenWebhookNonces.set(key, now + ttlMs);
  return true;
}

/**
 * Marks a callback as consumed. Returns `false` when it has been seen before,
 * which the caller must treat as a replay and refuse.
 *
 * Redis is authoritative when configured (serverless instances do not share
 * memory). If Redis is configured but unreachable we fail **closed** — for a
 * money-moving callback, a short outage is strictly better than an unbounded
 * replay window. The worker retries, so a refused delivery is not a lost payment.
 */
export async function consumeWebhookNonce(key: string, ttlMs = webhookReplayTtlMs): Promise<boolean> {
  try {
    const stored = await redisSetIfAbsent(`pay:nonce:${key}`, ttlMs);
    if (stored === null) return memoryConsumeNonce(key, ttlMs);
    return stored;
  } catch (error) {
    console.error("[paymentSecurity] replay guard unavailable, failing closed", error);
    return false;
  }
}

/**
 * Releases a claimed nonce so the worker's retry can be processed.
 *
 * Called only when processing failed for a transient reason. Without this a
 * single database hiccup would block that settlement permanently — the replay
 * guard must never be able to strand a real payment.
 */
export async function releaseWebhookNonce(key: string): Promise<void> {
  seenWebhookNonces.delete(key);
  await redisRelease(`pay:nonce:${key}`);
}

/** Clears the in-memory nonce cache. Tests only. */
export function resetWebhookNonceCacheForTests() {
  seenWebhookNonces.clear();
}

/**
 * Length-safe constant-time comparison for hex signatures.
 * `crypto.timingSafeEqual` throws on a length mismatch, and comparing lengths
 * first would leak length through timing, so both sides are hashed to a fixed
 * width before the constant-time compare.
 */
export function safeSignatureEquals(received: string | undefined, expected: string) {
  if (!received) return false;
  const left = crypto.createHash("sha256").update(received.trim().toLowerCase()).digest();
  const right = crypto.createHash("sha256").update(expected.trim().toLowerCase()).digest();
  return crypto.timingSafeEqual(left, right);
}

/* --------------------------------------------------------------- velocity */

export type OrderVelocitySample = { createdAt: Date | string | number; status?: string };

/**
 * Behavioural anti-cheat. Distinguishes a customer who retries a failed payment
 * from an account farming sessions: many *unpaid* orders in a short window with
 * no completed payment is the pattern worth blocking.
 */
export function assessOrderVelocity(samples: OrderVelocitySample[], options: { now?: number; windowMs?: number; maxUnpaid?: number } = {}) {
  const now = options.now ?? Date.now();
  const windowMs = options.windowMs ?? 60 * 60 * 1000;
  const maxUnpaid = options.maxUnpaid ?? 12;
  const paidStatuses = new Set(["paid", "delivered", "refunded"]);
  let unpaid = 0;
  let settled = 0;
  for (const sample of samples) {
    const stamp = sample.createdAt instanceof Date ? sample.createdAt.getTime() : typeof sample.createdAt === "number" ? sample.createdAt : Date.parse(String(sample.createdAt));
    if (!Number.isFinite(stamp) || now - stamp > windowMs) continue;
    if (paidStatuses.has(String(sample.status ?? ""))) settled += 1;
    else unpaid += 1;
  }
  const blocked = unpaid >= maxUnpaid && settled === 0;
  return { unpaid, settled, blocked, reason: blocked ? ("ORDER_VELOCITY_BLOCKED" as const) : null };
}
