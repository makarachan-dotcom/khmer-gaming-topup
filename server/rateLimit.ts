import { TRPCError } from "@trpc/server";
import type { NextFunction, Request, Response } from "express";

/**
 * Durable rate limiting for Vercel serverless.
 *
 * Serverless functions are recycled constantly, so a `Map` living inside one
 * lambda cannot stop a brute-force run that is spread across instances. This
 * module keeps counters in Upstash Redis over its REST API, which needs no
 * persistent socket and therefore works inside a Vercel function.
 *
 * The implementation deliberately uses `fetch` instead of the `@upstash/*`
 * SDKs so no new dependency (and no lockfile churn) is required.
 *
 * Failure policy
 * - `mode: "strict"`  (payment key, auth): if Redis is configured but broken we
 *   reject the request. Allowing unlimited attempts is worse than a short
 *   outage for credential-adjacent endpoints.
 * - `mode: "lenient"` (public tRPC): failures never take the storefront down;
 *   we fall back to the per-instance counter and let the request through.
 *
 * When Upstash is not configured at all (no env vars yet) both modes fall back
 * to the in-memory counter so the app keeps working during rollout.
 */

const REST_URL = (process.env.UPSTASH_REDIS_REST_URL ?? "").replace(/\/+$/, "");
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const REQUEST_TIMEOUT_MS = 1_200;

export const rateLimitBackendConfigured = Boolean(REST_URL && REST_TOKEN);

export type RateLimitBucket = {
  /** Stable prefix so different endpoints never share a counter. */
  name: string;
  /** Maximum number of requests allowed inside the window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
};

export type RateLimitMode = "strict" | "lenient";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  /** True when the decision came from the in-memory fallback, not Redis. */
  degraded: boolean;
};

/** Buckets required by the security review. Keep them in one place. */
export const rateLimitBuckets = {
  payKeyIssue: { name: "paykey", limit: 5, windowSeconds: 300 },
  payLinkInvalid: { name: "paylink", limit: 10, windowSeconds: 3600 },
  auth: { name: "auth", limit: 10, windowSeconds: 60 },
  trpcPublic: { name: "trpc", limit: 60, windowSeconds: 60 },
  createTopup: { name: "topup", limit: 10, windowSeconds: 3600 },
} as const satisfies Record<string, RateLimitBucket>;

const memoryHits = new Map<string, number[]>();

function memoryConsume(key: string, bucket: RateLimitBucket): RateLimitDecision {
  const windowMs = bucket.windowSeconds * 1_000;
  const now = Date.now();
  const hits = (memoryHits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  hits.push(now);
  memoryHits.set(key, hits);
  if (memoryHits.size > 5_000) memoryHits.clear();
  const allowed = hits.length <= bucket.limit;
  const oldest = hits[0] ?? now;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((oldest + windowMs - now) / 1_000)),
    degraded: true,
  };
}

async function upstashPipeline(commands: (string | number)[][]): Promise<unknown[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${REST_URL}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${REST_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`upstash responded ${response.status}`);
    const payload = (await response.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(payload)) throw new Error("upstash returned an unexpected payload");
    const failure = payload.find((entry) => entry && typeof entry === "object" && "error" in entry && entry.error);
    if (failure) throw new Error(String(failure.error));
    return payload.map((entry) => entry?.result);
  } finally {
    clearTimeout(timer);
  }
}

async function redisConsume(key: string, bucket: RateLimitBucket): Promise<RateLimitDecision> {
  const windowMs = bucket.windowSeconds * 1_000;
  const [countRaw, pttlRaw] = await upstashPipeline([
    ["INCR", key],
    ["PTTL", key],
  ]);
  const count = Number(countRaw ?? 0);
  let pttl = Number(pttlRaw ?? -1);
  // A fresh counter has no expiry yet. PEXPIRE is version-safe everywhere.
  if (!Number.isFinite(pttl) || pttl < 0) {
    await upstashPipeline([["PEXPIRE", key, windowMs]]);
    pttl = windowMs;
  }
  const allowed = count <= bucket.limit;
  return {
    allowed,
    retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil(pttl / 1_000)),
    degraded: false,
  };
}

/**
 * Consumes one token for `identifier` inside `bucket`.
 * Never throws: callers always receive a decision they can act on.
 */
export async function consumeRateLimit(options: {
  bucket: RateLimitBucket;
  identifier: string;
  mode: RateLimitMode;
}): Promise<RateLimitDecision> {
  const { bucket, identifier, mode } = options;
  const key = `rl:${bucket.name}:${identifier}`;
  if (!rateLimitBackendConfigured) {
    if (mode === "strict") {
      console.warn(`[rateLimit] ${bucket.name}: UPSTASH_REDIS_REST_* missing, using per-instance fallback`);
    }
    return memoryConsume(key, bucket);
  }
  try {
    return await redisConsume(key, bucket);
  } catch (error) {
    console.error(`[rateLimit] ${bucket.name} backend error`, error);
    if (mode === "strict") {
      // Fail closed: a configured-but-unreachable backend is exactly the window
      // an attacker needs, so the request is rejected instead of waved through.
      return { allowed: false, retryAfterSeconds: 30, degraded: true };
    }
    return memoryConsume(key, bucket);
  }
}

/**
 * Vercel sets `x-vercel-forwarded-for` itself, so it cannot be spoofed by the
 * client. `x-forwarded-for` is only used as a local/dev fallback.
 */
export function clientIpFromRequest(req: Request): string {
  const vercel = req.headers["x-vercel-forwarded-for"];
  if (typeof vercel === "string" && vercel.trim()) return vercel.split(",")[0]!.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0]!.trim();
  return req.socket?.remoteAddress ?? "unknown";
}

/**
 * tRPC flavour of the same check. Throws `TOO_MANY_REQUESTS` so procedures can
 * enforce per-user quotas without duplicating the backend logic.
 */
export async function enforceRateLimitOrThrow(options: {
  bucket: RateLimitBucket;
  identifier: string;
  mode: RateLimitMode;
}): Promise<void> {
  const decision = await consumeRateLimit(options);
  if (decision.allowed) return;
  throw new TRPCError({
    code: "TOO_MANY_REQUESTS",
    message: JSON.stringify({ code: "RATE_LIMITED", retryAfter: decision.retryAfterSeconds }),
  });
}

/** 429 body shape shared by every endpoint. Never leaks limiter internals. */
export function sendRateLimited(res: Response, retryAfterSeconds: number) {
  res.setHeader("Retry-After", String(retryAfterSeconds));
  res.setHeader("Cache-Control", "no-store");
  return res.status(429).json({ code: "RATE_LIMITED", retryAfter: retryAfterSeconds });
}

/**
 * Express middleware. Mount it *before* the business logic of a route so a
 * rejected caller never reaches authentication, database or provider work.
 */
export function rateLimitMiddleware(options: {
  bucket: RateLimitBucket;
  mode: RateLimitMode;
  identify?: (req: Request) => string;
}) {
  const { bucket, mode, identify } = options;
  return async function rateLimitHandler(req: Request, res: Response, next: NextFunction) {
    try {
      const identifier = identify ? identify(req) : clientIpFromRequest(req);
      const decision = await consumeRateLimit({ bucket, identifier, mode });
      if (!decision.allowed) return sendRateLimited(res, decision.retryAfterSeconds);
      return next();
    } catch (error) {
      console.error(`[rateLimit] ${bucket.name} middleware error`, error);
      if (mode === "strict") return sendRateLimited(res, 30);
      return next();
    }
  };
}
