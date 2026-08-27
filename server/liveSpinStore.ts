import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import { liveSpinAuditLogs, liveSpinEntries, liveSpinEvents, liveSpinPrizeTiers, liveSpinQualifiedOrders, liveSpinResults, liveSpinTickets, orders, paymentTransactions, users } from "../drizzle/schema";
import { decryptCredential, encryptCredential, type CredentialEnvelope } from "./credentialEnvelope";
import { getDb } from "./db";
import { LIVE_SPIN_DEFAULT_PRIZE_COUNTDOWN_SECONDS, LIVE_SPIN_DEFAULT_SPOILER_SECONDS, LIVE_SPIN_MINIMUM_PARTICIPANT_COUNT, LIVE_SPIN_NAME_STRIP_SECONDS, LIVE_SPIN_PRIZE_REVEAL_SECONDS, LIVE_SPIN_QUALIFIED_ORDERS_PER_TICKET, createLiveSpinFairnessSeed, isLiveSpinEligibleOrder, liveSpinFairnessCommitment, liveSpinSnapshotHash, liveSpinWeekKey, progressForQualifiedOrders, selectLiveSpinOutcome, ticketCountForQualifiedOrders } from "./liveSpinFairness";

export const liveSpinEventStatuses = ["draft", "announced", "locked", "waiting", "live", "winner_revealed", "prize_countdown", "prize_revealed", "ended", "skipped"] as const;
export type LiveSpinEventStatus = (typeof liveSpinEventStatuses)[number];

function ensureDb<T>(db: T | null): T {
  if (!db) throw new Error("Live Spin requires the primary database.");
  return db;
}

function displayAlias(eventId: string, userId: number) {
  // A deterministic event-specific alias lets viewers follow the draw without exposing account identifiers.
  return `ZRS-${createHash("sha256").update(`${eventId}:${userId}`).digest("hex").slice(0, 5).toUpperCase()}`;
}

function assertWeeklySundayThreePm(scheduledAt: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Phnom_Penh", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(scheduledAt);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (values.weekday !== "Sun" || values.hour !== "15" || values.minute !== "00") throw new Error("Live Spin must be scheduled for Sunday at 3:00 PM (Asia/Phnom_Penh).");
}

function assertAnnouncementWindow(scheduledAt: Date, announcementStartsAt: Date) {
  const leadTime = scheduledAt.getTime() - announcementStartsAt.getTime();
  const minimumLeadTime = 24 * 60 * 60_000;
  const maximumLeadTime = 48 * 60 * 60_000;
  if (leadTime < minimumLeadTime || leadTime > maximumLeadTime) {
    throw new Error("Announcement must begin 24 to 48 hours before Live Spin.");
  }
}

function encryptedSeed(seed: string) {
  return JSON.stringify(encryptCredential(seed));
}

function decryptedSeed(payload: string | null) {
  if (!payload) throw new Error("The fairness seed is unavailable.");
  return decryptCredential(JSON.parse(payload) as CredentialEnvelope);
}

async function appendAudit(input: { eventId?: string | null; actorUserId?: number | null; actorType: "system" | "owner"; action: string; details: Record<string, unknown> }) {
  const db = ensureDb(await getDb());
  await db.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: input.eventId ?? null, actorUserId: input.actorUserId ?? null, actorType: input.actorType, action: input.action, details: input.details });
}

async function qualifyingOrdersForWeek(weekKey: string) {
  const db = ensureDb(await getDb());
  const rows = await db.select({
    id: orders.id,
    userId: orders.userId,
    status: orders.status,
    currency: orders.currency,
    subtotal: orders.subtotal,
    completedAt: paymentTransactions.paidAt,
  }).from(orders).innerJoin(paymentTransactions, eq(paymentTransactions.orderId, orders.id)).where(and(inArray(orders.status, ["paid", "delivered"]), eq(paymentTransactions.status, "paid")));

  return rows.filter((row) => {
    const completedAt = row.completedAt;
    if (!completedAt) return false;
    return liveSpinWeekKey(completedAt) === weekKey && isLiveSpinEligibleOrder({ ...row, completedAt });
  });
}

/**
 * Rebuilds the current weekly qualified-order ledger from paid transaction data.
 * A unique order id prevents duplicate credit when payment callbacks are retried.
 * Ticket counts are derived only from this week's valid completed orders, so
 * partial progress is never carried into a later week.
 */
export async function syncLiveSpinTicketsForWeek(weekKey = liveSpinWeekKey(new Date())) {
  const db = ensureDb(await getDb());
  const qualifyingOrders = await qualifyingOrdersForWeek(weekKey);
  const byUser = new Map<number, typeof qualifyingOrders>();
  for (const order of qualifyingOrders) byUser.set(order.userId, [...(byUser.get(order.userId) ?? []), order]);

  await db.transaction(async (tx) => {
    for (const [userId, userOrders] of Array.from(byUser.entries())) {
      // Serializes the same user's ticket calculation across concurrent payment callbacks.
      await tx.execute(sql`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`);
      for (const order of userOrders) {
        await tx.insert(liveSpinQualifiedOrders).values({ id: nanoid(), userId, orderId: order.id, weekKey }).onDuplicateKeyUpdate({ set: { weekKey } });
      }

      const persistedOrders = await tx.select({ id: liveSpinQualifiedOrders.id }).from(liveSpinQualifiedOrders).where(and(eq(liveSpinQualifiedOrders.userId, userId), eq(liveSpinQualifiedOrders.weekKey, weekKey)));
      const desiredTicketCount = ticketCountForQualifiedOrders(persistedOrders.length);
      const existingTickets = await tx.select().from(liveSpinTickets).where(and(eq(liveSpinTickets.userId, userId), eq(liveSpinTickets.earnedWeekKey, weekKey))).orderBy(asc(liveSpinTickets.sequenceInWeek));
      const activeTickets = existingTickets.filter((ticket) => ticket.status === "active");

      if (activeTickets.length > desiredTicketCount) {
        const surplus = activeTickets.slice(desiredTicketCount);
        await tx.update(liveSpinTickets).set({ status: "void", voidedAt: new Date(), voidReason: "The underlying order no longer qualifies for the weekly loyalty giveaway." }).where(inArray(liveSpinTickets.id, surplus.map((ticket) => ticket.id)));
      }

      if (activeTickets.length < desiredTicketCount) {
        let nextSequence = Math.max(0, ...existingTickets.map((ticket) => ticket.sequenceInWeek)) + 1;
        const newTickets = Array.from({ length: desiredTicketCount - activeTickets.length }, () => ({ id: nanoid(), userId, earnedWeekKey: weekKey, sequenceInWeek: nextSequence++, status: "active" as const }));
        if (newTickets.length) await tx.insert(liveSpinTickets).values(newTickets);
      }
    }
  });

  return { weekKey, qualifiedOrderCount: qualifyingOrders.length };
}

export async function getLiveSpinAccountSummary(userId: number) {
  const db = await getDb();
  const weekKey = liveSpinWeekKey(new Date());
  if (!db) return { weekKey, progress: progressForQualifiedOrders(0), activeTicketCount: 0, tickets: [], prizes: [] };

  await syncLiveSpinTicketsForWeek(weekKey);
  const [qualifiedOrders, tickets, results] = await Promise.all([
    db.select({ id: liveSpinQualifiedOrders.id }).from(liveSpinQualifiedOrders).where(and(eq(liveSpinQualifiedOrders.userId, userId), eq(liveSpinQualifiedOrders.weekKey, weekKey))),
    db.select().from(liveSpinTickets).where(and(eq(liveSpinTickets.userId, userId), eq(liveSpinTickets.isTest, false))).orderBy(desc(liveSpinTickets.issuedAt)),
    db.select({ result: liveSpinResults, prize: liveSpinPrizeTiers, event: liveSpinEvents }).from(liveSpinResults).innerJoin(liveSpinEntries, eq(liveSpinResults.winnerEntryId, liveSpinEntries.id)).innerJoin(liveSpinPrizeTiers, eq(liveSpinResults.prizeTierId, liveSpinPrizeTiers.id)).innerJoin(liveSpinEvents, eq(liveSpinResults.eventId, liveSpinEvents.id)).where(and(eq(liveSpinEntries.userId, userId), eq(liveSpinEvents.isTest, false))).orderBy(desc(liveSpinResults.awardedAt)),
  ]);
  const progress = progressForQualifiedOrders(qualifiedOrders.length);
  return {
    weekKey,
    progress,
    activeTicketCount: tickets.filter((ticket) => ticket.status === "active" || ticket.status === "locked").length,
    tickets: tickets.map((ticket) => ({ id: ticket.id, earnedWeekKey: ticket.earnedWeekKey, status: ticket.status, issuedAt: ticket.issuedAt, eventId: ticket.eventId })),
    prizes: results.map(({ result, prize, event }) => ({ eventId: event.id, eventWeekKey: event.weekKey, awardedAt: result.awardedAt, prizeNameKh: prize.nameKh, prizeValueLabel: prize.valueLabel, prizeMediaUrl: prize.mediaUrl })),
  };
}

export async function createLiveSpinEvent(input: { actorUserId: number; scheduledAt: Date; announcementStartsAt: Date; entryCutoffAt: Date; lobbyStartsAt: Date; adMediaUrl?: string | null; adDurationSeconds?: number; minParticipantCount?: number }) {
  const db = ensureDb(await getDb());
  assertWeeklySundayThreePm(input.scheduledAt);
  if (input.scheduledAt.getTime() <= Date.now()) throw new Error("Live Spin must be scheduled in the future.");
  if (input.entryCutoffAt.getTime() !== input.scheduledAt.getTime() - 10 * 60_000) throw new Error("Entry cutoff must be exactly 10 minutes before Live Spin.");
  assertAnnouncementWindow(input.scheduledAt, input.announcementStartsAt);
  if (input.lobbyStartsAt.getTime() !== input.scheduledAt.getTime() - 5 * 60_000) throw new Error("The waiting lobby must begin exactly 5 minutes before Live Spin.");
  const weekKey = liveSpinWeekKey(input.scheduledAt);
  const existing = await db.select({ id: liveSpinEvents.id }).from(liveSpinEvents).where(eq(liveSpinEvents.weekKey, weekKey)).limit(1);
  if (existing[0]) throw new Error("A Live Spin event already exists for this weekly cycle.");

  const seed = createLiveSpinFairnessSeed();
  const event = {
    id: nanoid(),
    weekKey,
    status: "draft" as const,
    scheduledAt: input.scheduledAt,
    announcementStartsAt: input.announcementStartsAt,
    entryCutoffAt: input.entryCutoffAt,
    lobbyStartsAt: input.lobbyStartsAt,
    adMediaUrl: input.adMediaUrl?.trim() || null,
    adDurationSeconds: Math.max(0, Math.floor(input.adDurationSeconds ?? 0)),
    minParticipantCount: Math.max(1, Math.floor(input.minParticipantCount ?? LIVE_SPIN_MINIMUM_PARTICIPANT_COUNT)),
    winnerSpoilerSeconds: LIVE_SPIN_DEFAULT_SPOILER_SECONDS,
    prizeCountdownSeconds: LIVE_SPIN_DEFAULT_PRIZE_COUNTDOWN_SECONDS,
    fairnessCommitmentHash: liveSpinFairnessCommitment(seed),
    encryptedFairnessSeed: encryptedSeed(seed),
    createdByUserId: input.actorUserId,
  };
  await db.insert(liveSpinEvents).values(event);
  await appendAudit({ eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "event_created", details: { weekKey, scheduledAt: input.scheduledAt.toISOString(), entryCutoffAt: input.entryCutoffAt.toISOString(), minParticipantCount: event.minParticipantCount, fairnessCommitmentHash: event.fairnessCommitmentHash } });
  return { id: event.id, weekKey, fairnessCommitmentHash: event.fairnessCommitmentHash };
}

export async function createOwnerLiveSpinTestEvent(input: { actorUserId: number }) {
  const db = ensureDb(await getDb());
  const now = new Date();
  const seed = createLiveSpinFairnessSeed();
  const event = {
    id: nanoid(),
    weekKey: `test-${nanoid(10)}`,
    status: "announced" as const,
    isTest: true,
    scheduledAt: now,
    announcementStartsAt: now,
    entryCutoffAt: now,
    lobbyStartsAt: now,
    adMediaUrl: null,
    adDurationSeconds: 0,
    minParticipantCount: 1,
    winnerSpoilerSeconds: LIVE_SPIN_DEFAULT_SPOILER_SECONDS,
    prizeCountdownSeconds: LIVE_SPIN_DEFAULT_PRIZE_COUNTDOWN_SECONDS,
    fairnessCommitmentHash: liveSpinFairnessCommitment(seed),
    encryptedFairnessSeed: encryptedSeed(seed),
    createdByUserId: input.actorUserId,
  };
  await db.transaction(async (tx) => {
    await tx.insert(liveSpinEvents).values(event);
    await tx.insert(liveSpinPrizeTiers).values(Array.from({ length: 10 }, (_, index) => ({ id: nanoid(), eventId: event.id, tierNumber: index + 1, nameKh: `TEST ONLY · រង្វាន់ទី ${index + 1}`, valueLabel: "No monetary value", descriptionKh: "Owner validation event only. Not a customer reward.", mediaUrl: null, isGrandPrize: index === 0, isActive: true })));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "owner_test_event_created", details: { isTest: true, publicViewOnly: true, paymentOrOrderCreated: false, prizeCount: 10 } });
  });
  return { id: event.id, weekKey: event.weekKey, fairnessCommitmentHash: event.fairnessCommitmentHash, isTest: true as const };
}

export async function addOwnerLiveSpinTestEntry(input: { eventId: string; actorUserId: number }) {
  const db = ensureDb(await getDb());
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event?.isTest) throw new Error("Only an owner test event can receive a test entry.");
    if (!['draft', 'announced'].includes(event.status)) throw new Error("Test entry is closed after participants are locked.");
    const existing = await tx.select({ id: liveSpinTickets.id }).from(liveSpinTickets).where(and(eq(liveSpinTickets.eventId, event.id), eq(liveSpinTickets.userId, input.actorUserId), eq(liveSpinTickets.isTest, true))).limit(1);
    if (existing[0]) return { ticketId: existing[0].id, created: false as const };
    const ticketId = nanoid();
    await tx.insert(liveSpinTickets).values({ id: ticketId, userId: input.actorUserId, earnedWeekKey: event.weekKey, sequenceInWeek: 1, status: "active", isTest: true, eventId: event.id });
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "owner_test_entry_added", details: { ticketId, isTest: true, paymentOrOrderCreated: false } });
    return { ticketId, created: true as const };
  });
}

export async function getLiveSpinEvents() {
  const db = ensureDb(await getDb());
  return db.select().from(liveSpinEvents).orderBy(desc(liveSpinEvents.scheduledAt));
}

export async function getLiveSpinAuditLog(eventId?: string) {
  const db = ensureDb(await getDb());
  return db.select().from(liveSpinAuditLogs).where(eventId ? eq(liveSpinAuditLogs.eventId, eventId) : sql`1 = 1`).orderBy(desc(liveSpinAuditLogs.createdAt));
}

export async function lockLiveSpinParticipants(input: { eventId: string; actorUserId: number; now?: Date }) {
  const db = ensureDb(await getDb());
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (!["draft", "announced"].includes(event.status)) throw new Error("Only a planned Live Spin event can lock participants.");
    if (!event.isTest && now.getTime() < event.entryCutoffAt.getTime()) throw new Error("Participant lock is not available before the entry cutoff.");

    const tickets = await tx.select().from(liveSpinTickets).where(and(eq(liveSpinTickets.status, "active"), eq(liveSpinTickets.isTest, event.isTest))).orderBy(asc(liveSpinTickets.userId), asc(liveSpinTickets.issuedAt));
    const holderCount = new Set(tickets.map((ticket) => ticket.userId)).size;
    if (holderCount < event.minParticipantCount) {
      await tx.update(liveSpinEvents).set({ status: "skipped", endedAt: now, skippedReason: "The weekly event did not reach the minimum eligible participant threshold." }).where(eq(liveSpinEvents.id, event.id));
      await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "event_auto_skipped_below_threshold", details: { holderCount, minParticipantCount: event.minParticipantCount, ticketPolicy: "tickets_remain_active_and_roll_over" } });
      return { status: "skipped" as const, holderCount, minParticipantCount: event.minParticipantCount };
    }

    const snapshot = tickets.map((ticket, entryIndex) => ({ entryIndex, ticketId: ticket.id, userId: ticket.userId, displayAlias: displayAlias(event.id, ticket.userId) }));
    const snapshotHash = liveSpinSnapshotHash(snapshot);
    await tx.insert(liveSpinEntries).values(snapshot.map((entry) => ({ id: nanoid(), eventId: event.id, ...entry, status: "locked" as const, lockedAt: now })));
    await tx.update(liveSpinTickets).set({ status: "locked", eventId: event.id }).where(inArray(liveSpinTickets.id, tickets.map((ticket) => ticket.id)));
    await tx.update(liveSpinEvents).set({ status: "locked", lockedParticipantCount: holderCount, lockedEntryCount: snapshot.length, participantSnapshotHash: snapshotHash, participantSnapshotAt: now }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "participants_locked", details: { holderCount, entryCount: snapshot.length, participantSnapshotHash: snapshotHash } });
    return { status: "locked" as const, holderCount, entryCount: snapshot.length, participantSnapshotHash: snapshotHash };
  });
}

export async function skipLiveSpinWeek(input: { eventId: string; actorUserId: number; reason: string }) {
  const db = ensureDb(await getDb());
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (["live", "winner_revealed", "prize_countdown", "prize_revealed", "ended", "skipped"].includes(event.status)) throw new Error("This Live Spin event can no longer be skipped.");
    await tx.update(liveSpinTickets).set({ status: "active", eventId: null }).where(and(eq(liveSpinTickets.eventId, event.id), eq(liveSpinTickets.status, "locked")));
    await tx.update(liveSpinEvents).set({ status: "skipped", endedAt: new Date(), skippedReason: input.reason.trim() }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "event_skipped_by_owner", details: { reason: input.reason.trim(), ticketPolicy: "tickets_rolled_over" } });
    return { success: true, status: "skipped" as const };
  });
}

export async function selectLiveSpinWinner(input: { eventId: string; now?: Date }) {
  const db = ensureDb(await getDb());
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (event.status !== "live") throw new Error("A winner can only be selected while the event is live.");
    const now = input.now ?? new Date();
    if (!event.liveStartedAt || now.getTime() < event.liveStartedAt.getTime() + LIVE_SPIN_NAME_STRIP_SECONDS * 1000) throw new Error("The server-side name strip is still in progress.");
    const existing = await tx.select({ id: liveSpinResults.id }).from(liveSpinResults).where(eq(liveSpinResults.eventId, event.id)).limit(1);
    if (existing[0]) throw new Error("This Live Spin already has a recorded result.");
    const entries = await tx.select().from(liveSpinEntries).where(and(eq(liveSpinEntries.eventId, event.id), eq(liveSpinEntries.status, "locked"))).orderBy(asc(liveSpinEntries.entryIndex));
    const prizes = await tx.select().from(liveSpinPrizeTiers).where(and(eq(liveSpinPrizeTiers.eventId, event.id), eq(liveSpinPrizeTiers.isActive, true))).orderBy(asc(liveSpinPrizeTiers.tierNumber));
    if (!entries.length || !prizes.length || !event.participantSnapshotHash) throw new Error("The locked entries, active prizes, or fairness snapshot are incomplete.");
    const seed = decryptedSeed(event.encryptedFairnessSeed);
    const outcome = selectLiveSpinOutcome({ eventId: event.id, seed, snapshotHash: event.participantSnapshotHash, entryCount: entries.length, prizeCount: prizes.length });
    const winner = entries[outcome.winnerIndex];
    const prize = prizes[outcome.prizeIndex];
    if (!winner || !prize) throw new Error("The deterministic result could not be resolved.");
    const resultId = nanoid();
    await tx.insert(liveSpinResults).values({ id: resultId, eventId: event.id, winnerEntryId: winner.id, prizeTierId: prize.id, winnerIndex: outcome.winnerIndex, prizeIndex: outcome.prizeIndex, selectionProofHash: outcome.selectionProofHash });
    const selectedAt = now;
    await tx.update(liveSpinEntries).set({ status: "winner" }).where(eq(liveSpinEntries.id, winner.id));
    await tx.update(liveSpinTickets).set({ status: "used" }).where(and(eq(liveSpinTickets.eventId, event.id), eq(liveSpinTickets.status, "locked")));
    await tx.update(liveSpinEvents).set({ status: "winner_revealed", winnerRevealedAt: selectedAt, revealedFairnessSeed: seed }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorType: "system", action: "winner_selected_server_side", details: { resultId, winnerEntryId: winner.id, prizeTierId: prize.id, winnerIndex: outcome.winnerIndex, prizeIndex: outcome.prizeIndex, selectionProofHash: outcome.selectionProofHash, consumedEntryCount: entries.length, ticketPolicy: "all_locked_tickets_consumed_after_successful_draw" } });
    return { resultId, winnerAlias: winner.displayAlias, prizeNameKh: prize.nameKh, prizeValueLabel: prize.valueLabel, winnerSpoilerSeconds: event.winnerSpoilerSeconds, prizeCountdownSeconds: event.prizeCountdownSeconds, fairnessCommitmentHash: event.fairnessCommitmentHash, participantSnapshotHash: event.participantSnapshotHash, revealedFairnessSeed: seed, selectionProofHash: outcome.selectionProofHash };
  });
}

export async function announceLiveSpinEvent(input: { eventId: string; actorUserId: number }) {
  const db = ensureDb(await getDb());
  const event = (await db.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
  if (!event) throw new Error("Live Spin event not found.");
  if (event.status !== "draft") throw new Error("Only a draft event can be announced.");
  await db.update(liveSpinEvents).set({ status: "announced" }).where(eq(liveSpinEvents.id, event.id));
  await appendAudit({ eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "event_announced", details: { announcementStartsAt: event.announcementStartsAt?.toISOString() ?? null, scheduledAt: event.scheduledAt.toISOString() } });
  return { success: true, status: "announced" as const };
}

export async function saveLiveSpinPrizeTier(input: { eventId: string; actorUserId: number; tierNumber: number; nameKh: string; valueLabel: string; descriptionKh?: string | null; mediaUrl?: string | null; isGrandPrize: boolean; isActive: boolean }) {
  const db = ensureDb(await getDb());
  if (!Number.isInteger(input.tierNumber) || input.tierNumber < 1 || input.tierNumber > 10) throw new Error("A Live Spin event supports exactly ten prize tiers.");
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select({ status: liveSpinEvents.status }).from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (!["draft", "announced"].includes(event.status)) throw new Error("Prize tiers are locked once participant entries are locked.");
    const values = { nameKh: input.nameKh.trim(), valueLabel: input.valueLabel.trim(), descriptionKh: input.descriptionKh?.trim() || null, mediaUrl: input.mediaUrl?.trim() || null, isGrandPrize: input.isGrandPrize, isActive: input.isActive };
    const existing = await tx.select({ id: liveSpinPrizeTiers.id }).from(liveSpinPrizeTiers).where(and(eq(liveSpinPrizeTiers.eventId, input.eventId), eq(liveSpinPrizeTiers.tierNumber, input.tierNumber))).limit(1);
    if (existing[0]) await tx.update(liveSpinPrizeTiers).set(values).where(eq(liveSpinPrizeTiers.id, existing[0].id));
    else await tx.insert(liveSpinPrizeTiers).values({ id: nanoid(), eventId: input.eventId, tierNumber: input.tierNumber, ...values });
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: input.eventId, actorUserId: input.actorUserId, actorType: "owner", action: existing[0] ? "prize_tier_updated" : "prize_tier_created", details: { tierNumber: input.tierNumber, isActive: input.isActive, isGrandPrize: input.isGrandPrize } });
    return { success: true };
  });
}

export async function getLiveSpinPrizeTiers(eventId: string) {
  const db = ensureDb(await getDb());
  return db.select().from(liveSpinPrizeTiers).where(eq(liveSpinPrizeTiers.eventId, eventId)).orderBy(asc(liveSpinPrizeTiers.tierNumber));
}

export async function startLiveSpinLobby(input: { eventId: string; actorUserId: number; now?: Date }) {
  const db = ensureDb(await getDb());
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (event.status !== "locked") throw new Error("Only a locked Live Spin event can enter the waiting lobby.");
    if (now.getTime() < event.lobbyStartsAt!.getTime()) throw new Error("The waiting lobby cannot start before its scheduled time.");
    const prizes = await tx.select({ id: liveSpinPrizeTiers.id }).from(liveSpinPrizeTiers).where(and(eq(liveSpinPrizeTiers.eventId, event.id), eq(liveSpinPrizeTiers.isActive, true)));
    if (prizes.length !== 10) throw new Error("Exactly ten active prize tiers must be configured before Live Spin can start.");
    await tx.update(liveSpinEvents).set({ status: "waiting" }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "waiting_lobby_started", details: { startedAt: now.toISOString(), lockedEntryCount: event.lockedEntryCount } });
    return { success: true, status: "waiting" as const };
  });
}

export async function endLiveSpinEvent(input: { eventId: string; actorUserId: number; reason: string }) {
  const db = ensureDb(await getDb());
  const event = (await db.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
  if (!event) throw new Error("Live Spin event not found.");
  if (event.status !== "prize_revealed") throw new Error("Live Spin can only end after the prize has been revealed.");
  await db.update(liveSpinEvents).set({ status: "ended", endedAt: new Date() }).where(eq(liveSpinEvents.id, event.id));
  await appendAudit({ eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "event_ended_by_owner", details: { reason: input.reason.trim() } });
  return { success: true, status: "ended" as const };
}

export async function getLiveSpinOwnerEventDetail(eventId: string) {
  const db = ensureDb(await getDb());
  const [event, prizes, entries, audit] = await Promise.all([
    db.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, eventId)).limit(1),
    db.select().from(liveSpinPrizeTiers).where(eq(liveSpinPrizeTiers.eventId, eventId)).orderBy(asc(liveSpinPrizeTiers.tierNumber)),
    db.select({ entry: liveSpinEntries, user: users, ticket: liveSpinTickets }).from(liveSpinEntries).innerJoin(users, eq(liveSpinEntries.userId, users.id)).innerJoin(liveSpinTickets, eq(liveSpinEntries.ticketId, liveSpinTickets.id)).where(eq(liveSpinEntries.eventId, eventId)).orderBy(asc(liveSpinEntries.entryIndex)),
    db.select().from(liveSpinAuditLogs).where(eq(liveSpinAuditLogs.eventId, eventId)).orderBy(desc(liveSpinAuditLogs.createdAt)),
  ]);
  if (!event[0]) throw new Error("Live Spin event not found.");
  return { event: event[0], prizes, participants: entries.map(({ entry, user, ticket }) => ({ entryIndex: entry.entryIndex, displayAlias: entry.displayAlias, name: user.displayName ?? user.name ?? null, ticketId: ticket.id, ticketEarnedWeek: ticket.earnedWeekKey, status: entry.status })), audit };
}

export async function getPublicLiveSpinState() {
  const db = await getDb();
  if (!db) return { serverNow: new Date(), event: null, participantCount: 0, entryCount: 0, thresholdReached: false, winner: null, prize: null };
  const event = (await db.select().from(liveSpinEvents).where(inArray(liveSpinEvents.status, ["announced", "locked", "waiting", "live", "winner_revealed", "prize_countdown", "prize_revealed", "ended"])).orderBy(desc(liveSpinEvents.scheduledAt)).limit(1))[0];
  if (!event) return { serverNow: new Date(), event: null, participantCount: 0, entryCount: 0, thresholdReached: false, winner: null, prize: null };
  const isLocked = ["locked", "waiting", "live", "winner_revealed", "prize_countdown", "prize_revealed", "ended"].includes(event.status);
  const activeTicketHolders = isLocked ? event.lockedParticipantCount : new Set((await db.select({ userId: liveSpinTickets.userId }).from(liveSpinTickets).where(and(eq(liveSpinTickets.status, "active"), eq(liveSpinTickets.isTest, event.isTest)))).map((ticket) => ticket.userId)).size;
  const isWinnerRevealed = ["winner_revealed", "prize_countdown", "prize_revealed", "ended"].includes(event.status);
  const isPrizeRevealed = ["prize_revealed", "ended"].includes(event.status);
  const result = isWinnerRevealed ? (await db.select({ entry: liveSpinEntries, prize: liveSpinPrizeTiers }).from(liveSpinResults).innerJoin(liveSpinEntries, eq(liveSpinResults.winnerEntryId, liveSpinEntries.id)).innerJoin(liveSpinPrizeTiers, eq(liveSpinResults.prizeTierId, liveSpinPrizeTiers.id)).where(eq(liveSpinResults.eventId, event.id)).limit(1))[0] : null;
  return {
    serverNow: new Date(),
    event: {
      id: event.id,
      status: event.status,
      isTest: event.isTest,
      scheduledAt: event.scheduledAt,
      announcementStartsAt: event.announcementStartsAt,
      entryCutoffAt: event.entryCutoffAt,
      lobbyStartsAt: event.lobbyStartsAt,
      liveStartedAt: event.liveStartedAt,
      winnerRevealedAt: event.winnerRevealedAt,
      prizeCountdownStartedAt: event.prizeCountdownStartedAt,
      prizeRevealedAt: event.prizeRevealedAt,
      nameStripSeconds: LIVE_SPIN_NAME_STRIP_SECONDS,
      adMediaUrl: event.adMediaUrl,
      adDurationSeconds: event.adDurationSeconds,
      minParticipantCount: event.minParticipantCount,
      winnerSpoilerSeconds: event.winnerSpoilerSeconds,
      prizeCountdownSeconds: event.prizeCountdownSeconds,
      fairnessCommitmentHash: event.fairnessCommitmentHash,
      participantSnapshotHash: event.participantSnapshotHash,
      revealedFairnessSeed: isPrizeRevealed ? event.revealedFairnessSeed : null,
    },
    participantCount: activeTicketHolders,
    entryCount: isLocked ? event.lockedEntryCount : 0,
    thresholdReached: activeTicketHolders >= event.minParticipantCount,
    winner: result ? { alias: result.entry.displayAlias } : null,
    prize: result && isPrizeRevealed ? { nameKh: result.prize.nameKh, valueLabel: result.prize.valueLabel, mediaUrl: result.prize.mediaUrl } : null,
  };
}

export async function startLiveSpin(input: { eventId: string; actorUserId: number; now?: Date }) {
  const db = ensureDb(await getDb());
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (event.status !== "waiting") throw new Error("Only the waiting lobby can begin Live Spin.");
    if (now.getTime() < event.scheduledAt.getTime()) throw new Error("Live Spin cannot begin before its scheduled time.");
    await tx.update(liveSpinEvents).set({ status: "live", liveStartedAt: now }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "live_spin_started", details: { startedAt: now.toISOString(), lockedEntryCount: event.lockedEntryCount } });
    return { success: true, status: "live" as const };
  });
}

export async function startLiveSpinPrizeCountdown(input: { eventId: string; actorUserId: number; now?: Date }) {
  const db = ensureDb(await getDb());
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (event.status !== "winner_revealed") throw new Error("Prize countdown can begin only after a server-recorded winner reveal.");
    if (!event.winnerRevealedAt || now.getTime() < event.winnerRevealedAt.getTime() + event.winnerSpoilerSeconds * 1000) throw new Error("The winner spoiler pause is still in progress.");
    await tx.update(liveSpinEvents).set({ status: "prize_countdown", prizeCountdownStartedAt: now }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "prize_countdown_started", details: { startedAt: now.toISOString(), prizeCountdownSeconds: event.prizeCountdownSeconds } });
    return { success: true, status: "prize_countdown" as const };
  });
}

export async function revealLiveSpinPrize(input: { eventId: string; actorUserId: number; now?: Date }) {
  const db = ensureDb(await getDb());
  const now = input.now ?? new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM live_spin_events WHERE id = ${input.eventId} FOR UPDATE`);
    const event = (await tx.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
    if (!event) throw new Error("Live Spin event not found.");
    if (event.status !== "prize_countdown") throw new Error("The prize can be revealed only after the server-side prize countdown.");
    if (!event.prizeCountdownStartedAt || now.getTime() < event.prizeCountdownStartedAt.getTime() + event.prizeCountdownSeconds * 1000) throw new Error("The prize countdown is still in progress.");
    await tx.update(liveSpinEvents).set({ status: "prize_revealed", prizeRevealedAt: now }).where(eq(liveSpinEvents.id, event.id));
    await tx.insert(liveSpinAuditLogs).values({ id: nanoid(), eventId: event.id, actorUserId: input.actorUserId, actorType: "owner", action: "prize_revealed", details: { winnerSpoilerSeconds: event.winnerSpoilerSeconds, prizeCountdownSeconds: event.prizeCountdownSeconds, seedPublished: true } });
    return { success: true, status: "prize_revealed" as const };
  });
}

/** Advances only the next server-authoritative phase after its persisted deadline. */
export async function advanceLiveSpinPhase(input: { eventId: string; actorUserId: number; now?: Date }) {
  const db = ensureDb(await getDb());
  const event = (await db.select().from(liveSpinEvents).where(eq(liveSpinEvents.id, input.eventId)).limit(1))[0];
  if (!event) throw new Error("Live Spin event not found.");
  const now = input.now ?? new Date();
  if (event.status === "live") return selectLiveSpinWinner({ eventId: event.id, now });
  if (event.status === "winner_revealed") return startLiveSpinPrizeCountdown({ eventId: event.id, actorUserId: input.actorUserId, now });
  if (event.status === "prize_countdown") return revealLiveSpinPrize({ eventId: event.id, actorUserId: input.actorUserId, now });
  if (event.status === "prize_revealed") {
    if (!event.prizeRevealedAt || now.getTime() < event.prizeRevealedAt.getTime() + LIVE_SPIN_PRIZE_REVEAL_SECONDS * 1000) throw new Error("The thank-you reveal screen is still in progress.");
    return endLiveSpinEvent({ eventId: event.id, actorUserId: input.actorUserId, reason: "The server-side Live Spin sequence completed after the published prize reveal." });
  }
  return { success: true, status: event.status, advanced: false as const };
}
