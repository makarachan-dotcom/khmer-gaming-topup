import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { sdk } from "./_core/sdk";
import { getUserByOpenId, bindSecurePaymentLink, cancelSecurePaymentLink, createPaymentLinkProof, issueSecurePaymentLink, markSecurePaymentLinkQrIssued } from "./db";
import { readZursSession, readZursSessionFallbackProfile, ZURS_SESSION_COOKIE } from "./zursSession";
import { clientIpFromRequest, consumeRateLimit, rateLimitBuckets, sendRateLimited } from "./rateLimit";

// Rate limiting lives in ./rateLimit so the counters survive serverless
// instance recycling. A per-process Map cannot stop a distributed brute force.
function clientIp(req: Request) { return clientIpFromRequest(req); }
function proof(value: string) { return createPaymentLinkProof(value); }
function deviceProof(req: Request) { return proof(`${req.header("user-agent") ?? ""}|${req.header("sec-ch-ua") ?? ""}|${req.header("accept-language") ?? ""}`); }
function sessionProof(req: Request) { const cookie = parseCookieHeader(req.headers.cookie ?? "")[ZURS_SESSION_COOKIE] ?? ""; return proof(cookie); }
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
    // Enforced before any authentication or database work so a rejected caller
    // never reaches the payment pipeline. Fail-closed on backend problems.
    const issueDecision = await consumeRateLimit({ bucket: rateLimitBuckets.payKeyIssue, identifier: ip, mode: "strict" });
    if (!issueDecision.allowed) return sendRateLimited(res, issueDecision.retryAfterSeconds);
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
    if (result.state !== "ready") { const invalidDecision = await consumeRateLimit({ bucket: rateLimitBuckets.payLinkInvalid, identifier: clientIp(req), mode: "strict" }); if (!invalidDecision.allowed) { res.setHeader("Retry-After", String(invalidDecision.retryAfterSeconds)); return res.status(429).json({ state: "rate_limited", retryAfter: invalidDecision.retryAfterSeconds }); } return res.status(410).json({ state: result.state }); }
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

export const paymentLinkSecurityConstants = { tokenBytes: 24, linkTtlMinutes: 15, issueLimitPerIpPerFiveMinutes: rateLimitBuckets.payKeyIssue.limit, invalidLimitPerIpPerHour: rateLimitBuckets.payLinkInvalid.limit, durableRateLimitBackend: true, hashesOnly: true } as const;
