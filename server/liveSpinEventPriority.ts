import type { LiveSpinEventStatus } from "./liveSpinStore";

export type PublicLiveSpinEventCandidate = {
  status: LiveSpinEventStatus;
  isTest: boolean;
  scheduledAt: Date;
};

/**
 * Chooses one public event without leaking data from old, completed test runs.
 * An event still in its lifecycle is always more relevant than an archived end
 * state. For equally current events, a production event takes precedence over
 * a test event; schedule time then makes selection deterministic.
 */
export function selectPublicLiveSpinEvent<T extends PublicLiveSpinEventCandidate>(events: readonly T[]): T | null {
  return [...events].sort((left, right) => {
    const leftCurrent = left.status !== "ended";
    const rightCurrent = right.status !== "ended";
    if (leftCurrent !== rightCurrent) return leftCurrent ? -1 : 1;

    if (left.isTest !== right.isTest) return left.isTest ? 1 : -1;

    return right.scheduledAt.getTime() - left.scheduledAt.getTime();
  })[0] ?? null;
}
