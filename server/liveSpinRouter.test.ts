import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Live Spin router access boundaries", () => {
  const source = readFileSync(join(process.cwd(), "server/routers.ts"), "utf8");

  it("exposes only status and the signed-in account summary to customers", () => {
    expect(source).toContain("liveSpin: router({");
    expect(source).toContain("state: publicProcedure.query(() => getPublicLiveSpinState())");
    expect(source).toContain("account: protectedProcedure.query(({ ctx }) => getLiveSpinAccountSummary(ctx.user.id))");
  });

  it("keeps event creation, participant locks, schedule transitions, prize editing and skip controls owner-only", () => {
    ["createLiveSpinEvent", "announceLiveSpinEvent", "lockLiveSpinParticipants", "startLiveSpinLobby", "startLiveSpin", "revealLiveSpinPrize", "endLiveSpinEvent", "skipLiveSpinWeek", "saveLiveSpinPrizeTier"].forEach((procedure) => {
      expect(source).toContain(`${procedure}: ownerProcedure`);
    });
  });

  it("does not expose a client-callable winner selection procedure", () => {
    expect(source).not.toContain("selectLiveSpinWinner:");
  });
});
