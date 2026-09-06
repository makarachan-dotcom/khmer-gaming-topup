/**
 * HTTP surface for the /login abuse guard.
 *
 * Why the browser has to talk to us at all: the one-time code is verified by
 * Appwrite directly from the browser, so our server never sees a wrong code.
 * A client that simply "forgets" to report its failures would then be immune,
 * which is why the flow is **pre-charged**:
 *
 *   1. `POST /api/auth/login/verify-attempt` — charges the strike and hands
 *      back a claim id, BEFORE the browser talks to Appwrite.
 *   2. `POST /api/auth/login/verify-result` — refunds that strike only when the
 *      code was actually correct.
 *
 * Skipping step 2 therefore costs the attacker a strike; skipping step 1 costs
 * them the session, because `/api/auth/appwrite/session` re-runs the guard and
 * is the only route that mints a ZURS cookie or creates an account row.
 */

import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getUserByOpenId } from "./db";
import { readZursSession, readZursSessionFallbackProfile } from "./zursSession";
import { clientIpFromRequest, consumeRateLimit, rateLimitBuckets, sendRateLimited } from "./rateLimit";
import {
  clearLoginFailures,
  evaluateLoginAttempt,
  getLoginAbuseReport,
  liftLoginBan,
  listActiveLoginBans,
  loginBlockMessageKh,
  loginFailureThreshold,
  normalizeDeviceId,
  registerLoginFailure,
  type LoginActor,
  type LoginGuardDecision,
  type LoginIntent,
} from "./loginAbuseGuard";
import { describeRequestDevice } from "./deviceInsight";

const CLAIM_TTL_MS = 10 * 60 * 1000;
const claims = new Map<string, { fingerprint: string; expiresAt: number }>();

function sweepClaims(now = Date.now()) {
  claims.forEach((claim, id) => {
    if (claim.expiresAt <= now) claims.delete(id);
  });
  if (claims.size > 10_000) claims.clear();
}

function actorFingerprint(actor: LoginActor) {
  return crypto.createHash("sha256").update(`${actor.ip}|${actor.deviceId}`).digest("hex").slice(0, 24);
}

function secureHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

function readEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length >= 5 && email.length <= 320 && /^\S+@\S+\.\S+$/.test(email) ? email : null;
}

function readIntent(value: unknown): LoginIntent {
  return value === "verify" || value === "session" ? value : "request";
}

/**
 * Builds the actor for this request. The device id is client-supplied and
 * therefore untrusted, but it is never used as an authorisation token — only as
 * a grouping key that can add restrictions, never remove them. A caller who
 * rotates it on every request loses the ability to be recognised, and lands in
 * the header-derived fallback bucket instead.
 */
export function loginActorFromRequest(req: Request): LoginActor {
  const ip = clientIpFromRequest(req);
  const userAgent = req.header("user-agent") ?? null;
  const headerDevice = req.header("x-zurs-device");
  const bodyDevice = typeof req.body?.deviceId === "string" ? req.body.deviceId : null;
  return {
    ip,
    deviceId: normalizeDeviceId({ deviceId: headerDevice ?? bodyDevice, userAgent, acceptLanguage: req.header("accept-language") ?? null, ip }),
    email: readEmail(req.body?.email),
    userAgent,
    // Readable phone/browser description for the admin ban table. Derived from
    // the User-Agent plus Client Hints, and used for display only — never as a
    // key, so a spoofed value cannot move an attacker into a different bucket.
    deviceLabel: describeRequestDevice(req).label,
  };
}

/** One response shape for every guard endpoint, so the client has one branch. */
function guardPayload(decision: LoginGuardDecision) {
  return {
    allowed: decision.allowed,
    blocked: !decision.allowed,
    retryAfter: decision.retryAfterSeconds,
    strikes: decision.strikes,
    remainingAttempts: decision.remainingAttempts,
    threshold: loginFailureThreshold,
    durable: !decision.degraded,
    message: decision.allowed ? null : loginBlockMessageKh(decision),
  };
}

function sendBlocked(res: Response, decision: LoginGuardDecision) {
  secureHeaders(res);
  res.setHeader("Retry-After", String(Math.max(1, decision.retryAfterSeconds)));
  // 423 Locked, not 429: this is a standing lockout with a known end time, not
  // a burst the caller can retry out of in a few seconds.
  return res.status(423).json({ code: "LOGIN_BLOCKED", ...guardPayload(decision) });
}

/**
 * Same resolution order as `paymentLinkRoutes.ts`: the SDK first, then the ZURS
 * cookie. Typed loosely on purpose — only the role is read here, and the three
 * sources return three different profile shapes.
 */
type Viewer = { role?: string; email?: string | null; displayName?: string | null };

async function resolveViewer(req: Request): Promise<Viewer | null> {
  try {
    return ((await sdk.authenticateRequest(req)) as Viewer | null) ?? null;
  } catch {
    const fallback = (await readZursSessionFallbackProfile(req)) as Viewer | null;
    if (fallback) return fallback;
    const openId = await readZursSession(req);
    if (!openId) return null;
    return ((await getUserByOpenId(openId)) as Viewer | undefined) ?? null;
  }
}

/** Who performed an admin action, for the audit line on an unban. */
function viewerLabel(viewer: Viewer) {
  return viewer.email ?? viewer.displayName ?? "admin";
}

export function registerLoginAbuseRoutes(app: Express) {
  /**
   * Page-load probe and pre-send check. Cheap, read-mostly, and the place the
   * UI learns it should render the countdown instead of the email form.
   */
  app.post("/api/auth/login/guard", async (req, res) => {
    secureHeaders(res);
    const actor = loginActorFromRequest(req);
    const intent = readIntent(req.body?.intent);

    const probe = await consumeRateLimit({ bucket: rateLimitBuckets.loginGuardProbe, identifier: actor.ip, mode: "lenient" });
    if (!probe.allowed) return sendRateLimited(res, probe.retryAfterSeconds);

    const decision = await evaluateLoginAttempt({ actor, intent });
    if (!decision.allowed) return sendBlocked(res, decision);
    return res.json({ code: "OK", ...guardPayload(decision) });
  });

  /**
   * Guarded "send me a code". Runs before Appwrite is contacted so a locked
   * address cannot even cause outbound mail, and so a single mailbox cannot be
   * used to spam a customer with codes.
   */
  app.post("/api/auth/login/request-code", async (req, res) => {
    secureHeaders(res);
    const actor = loginActorFromRequest(req);

    const decision = await evaluateLoginAttempt({ actor, intent: "request" });
    if (!decision.allowed) return sendBlocked(res, decision);

    const byIp = await consumeRateLimit({ bucket: rateLimitBuckets.loginOtpRequestIp, identifier: actor.ip, mode: "strict" });
    if (!byIp.allowed) return sendRateLimited(res, byIp.retryAfterSeconds);

    if (actor.email) {
      const byIdentity = await consumeRateLimit({ bucket: rateLimitBuckets.loginOtpRequestIdentity, identifier: actor.email, mode: "strict" });
      if (!byIdentity.allowed) return sendRateLimited(res, byIdentity.retryAfterSeconds);
    }

    return res.json({ code: "OK", ...guardPayload(decision) });
  });

  /**
   * Pre-charges one strike. The browser must call this immediately before it
   * asks Appwrite to check a code; abandoning the flow here is indistinguishable
   * from a wrong code, which is the safe direction to be wrong in.
   */
  app.post("/api/auth/login/verify-attempt", async (req, res) => {
    secureHeaders(res);
    const actor = loginActorFromRequest(req);

    const decision = await evaluateLoginAttempt({ actor, intent: "verify" });
    if (!decision.allowed) return sendBlocked(res, decision);

    const burst = await consumeRateLimit({ bucket: rateLimitBuckets.loginVerifyDevice, identifier: actor.deviceId, mode: "strict" });
    if (!burst.allowed) return sendRateLimited(res, burst.retryAfterSeconds);

    const charged = await registerLoginFailure({ actor, intent: "verify", reason: "attempt_opened" });
    if (!charged.allowed) return sendBlocked(res, charged);

    sweepClaims();
    const claimId = crypto.randomBytes(18).toString("base64url");
    claims.set(claimId, { fingerprint: actorFingerprint(actor), expiresAt: Date.now() + CLAIM_TTL_MS });
    return res.json({ code: "OK", claimId, ...guardPayload(charged) });
  });

  /**
   * Settles a pre-charged attempt. `outcome: "success"` clears the counters;
   * anything else leaves the strike standing and reports the current position.
   * The claim is single-use and bound to the address+device that opened it, so
   * one success cannot launder somebody else's strikes.
   */
  app.post("/api/auth/login/verify-result", async (req, res) => {
    secureHeaders(res);
    const actor = loginActorFromRequest(req);
    const claimId = typeof req.body?.claimId === "string" ? req.body.claimId : "";
    const success = req.body?.outcome === "success";

    sweepClaims();
    const claim = claims.get(claimId);
    const claimValid = Boolean(claim && claim.fingerprint === actorFingerprint(actor));
    if (claim) claims.delete(claimId);

    if (success && claimValid) {
      await clearLoginFailures({ actor, intent: "verify" });
      return res.json({ code: "OK", allowed: true, blocked: false, retryAfter: 0, strikes: 0, remainingAttempts: loginFailureThreshold, threshold: loginFailureThreshold, durable: true, message: null });
    }

    const decision = await evaluateLoginAttempt({ actor, intent: "verify" });
    if (!decision.allowed) return sendBlocked(res, decision);
    return res.json({ code: "OK", ...guardPayload(decision) });
  });

  /**
   * Operator view of the IP report. Admin only, and never cached: it contains
   * readable addresses on purpose so a human can act on a pattern.
   */
  app.get("/api/auth/login/report", async (req, res) => {
    secureHeaders(res);
    const viewer = await resolveViewer(req);
    if (!viewer || viewer.role !== "admin") return res.status(403).json({ code: "FORBIDDEN" });
    return res.json(await getLoginAbuseReport());
  });

  /**
   * Active bans, with the readable address and phone model attached.
   *
   * Mounted under `/api/admin/` because `ipBanGuard` exempts that prefix: an
   * operator whose own address got caught in a cascade must still be able to
   * reach this page and release it. The admin check below is what protects it.
   */
  app.get("/api/admin/login-bans", async (req, res) => {
    secureHeaders(res);
    const viewer = await resolveViewer(req);
    if (!viewer || viewer.role !== "admin") return res.status(403).json({ code: "FORBIDDEN" });
    const { durable, bans } = await listActiveLoginBans();
    return res.json({ durable, threshold: loginFailureThreshold, bans });
  });

  /**
   * Lift one ban. Admin only, rate limited, and audited: the report feed
   * records which operator released which actor.
   */
  app.post("/api/admin/login-bans/lift", async (req, res) => {
    secureHeaders(res);
    const viewer = await resolveViewer(req);
    if (!viewer || viewer.role !== "admin") return res.status(403).json({ code: "FORBIDDEN" });

    // Even an admin endpoint gets a budget: a compromised admin session should
    // not be able to clear the entire ban list in one burst.
    const limit = await consumeRateLimit({ bucket: rateLimitBuckets.loginGuardProbe, identifier: `unban:${viewerLabel(viewer)}`, mode: "strict" });
    if (!limit.allowed) return sendRateLimited(res, limit.retryAfterSeconds);

    const id = typeof req.body?.id === "string" ? req.body.id.trim() : "";
    if (!id || id.length > 128) return res.status(400).json({ code: "INVALID_ID" });

    const result = await liftLoginBan({ id, actorLabel: viewerLabel(viewer) });
    if (!result.lifted) return res.status(404).json({ code: "BAN_NOT_FOUND" });
    const { durable, bans } = await listActiveLoginBans();
    return res.json({ lifted: true, durable, bans });
  });
}

/** Test seam: clears the in-process verify claims. */
export function resetLoginClaimsForTests() {
  claims.clear();
}
