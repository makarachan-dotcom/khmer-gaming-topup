import crypto from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";
import type { User } from "../drizzle/schema";
import { isSingleAdminEmail } from "./storefrontDomain";

export const ZURS_SESSION_COOKIE = "zurs_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

type FallbackProfileInput = { openId: string; email: string; name?: string | null; loginMethod?: string | null };
type SessionClaims = { openId?: unknown; fallbackProfile?: unknown };

function fallbackUserId(openId: string) {
  return 1_000_000_000 + parseInt(crypto.createHash("sha256").update(openId).digest("hex").slice(0, 7), 16);
}

function fallbackProfile(input: FallbackProfileInput): User {
  const now = new Date();
  const email = input.email.trim().toLowerCase();
  return {
    id: fallbackUserId(input.openId),
    openId: input.openId,
    name: input.name ?? null,
    displayName: null,
    email,
    loginMethod: input.loginMethod ?? "google",
    role: isSingleAdminEmail(email) ? "admin" : "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
  };
}

function sessionFallbackProfile(value: unknown): User | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<FallbackProfileInput>;
  if (typeof candidate.openId !== "string" || typeof candidate.email !== "string") return null;
  return fallbackProfile({ openId: candidate.openId, email: candidate.email, name: typeof candidate.name === "string" ? candidate.name : null, loginMethod: typeof candidate.loginMethod === "string" ? candidate.loginMethod : "google" });
}

function sessionKey(env = process.env) {
  const secret = env.ZURS_SESSION_SECRET ?? env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) throw new Error("Standalone session secret is unavailable");
  return new TextEncoder().encode(secret);
}

export function getZursSessionCookieOptions(req: Pick<Request, "protocol" | "headers">) {
  const forwarded = req.headers["x-forwarded-proto"];
  const secure = req.protocol === "https" || (typeof forwarded === "string" && forwarded.split(",").some((value) => value.trim() === "https"));
  return { httpOnly: true, secure, sameSite: "lax" as const, path: "/", maxAge: SESSION_TTL_SECONDS * 1000 };
}

export async function createZursSession(openId: string, fallback?: Omit<FallbackProfileInput, "openId">) {
  const fallbackProfileClaim = fallback ? { openId, email: fallback.email.trim().toLowerCase(), name: fallback.name ?? null, loginMethod: fallback.loginMethod ?? "google" } : undefined;
  return new SignJWT({ openId, ...(fallbackProfileClaim ? { fallbackProfile: fallbackProfileClaim } : {}) }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(`${SESSION_TTL_SECONDS}s`).sign(sessionKey());
}

async function readSessionClaims(req: Pick<Request, "headers">): Promise<SessionClaims | null> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[ZURS_SESSION_COOKIE];
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, sessionKey()); return payload as SessionClaims; } catch { return null; }
}

export async function readZursSession(req: Pick<Request, "headers">) {
  const claims = await readSessionClaims(req);
  return typeof claims?.openId === "string" ? claims.openId : null;
}

export async function readZursSessionFallbackProfile(req: Pick<Request, "headers">) {
  const claims = await readSessionClaims(req);
  return sessionFallbackProfile(claims?.fallbackProfile);
}
