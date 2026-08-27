import { describe, expect, it } from "vitest";
import { LIVE_SPIN_DEFAULT_PRIZE_COUNTDOWN_SECONDS, LIVE_SPIN_DEFAULT_SPOILER_SECONDS, LIVE_SPIN_MINIMUM_PARTICIPANT_COUNT, LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET, createLiveSpinFairnessSeed, deriveFairIndex, isLiveSpinEligibleOrder, liveSpinFairnessCommitment, liveSpinRulesSnapshotHash, liveSpinSnapshotHash, liveSpinWeekKey, progressForQualifiedOrders, selectLiveSpinOutcome, selectLiveSpinRankedOutcomes, ticketCountForQualifiedOrders, verifyLiveSpinOutcome } from "./liveSpinFairness";

describe("Live Spin ticket eligibility", () => {
  const completedAt = new Date("2026-08-30T08:00:00.000Z");

  it("counts only confirmed paid or delivered USD orders worth at least one dollar", () => {
    expect(isLiveSpinEligibleOrder({ id: "paid", userId: 1, status: "paid", currency: "USD", subtotal: "1.00", completedAt })).toBe(true);
    expect(isLiveSpinEligibleOrder({ id: "delivered", userId: 1, status: "delivered", currency: "usd", subtotal: 1.5, completedAt })).toBe(true);
    expect(isLiveSpinEligibleOrder({ id: "small", userId: 1, status: "paid", currency: "USD", subtotal: "0.99", completedAt })).toBe(false);
    expect(isLiveSpinEligibleOrder({ id: "pending", userId: 1, status: "awaiting_payment", currency: "USD", subtotal: "4.00", completedAt })).toBe(false);
    expect(isLiveSpinEligibleOrder({ id: "refunded", userId: 1, status: "refunded", currency: "USD", subtotal: "4.00", completedAt })).toBe(false);
    expect(isLiveSpinEligibleOrder({ id: "other-currency", userId: 1, status: "paid", currency: "KHR", subtotal: "4000", completedAt })).toBe(false);
  });

  it("issues one ticket per seven qualified orders and exposes the next-ticket progress", () => {
    expect(LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET).toBe(7);
    expect(ticketCountForQualifiedOrders(6)).toBe(0);
    expect(ticketCountForQualifiedOrders(7)).toBe(1);
    expect(ticketCountForQualifiedOrders(14)).toBe(2);
    expect(progressForQualifiedOrders(5)).toEqual({ completed: 5, remaining: 2, required: 7 });
    expect(progressForQualifiedOrders(7)).toEqual({ completed: 0, remaining: 7, required: 7 });
  });

  it("uses a Sunday-start Phnom Penh weekly cycle", () => {
    expect(liveSpinWeekKey(new Date("2026-08-29T16:59:59.000Z"))).toBe("2026-08-23");
    expect(liveSpinWeekKey(new Date("2026-08-29T17:00:00.000Z"))).toBe("2026-08-30");
  });
});

describe("Live Spin provably fair selection", () => {
  const entries = [
    { entryIndex: 0, ticketId: "ticket-a", userId: 11, displayAlias: "ZRS_AAAA" },
    { entryIndex: 1, ticketId: "ticket-b", userId: 22, displayAlias: "ZRS_BBBB" },
    { entryIndex: 2, ticketId: "ticket-c", userId: 33, displayAlias: "ZRS_CCCC" },
  ];

  it("uses a server-created CSPRNG seed and commits only its SHA-256 hash before the result", () => {
    const seed = createLiveSpinFairnessSeed();
    expect(seed).toMatch(/^[a-f0-9]{64}$/);
    expect(liveSpinFairnessCommitment(seed)).toMatch(/^[a-f0-9]{64}$/);
    expect(liveSpinFairnessCommitment(seed)).not.toBe(seed);
  });

  it("derives stable, bounded winner and prize indices from a locked entry snapshot", () => {
    const seed = "96d5a235407d4258e516629508b518f59618913a153a9dd0739b97e93e1a4d92";
    const snapshotHash = liveSpinSnapshotHash(entries);
    const first = selectLiveSpinOutcome({ eventId: "event-1", seed, snapshotHash, entryCount: entries.length, prizeCount: 10 });
    const second = selectLiveSpinOutcome({ eventId: "event-1", seed, snapshotHash, entryCount: entries.length, prizeCount: 10 });
    expect(first).toEqual(second);
    expect(first.winnerIndex).toBeGreaterThanOrEqual(0);
    expect(first.winnerIndex).toBeLessThan(entries.length);
    expect(first.prizeIndex).toBeGreaterThanOrEqual(0);
    expect(first.prizeIndex).toBeLessThan(10);
    expect(deriveFairIndex(seed, "sample", 1)).toBe(0);
  });

  it("selects distinct ranked winners without replacement and binds the result to locked rules", () => {
    const seed = "96d5a235407d4258e516629508b518f59618913a153a9dd0739b97e93e1a4d92";
    const snapshotHash = liveSpinSnapshotHash(entries);
    const settings = liveSpinRulesSnapshotHash({ minParticipantCount: 100, winnerCount: 3, consolationGiftCount: 10, prizeTierIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"] });
    const outcome = selectLiveSpinRankedOutcomes({ eventId: "event-1", seed, snapshotHash, settingsSnapshotHash: settings, entryCount: entries.length, winnerCount: 3, prizeCount: 10 });
    expect(outcome.selections.map((selection) => selection.winnerIndex)).toHaveLength(3);
    expect(new Set(outcome.selections.map((selection) => selection.winnerIndex)).size).toBe(3);
    expect(outcome.selections.map((selection) => selection.prizeIndex)).toEqual([0, 1, 2]);
    expect(selectLiveSpinRankedOutcomes({ eventId: "event-1", seed, snapshotHash, settingsSnapshotHash: settings, entryCount: entries.length, winnerCount: 3, prizeCount: 10 })).toEqual(outcome);
    expect(selectLiveSpinRankedOutcomes({ eventId: "event-1", seed, snapshotHash, settingsSnapshotHash: liveSpinRulesSnapshotHash({ minParticipantCount: 100, winnerCount: 3, consolationGiftCount: 9, prizeTierIds: ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10"] }), entryCount: entries.length, winnerCount: 3, prizeCount: 10 }).selectionProofHash).not.toBe(outcome.selectionProofHash);
  });

  it("verifies a revealed seed and rejects a modified winner, seed, or entry snapshot", () => {
    const seed = "96d5a235407d4258e516629508b518f59618913a153a9dd0739b97e93e1a4d92";
    const snapshotHash = liveSpinSnapshotHash(entries);
    const result = selectLiveSpinOutcome({ eventId: "event-1", seed, snapshotHash, entryCount: entries.length, prizeCount: 10 });
    const base = { eventId: "event-1", seed, commitmentHash: liveSpinFairnessCommitment(seed), snapshotHash, entryCount: entries.length, prizeCount: 10, result };
    expect(verifyLiveSpinOutcome(base)).toBe(true);
    expect(verifyLiveSpinOutcome({ ...base, result: { ...result, winnerIndex: (result.winnerIndex + 1) % entries.length } })).toBe(false);
    expect(verifyLiveSpinOutcome({ ...base, seed: "86d5a235407d4258e516629508b518f59618913a153a9dd0739b97e93e1a4d92" })).toBe(false);
    expect(verifyLiveSpinOutcome({ ...base, snapshotHash: liveSpinSnapshotHash(entries.map((entry, index) => index === 1 ? { ...entry, displayAlias: "ZRS_CHANGED" } : entry)) })).toBe(false);
  });

  it("locks the agreed participant threshold and both five-second presentation delays", () => {
    expect(LIVE_SPIN_MINIMUM_PARTICIPANT_COUNT).toBe(100);
    expect(LIVE_SPIN_DEFAULT_SPOILER_SECONDS).toBe(5);
    expect(LIVE_SPIN_DEFAULT_PRIZE_COUNTDOWN_SECONDS).toBe(5);
  });
});
