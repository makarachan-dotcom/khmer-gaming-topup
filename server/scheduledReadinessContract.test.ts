import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("scheduled bank-review readiness callback", () => {
  it("is cron-authenticated, checks live provider catalogs, and never handles customer identity data", () => {
    const app = readFileSync(new URL("./app.ts", import.meta.url), "utf8");
    expect(app).toContain('app.post("/api/scheduled/bank-review-readiness"');
    expect(app).toContain("await sdk.authenticateRequest(req)");
    expect(app).toContain("!user.isCron || !user.taskUid");
    expect(app).toContain("Promise.all([fetchProviderGames(), fetchSmmProviderServices()])");
    expect(app).toContain('paymentMode: "disabled-by-policy"');
    expect(app).not.toContain("validateProviderPlayerIdentity(input)");
  });
});
