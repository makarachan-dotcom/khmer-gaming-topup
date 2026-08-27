import { advanceLiveSpinPhase, startLiveSpin } from "./liveSpinStore";
import { LIVE_SPIN_NAME_STRIP_SECONDS } from "./liveSpinFairness";
import { publishLiveSpinState } from "./liveSpinRealtime";

async function publishPublicState(eventId: string) {
  try {
    await publishLiveSpinState(eventId);
  } catch (error) {
    // Realtime is an acceleration layer; persisted DB state remains authoritative and the client polls as fallback.
    console.error("Live Spin realtime publish failed", error);
  }
}

/**
 * Owner-only start action. The durable state machine persists a timestamp for
 * every phase; another owner-only phase advance can resume it after a retry,
 * reconnect, or deployment rather than relying on a sleeping serverless call.
 */
export async function advanceLiveSpinSequence(input: { eventId: string; actorUserId: number }) {
  const result = await advanceLiveSpinPhase(input);
  await publishPublicState(input.eventId);
  return result;
}

export async function runLiveSpinSequence(input: { eventId: string; actorUserId: number }) {
  const started = await startLiveSpin(input);
  await publishPublicState(input.eventId);
  return {
    ...started,
    completed: false as const,
    nextPhase: "winner_selection" as const,
    nextPhaseAfterSeconds: LIVE_SPIN_NAME_STRIP_SECONDS,
  };
}
