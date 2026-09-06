import { beforeEach, describe, expect, it } from "vitest";
import {
  evaluateLoginAttempt,
  inspectActorBlock,
  liftLoginBan,
  listActiveLoginBans,
  loginFailureThreshold,
  registerLoginFailure,
  resetLoginAbuseGuardForTests,
  type LoginActor,
} from "./loginAbuseGuard";

/*
 * The admin side of the lockout: can an operator see who is banned, and can
 * they release them?
 *
 * These run against the in-memory fallback, which is the same code path a Redis
 * outage takes. What is being asserted is the policy, and the policy is
 * identical in both backends.
 */

function actor(overrides: Partial<LoginActor> = {}): LoginActor {
  return {
    ip: "203.0.113.55",
    deviceId: "device-admin-test",
    email: "member@example.com",
    userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A155F) Chrome/124.0.0.0 Mobile Safari/537.36",
    deviceLabel: "Samsung Galaxy A15 · Android 14 · Chrome",
    ...overrides,
  };
}

async function banActor(subject: LoginActor) {
  for (let attempt = 0; attempt < loginFailureThreshold; attempt += 1) {
    await registerLoginFailure({ actor: subject, intent: "verify" });
  }
}

beforeEach(() => {
  resetLoginAbuseGuardForTests();
});

describe("active ban listing", () => {
  it("surfaces the banned actor with the address and phone model attached", async () => {
    await banActor(actor());

    const { bans } = await listActiveLoginBans();
    expect(bans.length).toBeGreaterThan(0);

    // The operator needs to recognise a real customer before releasing them.
    const ipBan = bans.find((ban) => ban.scope === "ip");
    expect(ipBan).toBeDefined();
    expect(ipBan?.ip).toBe("203.0.113.55");
    expect(ipBan?.device).toContain("Samsung");
    expect(ipBan?.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("drops entries once they expire rather than showing stale bans", async () => {
    const { bans } = await listActiveLoginBans();
    expect(bans).toEqual([]);
  });
});

describe("lifting a ban", () => {
  it("restores access for the released actor", async () => {
    const subject = actor();
    await banActor(subject);

    const blockedBefore = await inspectActorBlock({ ip: subject.ip, deviceId: subject.deviceId });
    expect(blockedBefore.blocked).toBe(true);

    const { bans } = await listActiveLoginBans();
    const ipBan = bans.find((ban) => ban.scope === "ip");
    expect(ipBan).toBeDefined();

    const result = await liftLoginBan({ id: ipBan!.id, actorLabel: "owner@example.com" });
    expect(result.lifted).toBe(true);

    const blockedAfter = await inspectActorBlock({ ip: subject.ip, deviceId: subject.deviceId });
    expect(blockedAfter.blocked).toBe(false);
  });

  it("clears the strike counter too, so the next mistake does not re-ban instantly", async () => {
    const subject = actor();
    await banActor(subject);

    const { bans } = await listActiveLoginBans();
    for (const ban of bans) {
      await liftLoginBan({ id: ban.id, actorLabel: "owner@example.com" });
    }

    // A released member gets the full allowance back. Releasing someone into a
    // state where one typo re-bans them would make the unban button useless.
    const decision = await evaluateLoginAttempt({ actor: subject, intent: "verify" });
    expect(decision.allowed).toBe(true);
    expect(decision.remainingAttempts).toBe(loginFailureThreshold);
  });

  it("reports failure for an unknown id instead of pretending to succeed", async () => {
    const result = await liftLoginBan({ id: "ip:deadbeefdeadbeef", actorLabel: "owner@example.com" });
    expect(result.lifted).toBe(false);
  });

  it("rejects a malformed id rather than treating it as a key", async () => {
    const result = await liftLoginBan({ id: "not-a-valid-id", actorLabel: "owner@example.com" });
    expect(result.lifted).toBe(false);
  });
});

describe("site-wide inspection", () => {
  it("does not create or escalate anything when it only inspects", async () => {
    const subject = actor({ ip: "203.0.113.99", deviceId: "device-clean" });

    // `inspectActorBlock` runs on every API request, so it must be read-only:
    // if it charged a strike or cascaded, simply browsing the storefront would
    // eventually ban the visitor.
    for (let index = 0; index < 10; index += 1) {
      const verdict = await inspectActorBlock({ ip: subject.ip, deviceId: subject.deviceId });
      expect(verdict.blocked).toBe(false);
    }

    const decision = await evaluateLoginAttempt({ actor: subject, intent: "request" });
    expect(decision.allowed).toBe(true);
    expect(decision.remainingAttempts).toBe(loginFailureThreshold);

    const { bans } = await listActiveLoginBans();
    expect(bans).toEqual([]);
  });
});
