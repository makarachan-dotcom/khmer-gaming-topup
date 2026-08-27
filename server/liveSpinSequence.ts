import { endLiveSpinEvent, revealLiveSpinPrize, selectLiveSpinWinner, startLiveSpin } from "./liveSpinStore";
import { publishLiveSpinState } from "./liveSpinRealtime";

const NAME_STRIP_SECONDS = 5;

function pause(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function publishPublicState(eventId: string) {
  try {
    await publishLiveSpinState(eventId);
  } catch (error) {
    // Realtime is an acceleration layer; persisted DB state remains authoritative and the client polls as fallback.
    console.error("Live Spin realtime publish failed", error);
  }
}

/**
 * This process is invoked only from the owner-only Go Live mutation. It keeps
 * the authoritative state machine on the server for the short live sequence;
 * browsers can only subscribe to the sanitized state and animate from it.
 */
export async function runLiveSpinSequence(input: { eventId: string; actorUserId: number }) {
  const started = await startLiveSpin(input);
  await publishPublicState(input.eventId);

  await pause(NAME_STRIP_SECONDS * 1000);
  const selection = await selectLiveSpinWinner({ eventId: input.eventId });
  await publishPublicState(input.eventId);

  await pause(selection.winnerSpoilerSeconds * 1000);
  await revealLiveSpinPrize(input);
  await publishPublicState(input.eventId);

  await pause(selection.prizeCountdownSeconds * 1000);
  await endLiveSpinEvent({ eventId: input.eventId, actorUserId: input.actorUserId, reason: "The server-side Live Spin sequence completed after the published prize reveal." });
  await publishPublicState(input.eventId);

  return { ...started, completed: true as const, nameStripSeconds: NAME_STRIP_SECONDS, winnerSpoilerSeconds: selection.winnerSpoilerSeconds, prizeCountdownSeconds: selection.prizeCountdownSeconds };
}
