import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  clearLoginFailures,
  evaluateLoginAttempt,
  formatRetryAfterKh,
  getLoginAbuseReport,
  loginBlockMessageKh,
  loginBlockSeconds,
  loginFailureThreshold,
  maskEmail,
  normalizeDeviceId,
  registerLoginFailure,
  resetLoginAbuseGuardForTests,
  type LoginActor,
} from "./loginAbuseGuard";

/*
 * These run against the in-memory fallback (no Upstash credentials in CI), which
 * is the same code path a Redis outage takes. The Redis path is exercised in
 * staging; what matters here is that the *policy* is right, because the policy
 * is identical in both backends.
 */

const serverDir = __dirname;

function actor(overrides: Partial<LoginActor> = {}): LoginActor {
  return {
    ip: "203.0.113.10",
    deviceId: "device-aaaaaaaaaaaaaaaaaaaa",
    email: "player@example.com",
    userAgent: "Mozilla/5.0 (Linux; Android 13)",
    ...overrides,
  };
}

async function failTimes(count: number, input: LoginActor) {
  let last = await evaluateLoginAttempt({ actor: input, intent: "verify" });
  for (let index = 0; index < count; index += 1) {
    last = await registerLoginFailure({ actor: input, intent: "verify" });
  }
  return last;
}

beforeEach(() => {
  resetLoginAbuseGuardForTests();
});

describe("failure counting", () => {
  it("allows the first four wrong codes and reports the remaining budget", async () => {
    const target = actor();
    const decision = await failTimes(loginFailureThreshold - 1, target);

    expect(decision.allowed).toBe(true);
    expect(decision.strikes).toBe(4);
    expect(decision.remainingAttempts).toBe(1);
  });

  it("blocks on the fifth wrong code for a full 24 hours", async () => {
    const target = actor();
    const decision = await failTimes(loginFailureThreshold, target);

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("too_many_failed_codes");
    expect(decision.retryAfterSeconds).toBe(loginBlockSeconds);
    expect(loginBlockSeconds).toBe(24 * 60 * 60);
  });

  it("keeps refusing the same actor after the block is set", async () => {
    const target = actor();
    await failTimes(loginFailureThreshold, target);

    const next = await evaluateLoginAttempt({ actor: target, intent: "request" });
    expect(next.allowed).toBe(false);
    expect(next.retryAfterSeconds).toBeGreaterThan(23 * 60 * 60);
  });
});

describe("cross-device cascade", () => {
  it("blocks a brand new device arriving from the blocked address", async () => {
    const first = actor();
    await failTimes(loginFailureThreshold, first);

    // Same household address, a phone that has never been seen before, and a
    // different mailbox: the storefront asked for this to be refused on contact.
    const second = actor({ deviceId: "device-bbbbbbbbbbbbbbbbbbbb", email: "someone-else@example.com" });
    const decision = await evaluateLoginAttempt({ actor: second, intent: "session" });

    expect(decision.allowed).toBe(false);
    expect(decision.remainingAttempts).toBe(0);
  });

  it("blocks the same device even when it moves to a clean address", async () => {
    const onWifi = actor();
    await evaluateLoginAttempt({ actor: onWifi, intent: "request" });
    await failTimes(loginFailureThreshold, onWifi);

    // Switching to mobile data does not shed the block: the device is blocked
    // in its own right, not merely by association with the address.
    const onMobileData = actor({ ip: "198.51.100.77" });
    const decision = await evaluateLoginAttempt({ actor: onMobileData, intent: "request" });

    expect(decision.allowed).toBe(false);
  });

  it("blocks devices that were linked to the address before the block", async () => {
    const laptop = actor();
    const phone = actor({ deviceId: "device-cccccccccccccccccccc" });

    // Both seen from the same address while everything was still clean.
    await evaluateLoginAttempt({ actor: laptop, intent: "request" });
    await evaluateLoginAttempt({ actor: phone, intent: "request" });

    await failTimes(loginFailureThreshold, laptop);

    // The phone now moves to a completely different address. It is still out.
    const phoneElsewhere = actor({ deviceId: "device-cccccccccccccccccccc", ip: "192.0.2.55" });
    const decision = await evaluateLoginAttempt({ actor: phoneElsewhere, intent: "session" });

    expect(decision.allowed).toBe(false);
  });

  it("does not let a second device shorten the remaining wait", async () => {
    const first = actor();
    await failTimes(loginFailureThreshold, first);
    const original = await evaluateLoginAttempt({ actor: first, intent: "request" });

    const second = actor({ deviceId: "device-dddddddddddddddddddd" });
    const cascaded = await evaluateLoginAttempt({ actor: second, intent: "request" });

    // Same deadline, not a fresh 24 hours and not a shorter one.
    expect(Math.abs(cascaded.retryAfterSeconds - original.retryAfterSeconds)).toBeLessThanOrEqual(2);
  });

  it("leaves an unrelated visitor completely alone", async () => {
    await failTimes(loginFailureThreshold, actor());

    const stranger: LoginActor = { ip: "192.0.2.200", deviceId: "device-eeeeeeeeeeeeeeeeeeee", email: "stranger@example.com", userAgent: "Mozilla/5.0" };
    const decision = await evaluateLoginAttempt({ actor: stranger, intent: "request" });

    expect(decision.allowed).toBe(true);
    expect(decision.remainingAttempts).toBe(loginFailureThreshold);
  });
});

describe("successful sign-in", () => {
  it("releases the strike counters", async () => {
    const target = actor();
    await failTimes(3, target);
    await clearLoginFailures({ actor: target });

    const decision = await evaluateLoginAttempt({ actor: target, intent: "request" });
    expect(decision.strikes).toBe(0);
    expect(decision.remainingAttempts).toBe(loginFailureThreshold);
  });

  it("does NOT lift an active block", async () => {
    const target = actor();
    await failTimes(loginFailureThreshold, target);

    // Guessing correctly on attempt six must not end a lockout that started.
    await clearLoginFailures({ actor: target });

    const decision = await evaluateLoginAttempt({ actor: target, intent: "session" });
    expect(decision.allowed).toBe(false);
  });
});

describe("ip report", () => {
  it("records the readable address and masks the mailbox", async () => {
    await failTimes(loginFailureThreshold, actor());
    const report = await getLoginAbuseReport();

    const blocked = report.entries.find((entry) => entry.event === "blocked");
    expect(blocked).toBeDefined();
    expect(blocked?.ip).toBe("203.0.113.10");
    expect(blocked?.email).toBe("pl\u2022\u2022\u2022@example.com");
    expect(blocked?.strikes).toBe(loginFailureThreshold);
    expect(report.activeBlockCount).toBeGreaterThan(0);
  });

  it("never writes a raw device id into the feed", async () => {
    await failTimes(loginFailureThreshold, actor({ deviceId: "device-secretsecretsecret" }));
    const report = await getLoginAbuseReport();

    expect(JSON.stringify(report)).not.toContain("device-secretsecretsecret");
  });

  it("reports every strike, not just the block", async () => {
    await failTimes(3, actor());
    const report = await getLoginAbuseReport();

    expect(report.entries.filter((entry) => entry.event === "strike")).toHaveLength(3);
  });
});

describe("device fingerprints", () => {
  it("accepts a well-formed client id", () => {
    const value = normalizeDeviceId({ deviceId: "abcdefghijklmnop1234", userAgent: "UA", acceptLanguage: "km", ip: "203.0.113.1" });
    expect(value).toBe("abcdefghijklmnop1234");
  });

  it("falls back to a header-derived id when the client sends nothing", () => {
    const value = normalizeDeviceId({ deviceId: null, userAgent: "UA", acceptLanguage: "km", ip: "203.0.113.1" });
    expect(value.startsWith("hdr:")).toBe(true);
  });

  it("rejects a too-short id rather than trusting it", () => {
    const value = normalizeDeviceId({ deviceId: "short", userAgent: "UA", acceptLanguage: "km", ip: "203.0.113.1" });
    expect(value.startsWith("hdr:")).toBe(true);
  });

  it("gives two different browsers on one address different fallbacks", () => {
    const chrome = normalizeDeviceId({ deviceId: null, userAgent: "Chrome", acceptLanguage: "km", ip: "203.0.113.1" });
    const safari = normalizeDeviceId({ deviceId: null, userAgent: "Safari", acceptLanguage: "km", ip: "203.0.113.1" });
    expect(chrome).not.toBe(safari);
  });
});

describe("customer-facing copy", () => {
  it("masks emails without revealing the local part", () => {
    expect(maskEmail("chanmekara@gmail.com")).toBe("ch\u2022\u2022\u2022@gmail.com");
    expect(maskEmail("not-an-email")).toBeNull();
    expect(maskEmail(null)).toBeNull();
  });

  it("formats the remaining time in Khmer", () => {
    expect(formatRetryAfterKh(24 * 3600)).toContain("\u1798\u17c9\u17c4\u1784");
    expect(formatRetryAfterKh(600)).toContain("\u1793\u17b6\u1791\u17b8");
    expect(formatRetryAfterKh(0)).toBe("\u1798\u17bd\u1799\u1797\u17d2\u179b\u17c2\u178f");
  });

  it("tells the visitor when they can return without leaking why they were caught", () => {
    const message = loginBlockMessageKh({ retryAfterSeconds: loginBlockSeconds });
    expect(message).toContain("24");
    expect(message).not.toContain("ip");
    expect(message).not.toContain("device");
  });
});

/*
 * Wiring regressions. The guard is only worth anything if it is actually called
 * from the routes that mint sessions, so these read the sources directly — the
 * same approach rateLimit.test.ts already uses in this repo.
 */
describe("wiring", () => {
  const read = (file: string) => fs.readFileSync(path.join(serverDir, file), "utf8");

  it("guards the session exchange before any account row can be created", () => {
    const source = read("appwriteAuth.ts");
    const guardAt = source.indexOf("evaluateLoginAttempt");
    const upsertAt = source.indexOf("upsertUser");

    expect(guardAt).toBeGreaterThan(-1);
    expect(upsertAt).toBeGreaterThan(-1);
    // Sign-up is closed by the same gate as sign-in only if the check runs first.
    expect(guardAt).toBeLessThan(upsertAt);
  });

  it("clears the counters after a session is minted", () => {
    expect(read("appwriteAuth.ts")).toContain("clearLoginFailures");
  });

  it("registers the login routes in the express app", () => {
    expect(read("app.ts")).toContain("registerLoginAbuseRoutes");
  });

  it("rate limits every login endpoint", () => {
    const source = read("loginAbuseRoutes.ts");
    expect(source).toContain("loginGuardProbe");
    expect(source).toContain("loginOtpRequestIp");
    expect(source).toContain("loginOtpRequestIdentity");
    expect(source).toContain("loginOtpRequestIdentityHour");
    expect(source).toContain("loginVerifyDevice");
  });

  it("defines the login buckets", () => {
    const source = read("rateLimit.ts");
    expect(source).toContain("loginOtpRequestIp");
    expect(source).toContain("loginSessionExchange");
  });

  it("pre-charges the strike before the browser talks to Appwrite", () => {
    const source = read("loginAbuseRoutes.ts");
    const attemptAt = source.indexOf("/api/auth/login/verify-attempt");
    const chargeAt = source.indexOf("registerLoginFailure");

    expect(attemptAt).toBeGreaterThan(-1);
    expect(chargeAt).toBeGreaterThan(attemptAt);
  });

  it("answers a lockout with 423 and a Retry-After", () => {
    const source = read("loginAbuseRoutes.ts");
    expect(source).toContain("status(423)");
    expect(source).toContain("Retry-After");
  });

  it("keeps the admin report behind an admin check", () => {
    const source = read("loginAbuseRoutes.ts");
    const reportAt = source.indexOf("/api/auth/login/report");
    expect(source.slice(reportAt)).toContain('role !== "admin"');
  });
});
