import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;
const limiters = new Map<string, Ratelimit>();

export const rateLimitConstants = {
  globalApi: { requests: 300, window: "1 m" },
  publicTrpc: { requests: 60, window: "1 m" },
  auth: { requests: 10, window: "1 m" },
  webhook: { requests: 30, window: "1 m" },
  paymentLinkIssue: { requests: 5, window: "1 m" },
  paymentLinkInvalid: { requests: 10, window: "1 h" },
} as const;

function getLimiter(name: string, requests: number, window: "1 m" | "1 h") {
  if (!redis) return null;
  let limiter = limiters.get(name);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: window === "1 h" ? Ratelimit.slidingWindow(requests, "1 h") : Ratelimit.slidingWindow(requests, "1 m"),
      prefix: `zurs:ratelimit:${name}`,
    });
    limiters.set(name, limiter);
  }
  return limiter;
}

function clientIp(req: Request) {
  return req.ip || req.socket.remoteAddress || "unknown";
}

export async function checkRateLimit(req: Request, name: string, requests: number, window: "1 m" | "1 h") {
  const limiter = getLimiter(name, requests, window);
  if (!limiter) return { success: true, reset: Date.now() + (window === "1 h" ? 3_600_000 : 60_000) };
  try {
    return await limiter.limit(clientIp(req));
  } catch (error) {
    // Availability of payment/auth flows takes priority over a transient Redis outage.
    console.error(`[RateLimit] ${name} unavailable`, error instanceof Error ? error.message : error);
    return { success: true, reset: Date.now() + 60_000 };
  }
}

export function rateLimitMiddleware(name: string, requests: number, window: "1 m" | "1 h"): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
    const result = await checkRateLimit(req, name, requests, window);
    if (result.success) return next();
    const retryAfter = Math.max(1, Math.ceil((result.reset - Date.now()) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ error: "Too many requests" });
  };
}

export function isRedisRateLimitingConfigured() {
  return Boolean(redis);
}

export function retryAfterSeconds(reset: number) {
  return Math.max(1, Math.ceil((reset - Date.now()) / 1000));
}
