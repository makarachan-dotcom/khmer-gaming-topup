import { jwtVerify, SignJWT } from "jose";
import type { Request } from "express";
import { parse as parseCookieHeader } from "cookie";

export const ZURS_SESSION_COOKIE = "zurs_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 365;

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

export async function createZursSession(openId: string) {
  return new SignJWT({ openId }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(`${SESSION_TTL_SECONDS}s`).sign(sessionKey());
}

export async function readZursSession(req: Pick<Request, "headers">) {
  const token = parseCookieHeader(req.headers.cookie ?? "")[ZURS_SESSION_COOKIE];
  if (!token) return null;
  try { const { payload } = await jwtVerify(token, sessionKey()); return typeof payload.openId === "string" ? payload.openId : null; } catch { return null; }
}
