import type { Express, Request, Response } from "express";
import * as db from "./db";
import { createZursSession, getZursSessionCookieOptions, ZURS_SESSION_COOKIE } from "./zursSession";
import { consumeRateLimit, rateLimitBuckets, sendRateLimited } from "./rateLimit";
import { clearLoginFailures, evaluateLoginAttempt, loginBlockMessageKh, loginFailureThreshold } from "./loginAbuseGuard";
import { loginActorFromRequest } from "./loginAbuseRoutes";

type AppwriteAccount = { $id?: unknown; email?: unknown; name?: unknown; emailVerification?: unknown };

type AppwriteAuthConfig = {
  endpoint: string;
  projectId: string;
};

export function getAppwriteAuthConfig(env = process.env): AppwriteAuthConfig | null {
  const endpoint = env.APPWRITE_ENDPOINT?.trim().replace(/\/$/, "");
  const projectId = env.APPWRITE_PROJECT_ID?.trim();
  if (!endpoint || !projectId || !/^https:\/\/[^/]+\/v1$/.test(endpoint)) return null;
  return { endpoint, projectId };
}

export function isSafeAppwriteJwt(value: unknown): value is string {
  return typeof value === "string" && value.length >= 20 && value.length <= 8_192;
}

function publicAccount(value: AppwriteAccount) {
  const id = typeof value.$id === "string" ? value.$id : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const name = typeof value.name === "string" && value.name.trim() ? value.name.trim().slice(0, 128) : null;
  if (!id || !email) return null;
  return { id, email, name };
}

/**
 * Validates a short-lived JWT minted by the Appwrite browser session. The token
 * is not logged, stored, or returned. Appwrite remains the identity authority.
 */
export async function getAppwriteAccountFromJwt(jwt: string, env = process.env) {
  const config = getAppwriteAuthConfig(env);
  if (!config || !isSafeAppwriteJwt(jwt)) return null;
  try {
    const response = await fetch(`${config.endpoint}/account`, {
      headers: {
        "X-Appwrite-Project": config.projectId,
        "X-Appwrite-JWT": jwt,
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    return publicAccount(await response.json() as AppwriteAccount);
  } catch {
    return null;
  }
}

function clearZursSession(req: Request, res: Response) {
  res.clearCookie(ZURS_SESSION_COOKIE, getZursSessionCookieOptions(req));
}

export function registerAppwriteAuthRoutes(app: Express) {
  app.post("/api/auth/appwrite/session", async (req, res) => {
    // This is the enforcing endpoint. Appwrite checks the code in the browser,
    // but nothing becomes an *account* until this route runs: it is the only
    // place a ZURS cookie is minted and the only place `upsertUser` creates a
    // row. Blocking here therefore closes sign-in and sign-up with one gate —
    // "just make a new account from another device" is not a way around the
    // 24 hour lockout, because the new device is blocked on contact.
    const guardActor = loginActorFromRequest(req);
    const guard = await evaluateLoginAttempt({ actor: guardActor, intent: "session" });
    if (!guard.allowed) {
      res.setHeader("Retry-After", String(Math.max(1, guard.retryAfterSeconds)));
      res.setHeader("Cache-Control", "no-store, private, max-age=0");
      return res.status(423).json({ error: "login_blocked", code: "LOGIN_BLOCKED", retryAfter: guard.retryAfterSeconds, threshold: loginFailureThreshold, message: loginBlockMessageKh(guard) });
    }

    const exchange = await consumeRateLimit({ bucket: rateLimitBuckets.loginSessionExchange, identifier: guardActor.deviceId, mode: "strict" });
    if (!exchange.allowed) return sendRateLimited(res, exchange.retryAfterSeconds);

    const jwt = req.body?.jwt;
    if (!isSafeAppwriteJwt(jwt)) return res.status(400).json({ error: "invalid_identity_proof" });

    const account = await getAppwriteAccountFromJwt(jwt);
    if (!account) return res.status(401).json({ error: "identity_verification_failed" });

    try {
      // Linking by an existing verified email preserves an owner-granted role
      // during the one-time migration from the earlier sign-in mechanism.
      const prior = await db.getUserByEmail(account.email);
      const openId = prior?.openId ?? `appwrite:${account.id}`;

      // Whether this mailbox has ever completed sign-in here before. This is
      // the signal the login page uses to decide if the "your name" step is
      // shown at all: it belongs to first-time registration only.
      const isNewUser = !prior;
      const existingName = prior?.displayName?.trim() || prior?.name?.trim() || null;

      // A returning member keeps the name they already saved. Appwrite's
      // account name is only used to seed a brand-new row — re-sending it on
      // every sign-in is exactly what made saved names flip back and forth.
      await db.upsertUser({
        openId,
        email: account.email,
        name: existingName ? undefined : account.name,
        loginMethod: "appwrite",
        lastSignedIn: new Date(),
      });
      const user = await db.getUserByOpenId(openId) ?? await db.getUserByEmail(account.email);
      if (!user) return res.status(503).json({ error: "account_storage_unavailable" });

      // Ask for a name only when we genuinely have none stored. A returning
      // member is never re-prompted, so their name cannot be overwritten by a
      // later sign-in.
      const storedName = user.displayName?.trim() || user.name?.trim() || null;
      const needsName = !storedName;

      const session = await createZursSession(user.openId, { email: user.email ?? account.email, name: user.name ?? account.name, displayName: user.displayName, loginMethod: "appwrite" });
      // A verified identity proves this address/device pair is not the attacker
      // we were counting, so the strike counters are released. An *active* block
      // is deliberately left alone: guessing right on attempt six must not end a
      // lockout that has already started.
      await clearLoginFailures({ actor: { ...guardActor, email: account.email }, intent: "session" });
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.cookie(ZURS_SESSION_COOKIE, session, getZursSessionCookieOptions(req));
      return res.json({
        authenticated: true,
        isNewUser,
        needsName,
        // Echoed back so the client can show the saved name immediately instead
        // of guessing from the Appwrite profile.
        savedName: storedName,
        user: { id: user.id, name: user.name, displayName: user.displayName, email: user.email, role: user.role },
      });
    } catch {
      return res.status(503).json({ error: "account_storage_unavailable" });
    }
  });

  app.post("/api/auth/appwrite/logout", (req, res) => {
    clearZursSession(req, res);
    res.status(204).end();
  });
}
