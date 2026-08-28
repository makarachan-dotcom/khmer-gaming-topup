import type { Express, Request, Response } from "express";
import * as db from "./db";
import { createZursSession, getZursSessionCookieOptions, ZURS_SESSION_COOKIE } from "./zursSession";

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
    const jwt = req.body?.jwt;
    if (!isSafeAppwriteJwt(jwt)) return res.status(400).json({ error: "invalid_identity_proof" });

    const account = await getAppwriteAccountFromJwt(jwt);
    if (!account) return res.status(401).json({ error: "identity_verification_failed" });

    try {
      // Linking by an existing verified email preserves an owner-granted role
      // during the one-time migration from the earlier sign-in mechanism.
      const prior = await db.getUserByEmail(account.email);
      const openId = prior?.openId ?? `appwrite:${account.id}`;
      await db.upsertUser({ openId, email: account.email, name: account.name, loginMethod: "appwrite", lastSignedIn: new Date() });
      const user = await db.getUserByOpenId(openId) ?? await db.getUserByEmail(account.email);
      if (!user) return res.status(503).json({ error: "account_storage_unavailable" });

      const session = await createZursSession(user.openId, { email: user.email ?? account.email, name: user.name ?? account.name, displayName: user.displayName, loginMethod: "appwrite" });
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.cookie(ZURS_SESSION_COOKIE, session, getZursSessionCookieOptions(req));
      return res.json({ authenticated: true, user: { id: user.id, name: user.name, displayName: user.displayName, email: user.email, role: user.role } });
    } catch {
      return res.status(503).json({ error: "account_storage_unavailable" });
    }
  });

  app.post("/api/auth/appwrite/logout", (req, res) => {
    clearZursSession(req, res);
    res.status(204).end();
  });
}
