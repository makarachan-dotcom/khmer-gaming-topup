import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./_core/sdk";
import { getUserByOpenId, bindSecurePaymentLink, cancelSecurePaymentLink, createPaymentLinkProof, issueSecurePaymentLink, markSecurePaymentLinkQrIssued } from "./db";
import { readZursSession, readZursSessionFallbackProfile, ZURS_SESSION_COOKIE } from "./zursSession";

const issueLimiter = new Map<string, number[]>();
const invalidLimiter = new Map<string, number[]>();
const minute = 60_000;
const hour = 60 * minute;

function clientIp(req: Request) { return String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "unknown").split(",")[0].trim(); }
function proof(value: string) { return createPaymentLinkProof(value); }
function deviceProof(req: Request) { return proof(`${req.header("user-agent") ?? ""}|${req.header("sec-ch-ua") ?? ""}|${req.header("accept-language") ?? ""}`); }
function sessionProof(req: Request) { const cookie = parseCookieHeader(req.headers.cookie ?? "")[ZURS_SESSION_COOKIE] ?? ""; return proof(cookie); }
function limited(bucket: Map<string, number[]>, key: string, windowMs: number, maximum: number) { const now = Date.now(); const hits = (bucket.get(key) ?? []).filter((stamp) => now - stamp < windowMs); hits.push(now); bucket.set(key, hits); return hits.length > maximum; }
function secureHeaders(res: Response) { res.setHeader("Cache-Control", "no-store, private, max-age=0"); res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive"); }

async function resolveUser(req: Request) {
  try { return await sdk.authenticateRequest(req); } catch {
    const fallback = await readZursSessionFallbackProfile(req);
    if (fallback) return fallback;
    const openId = await readZursSession(req);
    return openId ? await getUserByOpenId(openId) ?? null : null;
  }
}

function tokenFrom(req: Request) { return typeof req.params.token === "string" && /^[A-Za-z0-9_-]{24,80}$/.test(req.params.token) ? req.params.token : null; }
function auditIp(req: Request) { return proof(clientIp(req)); }

export function registerSecurePaymentLinkRoutes(app: Express) {
  app.post("/api/pay/security/check/key", async (req, res) => {
    secureHeaders(res);
    const ip = clientIp(req);
    if (limited(issueLimiter, ip, minute, 5)) return res.status(429).json({ code: "RATE_LIMITED" });
    const user = await resolveUser(req);
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId.trim() : "";
    if (!user || !orderId || orderId.length > 64) return res.status(401).json({ code: "UNAUTHORIZED" });
    try {
      const result = await issueSecurePaymentLink({ orderId, userId: user.id, ipHash: auditIp(req) });
      if (!result.token) return res.status(409).json({ code: "ACTIVE_LINK_EXISTS", expiresAt: result.expiresAt });
      return res.status(201).json({ token: result.token, expiresAt: result.expiresAt });
    } catch (error) {
      const code = (error as { code?: string }).code;
      return res.status(code === "PAYMENTS_CLOSED" ? 403 : 409).json({ code: code ?? "PAYMENT_LINK_REJECTED" });
    }
  });

  app.get("/api/pay/:token", async (req, res) => {
    secureHeaders(res);
    const token = tokenFrom(req); const user = await resolveUser(req);
    if (!token || !user) return res.status(401).json({ state: "used" });
    const result = await bindSecurePaymentLink({ token, userId: user.id, sessionHash: sessionProof(req), deviceHash: deviceProof(req), ipHash: auditIp(req) });
    if (result.state !== "ready") { const ip = clientIp(req); if (limited(invalidLimiter, ip, hour, 10)) return res.status(429).json({ state: "rate_limited" }); return res.status(410).json({ state: result.state }); }
    return res.json({ state: "ready", expiresAt: result.link!.expiresAt, tokenPrefix: result.link!.tokenPrefix });
  });

  app.post("/api/pay/:token/confirm-method", async (req, res) => {
    secureHeaders(res);
    const token = tokenFrom(req); const user = await resolveUser(req);
    if (!token || !user || req.body?.method !== "khqr") return res.status(401).json({ code: "UNAUTHORIZED" });
    try {
      const binding = await bindSecurePaymentLink({ token, userId: user.id, sessionHash: sessionProof(req), deviceHash: deviceProof(req), ipHash: auditIp(req) });
      if (binding.state !== "ready" || !binding.link) return res.status(410).json({ state: binding.state });
      const session = await (await import("./db")).beginStagedPayment({ orderId: binding.link.orderId, userId: user.id });
      await markSecurePaymentLinkQrIssued({ token, userId: user.id, sessionHash: sessionProof(req), deviceHash: deviceProof(req), ipHash: auditIp(req) });
      return res.json({ order: session.order, payment: session.payment });
    } catch (error) { const code = (error as { code?: string }).code; return res.status(code === "PAYMENTS_CLOSED" ? 403 : 409).json({ code: code ?? "PAYMENT_LINK_REJECTED" }); }
  });

  app.post("/api/pay/:token/cancel", async (req, res) => {
    secureHeaders(res);
    const token = tokenFrom(req); const user = await resolveUser(req);
    if (!token || !user) return res.status(401).json({ state: "used" });
    const result = await cancelSecurePaymentLink({ token, userId: user.id, sessionHash: sessionProof(req), deviceHash: deviceProof(req), ipHash: auditIp(req) });
    return res.json(result);
  });
}

export const paymentLinkSecurityConstants = { tokenBytes: 24, linkTtlMinutes: 15, issueLimitPerIpPerMinute: 5, invalidLimitPerIpPerHour: 10, hashesOnly: true } as const;
