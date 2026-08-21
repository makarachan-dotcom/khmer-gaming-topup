import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import * as db from "./db";
import { decryptRefreshToken, encryptRefreshToken, sendGmailWelcomeEmail } from "./gmailWelcome";
import { isSingleAdminEmail } from "./storefrontDomain";
import { createZursSession, getZursSessionCookieOptions, readZursSession, ZURS_SESSION_COOKIE } from "./zursSession";

const STATE_COOKIE = "zurs_google_oauth_state";
const LOGIN_SCOPES = ["openid", "email", "profile"];
const GMAIL_SEND_SCOPE = "https://www.googleapis.com/auth/gmail.send";

type OAuthIntent = "sign_in" | "gmail_sender";
type StatePayload = { state: string; intent: OAuthIntent; returnPath: string; callbackUrl: string; expiresAt: number };
type GoogleToken = { access_token?: string; refresh_token?: string; error?: string; error_description?: string };
type GoogleProfile = { id?: string; email?: string; verified_email?: boolean; name?: string };

export function resolveGoogleUserOpenId(existing: { openId: string } | undefined, googleProfileId: string) {
  return existing?.openId ?? `google:${googleProfileId}`;
}

export function shouldQueueWelcomeEmail(input: { hasExistingDelivery: boolean; hasAuthorizedSender: boolean }) {
  return !input.hasExistingDelivery && input.hasAuthorizedSender;
}

export function getGoogleCallbackFailureReference(stage: "token" | "profile" | "user" | "session" | "welcome") {
  return `GOOGLE_${stage.toUpperCase()}_FAILED`;
}

export function getGoogleOAuthStatus(env = process.env) {
  const configured = Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
  return { configured, callbackPath: "/api/auth/google/callback", reason: configured ? null : "Google OAuth credentials have not been configured yet." } as const;
}

export function getGoogleCallbackUrl(req: Pick<Request, "protocol" | "get" | "headers">, env = process.env) {
  const configured = env.GOOGLE_OAUTH_REDIRECT_URI;
  if (configured && /^https:\/\/[^/]+\/api\/auth\/google\/callback$/.test(configured)) return configured;
  const host = req.get("host") ?? "";
  const hostname = host.replace(/:\d+$/, "").toLowerCase();
  if (hostname.endsWith(".a.run.app")) return "https://khmergame-girzfgts.manus.space/api/auth/google/callback";
  const forwarded = req.headers["x-forwarded-proto"];
  const forwardedHttps = typeof forwarded === "string" && forwarded.split(",").some((value) => value.trim() === "https");
  const managedHttpsHost = hostname.endsWith(".manus.space") || hostname.endsWith(".manus.computer") || hostname.endsWith("vercel.app");
  return `${forwardedHttps || managedHttpsHost || req.protocol === "https" ? "https" : "http"}://${host}/api/auth/google/callback`;
}
function safeReturnPath(value: unknown) { return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/account"; }
function stateSecret() { const secret = process.env.ZURS_SESSION_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET; if (!secret) throw new Error("Standalone session secret unavailable"); return secret; }
function signature(value: string) { return crypto.createHmac("sha256", stateSecret()).update(value).digest("base64url"); }
function createState(payload: StatePayload) { const body = Buffer.from(JSON.stringify(payload)).toString("base64url"); return `${body}.${signature(body)}`; }
function readState(req: Request): StatePayload | null { const raw = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE]; if (!raw) return null; const [body, received] = raw.split("."); const expected = body ? signature(body) : ""; if (!body || !received || expected.length !== received.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received))) return null; try { const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload; return payload.expiresAt > Date.now() && /^https:\/\/[^/]+\/api\/auth\/google\/callback$/.test(payload.callbackUrl) ? payload : null; } catch { return null; } }

function redirectToGoogle(req: Request, res: Response, intent: OAuthIntent, returnPath: string) {
  const status = getGoogleOAuthStatus(); if (!status.configured) return res.status(503).json({ ...status, callbackUrl: getGoogleCallbackUrl(req) });
  const state = crypto.randomBytes(32).toString("base64url"); const callbackUrl = getGoogleCallbackUrl(req); const payload: StatePayload = { state, intent, returnPath: safeReturnPath(returnPath), callbackUrl, expiresAt: Date.now() + 10 * 60 * 1000 };
  res.cookie(STATE_COOKIE, createState(payload), { ...getZursSessionCookieOptions(req), maxAge: 10 * 60 * 1000 });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!); url.searchParams.set("redirect_uri", callbackUrl); url.searchParams.set("response_type", "code"); url.searchParams.set("scope", [...LOGIN_SCOPES, ...(intent === "gmail_sender" ? [GMAIL_SEND_SCOPE] : [])].join(" ")); url.searchParams.set("state", state); url.searchParams.set("include_granted_scopes", "true");
  if (intent === "gmail_sender") { url.searchParams.set("access_type", "offline"); url.searchParams.set("prompt", "consent"); url.searchParams.set("login_hint", "chanmakara672@gmail.com"); }
  return res.redirect(url.toString());
}

async function exchangeCode(callbackUrl: string, code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!, client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!, redirect_uri: callbackUrl, grant_type: "authorization_code" }) });
  const token = await response.json() as GoogleToken; if (!response.ok || !token.access_token) throw new Error(token.error_description ?? token.error ?? "Google code exchange failed"); return token;
}

async function fetchProfile(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${accessToken}` } }); const profile = await response.json() as GoogleProfile; if (!response.ok || !profile.id || !profile.email || !profile.verified_email) throw new Error("Google did not return a verified email address"); return profile as Required<Pick<GoogleProfile, "id" | "email">> & GoogleProfile;
}

async function sendWelcomeIfEligible(user: { id: number; email: string | null; name: string | null }) {
  if (!user.email) return;
  const existing = await db.getWelcomeEmailDelivery(user.id); const sender = await db.getGmailSenderConnection();
  if (!shouldQueueWelcomeEmail({ hasExistingDelivery: Boolean(existing), hasAuthorizedSender: Boolean(sender) }) || !sender) return;
  try { const providerMessageId = await sendGmailWelcomeEmail({ refreshToken: decryptRefreshToken(sender.encryptedRefreshToken), senderEmail: sender.senderEmail, recipientEmail: user.email, recipientName: user.name ?? "ZURS Member" }); await db.recordWelcomeEmailDelivery({ recipientUserId: user.id, recipientEmail: user.email, senderConnectionId: sender.id, providerMessageId, status: "sent" }); } catch (error) { console.error("[Gmail] Welcome email failed", error); await db.recordWelcomeEmailDelivery({ recipientUserId: user.id, recipientEmail: user.email, senderConnectionId: sender.id, status: "failed" }); }
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/status", async (req, res) => { const sender = await db.getGmailSenderConnection(); res.json({ ...getGoogleOAuthStatus(), callbackUrl: getGoogleCallbackUrl(req), gmailSenderConnected: Boolean(sender), senderEmail: sender?.senderEmail ?? null }); });
  app.get("/api/auth/google/diagnostic", (req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ routeVersion: "oauth-callback-v3", callbackUrl: getGoogleCallbackUrl(req), databaseConfigured: Boolean(process.env.DATABASE_URL) }); });
  app.get("/api/auth/google", (req, res) => redirectToGoogle(req, res, "sign_in", typeof req.query.returnTo === "string" ? req.query.returnTo : "/account"));
  app.get("/api/auth/google/sender", async (req, res) => { const openId = await readZursSession(req); const user = openId ? await db.getUserByOpenId(openId) : null; if (!user || !isSingleAdminEmail(user.email)) return res.status(401).json({ error: "Sign in as the designated administrator before authorizing Gmail." }); return redirectToGoogle(req, res, "gmail_sender", "/account?gmail=connected"); });
  app.get("/api/auth/google/callback", async (req, res) => { const saved = readState(req); res.clearCookie(STATE_COOKIE, getZursSessionCookieOptions(req)); if (!saved || saved.state !== req.query.state || typeof req.query.code !== "string") return res.status(400).send("Google authorization state expired or did not match. Please try again."); try { const token = await exchangeCode(saved.callbackUrl, req.query.code); const profile = await fetchProfile(token.access_token!); const email = profile.email.toLowerCase(); if (saved.intent === "gmail_sender") { const openId = await readZursSession(req); const currentUser = openId ? await db.getUserByOpenId(openId) : null; if (!currentUser || !isSingleAdminEmail(currentUser.email) || email !== "chanmakara672@gmail.com") return res.status(403).send("The Gmail sender must be authorized by the designated administrator account."); if (!token.refresh_token) return res.status(400).send("Google did not return a refresh token. Remove the app from your Google account and authorize Gmail again."); await db.upsertGmailSenderConnection({ ownerUserId: currentUser.id, senderEmail: email, encryptedRefreshToken: encryptRefreshToken(token.refresh_token) }); return res.redirect(saved.returnPath); }
    const existingByEmail = await db.getUserByEmail(email); const openId = resolveGoogleUserOpenId(existingByEmail, profile.id); await db.upsertUser({ openId, name: profile.name ?? null, email, loginMethod: "google", lastSignedIn: new Date() }); const user = await db.getUserByOpenId(openId); if (!user) throw new Error("Unable to create Google user session"); const session = await createZursSession(openId); res.cookie(ZURS_SESSION_COOKIE, session, getZursSessionCookieOptions(req)); await sendWelcomeIfEligible(user); return res.redirect(saved.returnPath);
  } catch (error) { const detail = error instanceof Error ? error.message : "unknown error"; console.error("[Google OAuth] callback failed", detail); return res.status(500).send("Google sign-in could not be completed. Please try again."); } });
}
