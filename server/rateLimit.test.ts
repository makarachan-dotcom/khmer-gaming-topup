import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { consumeRateLimit, rateLimitBuckets } from "./rateLimit";

const serverDir = path.resolve(import.meta.dirname);
const payRoutesSource = fs.readFileSync(path.join(serverDir, "paymentLinkRoutes.ts"), "utf8");
const appSource = fs.readFileSync(path.join(serverDir, "app.ts"), "utf8");
const routersSource = fs.readFileSync(path.join(serverDir, "routers.ts"), "utf8");

describe("rate limit buckets", () => {
  it("keeps the limits required by the security review", () => {
    expect(rateLimitBuckets.payKeyIssue).toMatchObject({ limit: 20, windowSeconds: 300 });
    expect(rateLimitBuckets.auth).toMatchObject({ limit: 60, windowSeconds: 60 });
    expect(rateLimitBuckets.trpcPublic).toMatchObject({ limit: 600, windowSeconds: 60 });
    expect(rateLimitBuckets.createTopup).toMatchObject({ limit: 10, windowSeconds: 3600 });
  });

  it("rejects the attempt past the pay key limit from one address", async () => {
    const { limit } = rateLimitBuckets.payKeyIssue;
    const identifier = `test-${Math.random().toString(36).slice(2)}`;
    const decisions = [];
    for (let attempt = 0; attempt < limit + 1; attempt += 1) {
      decisions.push(await consumeRateLimit({ bucket: rateLimitBuckets.payKeyIssue, identifier, mode: "strict" }));
    }
    expect(decisions.slice(0, limit).every((decision) => decision.allowed)).toBe(true);
    expect(decisions[limit]!.allowed).toBe(false);
    expect(decisions[limit]!.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each identifier separately", async () => {
    const { limit } = rateLimitBuckets.payKeyIssue;
    const first = `test-${Math.random().toString(36).slice(2)}`;
    const second = `test-${Math.random().toString(36).slice(2)}`;
    for (let attempt = 0; attempt < limit; attempt += 1) {
      await consumeRateLimit({ bucket: rateLimitBuckets.payKeyIssue, identifier: first, mode: "strict" });
    }
    const blocked = await consumeRateLimit({ bucket: rateLimitBuckets.payKeyIssue, identifier: first, mode: "strict" });
    const other = await consumeRateLimit({ bucket: rateLimitBuckets.payKeyIssue, identifier: second, mode: "strict" });
    expect(blocked.allowed).toBe(false);
    expect(other.allowed).toBe(true);
  });
});

describe("rate limit wiring regression", () => {
  it("throttles the pay key endpoint before it resolves a user", () => {
    const limiterIndex = payRoutesSource.indexOf("rateLimitBuckets.payKeyIssue");
    const resolveIndex = payRoutesSource.indexOf("const user = await resolveUser(req)");
    expect(limiterIndex).toBeGreaterThan(-1);
    expect(resolveIndex).toBeGreaterThan(limiterIndex);
    expect(payRoutesSource).toContain("sendRateLimited(res, issueDecision.retryAfterSeconds)");
  });

  it("keeps a durable backend instead of a per-process map", () => {
    expect(payRoutesSource).not.toContain("new Map<string, number[]>()");
    expect(payRoutesSource).toContain('from "./rateLimit"');
  });

  it("mounts limiters on the auth and tRPC surfaces", () => {
    expect(appSource).toContain('app.set("trust proxy", 1)');
    expect(appSource).toContain('app.use("/api/auth", rateLimitMiddleware({ bucket: rateLimitBuckets.auth, mode: "strict" }))');
    expect(appSource).toContain('app.use("/api/trpc", rateLimitMiddleware({ bucket: rateLimitBuckets.trpcPublic, mode: "lenient" }))');
    const trpcLimiterIndex = appSource.indexOf('app.use("/api/trpc", rateLimitMiddleware');
    const trpcRouterIndex = appSource.indexOf('createExpressMiddleware({');
    expect(trpcLimiterIndex).toBeLessThan(trpcRouterIndex);
  });

  it("caps topup order creation per account", () => {
    expect(routersSource).toContain("rateLimitBuckets.createTopup");
    const limiterIndex = routersSource.indexOf("rateLimitBuckets.createTopup");
    const writeIndex = routersSource.indexOf("db.createTopupOrder");
    expect(limiterIndex).toBeLessThan(writeIndex);
  });
});
