import { createHash, randomBytes } from "node:crypto";

export const LIVE_SPIN_MINIMUM_QUALIFIED_ORDER_USD = 1;
export const LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET = 7;
export const LIVE_SPIN_MINIMUM_PARTICIPANT_COUNT = 100;
export const LIVE_SPIN_DEFAULT_SPOILER_SECONDS = 5;
export const LIVE_SPIN_DEFAULT_PRIZE_COUNTDOWN_SECONDS = 5;
export const LIVE_SPIN_TIMEZONE = "Asia/Phnom_Penh";

export type LiveSpinEligibleOrder = {
  id: string;
  userId: number;
  status: "paid" | "delivered" | "pending" | "awaiting_payment" | "failed" | "expired" | "refunded";
  currency: string;
  subtotal: string | number;
  completedAt: Date;
};

export type LiveSpinSnapshotEntry = {
  entryIndex: number;
  ticketId: string;
  userId: number;
  displayAlias: string;
};

export type LiveSpinSelection = {
  winnerIndex: number;
  prizeIndex: number;
  selectionProofHash: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function formatWeekDate(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

/**
 * The promotion cycle starts at Sunday 00:00 in Asia/Phnom_Penh. Cambodia has
 * a fixed UTC+7 offset, so this avoids server-local timezone ambiguity.
 */
export function liveSpinWeekKey(value: Date) {
  const phnomPenh = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  phnomPenh.setUTCHours(0, 0, 0, 0);
  phnomPenh.setUTCDate(phnomPenh.getUTCDate() - phnomPenh.getUTCDay());
  return formatWeekDate(phnomPenh);
}

export function isLiveSpinEligibleOrder(order: LiveSpinEligibleOrder) {
  const paid = order.status === "paid" || order.status === "delivered";
  const usd = order.currency.trim().toUpperCase() === "USD";
  const amount = typeof order.subtotal === "number" ? order.subtotal : Number(order.subtotal);
  return paid && usd && Number.isFinite(amount) && amount >= LIVE_SPIN_MINIMUM_QUALIFIED_ORDER_USD;
}

export function ticketCountForQualifiedOrders(qualifiedOrderCount: number) {
  return Math.max(0, Math.floor(Math.max(0, qualifiedOrderCount) / LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET));
}

export function progressForQualifiedOrders(qualifiedOrderCount: number) {
  const normalized = Math.max(0, qualifiedOrderCount);
  const completed = normalized % LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET;
  return {
    completed,
    remaining: completed === 0 ? LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET : LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET - completed,
    required: LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET,
  };
}

export function createLiveSpinFairnessSeed() {
  // CSPRNG source; this value never reaches a client until the event has ended.
  return randomBytes(32).toString("hex");
}

export function liveSpinFairnessCommitment(seed: string) {
  if (!/^[a-f0-9]{64}$/i.test(seed)) throw new Error("Fairness seed must be a 32-byte hexadecimal value");
  return sha256(seed.toLowerCase());
}

export function liveSpinSnapshotHash(entries: LiveSpinSnapshotEntry[]) {
  const canonical = [...entries]
    .sort((left, right) => left.entryIndex - right.entryIndex)
    .map(({ entryIndex, ticketId, userId, displayAlias }) => ({ entryIndex, ticketId, userId, displayAlias }));
  return sha256(JSON.stringify(canonical));
}

/**
 * Derives an unbiased index from the hidden CSPRNG seed. Rejection sampling is
 * used instead of modulo on the full hash range, so every index has equal odds.
 */
export function deriveFairIndex(seed: string, context: string, itemCount: number) {
  if (!Number.isInteger(itemCount) || itemCount < 1) throw new Error("At least one selection item is required");
  const range = BigInt(1) << BigInt(256);
  const count = BigInt(itemCount);
  const acceptableRange = range - (range % count);
  for (let nonce = 0; nonce < 1024; nonce += 1) {
    const candidate = BigInt(`0x${sha256(`${seed}:${context}:${nonce}`)}`);
    if (candidate < acceptableRange) return Number(candidate % count);
  }
  throw new Error("Unable to derive an unbiased fair index");
}

export function selectLiveSpinOutcome(input: { eventId: string; seed: string; snapshotHash: string; entryCount: number; prizeCount: number }): LiveSpinSelection {
  const winnerIndex = deriveFairIndex(input.seed, `${input.eventId}:${input.snapshotHash}:winner`, input.entryCount);
  const prizeIndex = deriveFairIndex(input.seed, `${input.eventId}:${input.snapshotHash}:prize`, input.prizeCount);
  return {
    winnerIndex,
    prizeIndex,
    selectionProofHash: sha256(`${input.eventId}:${input.snapshotHash}:${input.seed}:${winnerIndex}:${prizeIndex}`),
  };
}

export function verifyLiveSpinOutcome(input: { eventId: string; seed: string; commitmentHash: string; snapshotHash: string; entryCount: number; prizeCount: number; result: LiveSpinSelection }) {
  if (liveSpinFairnessCommitment(input.seed) !== input.commitmentHash.toLowerCase()) return false;
  const expected = selectLiveSpinOutcome(input);
  return expected.winnerIndex === input.result.winnerIndex
    && expected.prizeIndex === input.result.prizeIndex
    && expected.selectionProofHash === input.result.selectionProofHash;
}
