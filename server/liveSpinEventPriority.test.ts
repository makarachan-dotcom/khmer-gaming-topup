import { describe, expect, it } from "vitest";
import { selectPublicLiveSpinEvent, type PublicLiveSpinEventCandidate } from "./liveSpinEventPriority";

function event(id: string, status: PublicLiveSpinEventCandidate["status"], isTest: boolean, scheduledAt: string): PublicLiveSpinEventCandidate & { id: string } {
  return { id, status, isTest, scheduledAt: new Date(scheduledAt) };
}

describe("public Live Spin event priority", () => {
  it("prefers a current waiting test over an archived ended test", () => {
    const selected = selectPublicLiveSpinEvent([
      event("archived-test", "ended", true, "2026-08-27T14:45:00.000Z"),
      event("waiting-test", "waiting", true, "2026-08-30T08:00:00.000Z"),
    ]);

    expect(selected?.id).toBe("waiting-test");
  });

  it("keeps a current production event ahead of an equally current test", () => {
    const selected = selectPublicLiveSpinEvent([
      event("live-test", "live", true, "2026-08-30T08:00:00.000Z"),
      event("waiting-production", "waiting", false, "2026-08-30T07:00:00.000Z"),
    ]);

    expect(selected?.id).toBe("waiting-production");
  });

  it("uses the most recently scheduled event when liveness and environment match", () => {
    const selected = selectPublicLiveSpinEvent([
      event("older", "announced", false, "2026-08-30T07:00:00.000Z"),
      event("newer", "announced", false, "2026-08-30T08:00:00.000Z"),
    ]);

    expect(selected?.id).toBe("newer");
  });
});
