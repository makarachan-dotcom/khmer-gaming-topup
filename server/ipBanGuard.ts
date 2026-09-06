import type { NextFunction, Request, Response } from "express";
import { describeRequestDevice } from "./deviceInsight";
import {
  formatRetryAfterKh,
  hasAccessReprieve,
  inspectActorBlock,
  normalizeDeviceId,
} from "./loginAbuseGuard";
import { clientIpFromRequest } from "./rateLimit";

/**
 * Site-wide enforcement of a 24-hour block.
 *
 * A blocked address is refused everywhere, not just at /login, because a block
 * that only covered the login page would be trivially sidestepped by using the
 * storefront while signed in.
 *
 * Four categories of path are exempt, each for a concrete reason.
 *
 * `/api/auth/login/guard`  the endpoint that TELLS the browser it is blocked.
 *                          Refusing it would leave the lock screen unable to
 *                          render its own countdown.
 *
 * `/api/auth/google`       the storefront's chosen escape hatch. Completing a
 *                          real Google sign-in proves a human, so it stays
 *                          reachable while blocked and grants a reprieve on
 *                          success. Email one-time-code sign-in is NOT exempt.
 *
 * `/api/support/`          the live chat on the lock screen. Someone wrongly
 *                          caught by a shared carrier address has to be able to
 *                          reach a person; the per-customer daily quota is what
 *                          keeps this from becoming a spam channel.
 *
 * `/chat`                  round 6 moved that chat out of an overlay and onto
 *                          its own page. The API was already exempt, but the
 *                          page that runs it was not, which would have walled
 *                          off the escape hatch entirely. This serves static
 *                          markup only; every action behind it still goes
 *                          through /api/support/ and its daily quota.
 *
 * `/api/admin/`, webhooks, cron, health
 *                          operating the site must not depend on the operator's
 *                          own address being clean, and a payment webhook is not
 *                          a browser.
 */

const exemptPrefixes = [
  "/api/auth/login/guard",
  "/api/auth/google",
  "/api/support/",
  "/chat",
  "/api/admin/",
  "/api/webhooks/",
  "/api/scheduled/",
  "/api/health",
];

let cachedAllowlist: { raw: string; values: Set<string> } | null = null;

function allowlist(): Set<string> {
  const raw = process.env.LOGIN_BAN_IP_ALLOWLIST ?? "";
  if (cachedAllowlist?.raw === raw) return cachedAllowlist.values;
  const values = new Set(
    raw
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  );
  cachedAllowlist = { raw, values };
  return values;
}

function isAllowlisted(ip: string): boolean {
  return allowlist().has(ip);
}

function isExempt(path: string): boolean {
  return exemptPrefixes.some((prefix) => path.startsWith(prefix));
}

export type IpBanRefusal = {
  code: "LOGIN_BLOCKED";
  blocked: true;
  scope: "ip" | "device" | "identity" | null;
  retryAfter: number;
  expiresAt: string | null;
  durable: boolean;
  message: string;
};

export function banMessageKh(retryAfterSeconds: number): string {
  return `គណនីរបស់អ្នកត្រូវបានទប់ស្កាត់។ សូមរង់ចាំ ${formatRetryAfterKh(retryAfterSeconds)} ទើបអាចបន្តបាន។ អ្នកអាចចូលដោយ Google ឬជែកជាមួយជំនួយបាន។`;
}

export async function enforceIpBan(req: Request, res: Response, next: NextFunction) {
  try {
    if (isExempt(req.path)) return next();

    const ip = clientIpFromRequest(req);
    if (!ip || isAllowlisted(ip)) return next();

    const deviceId = normalizeDeviceId({
      deviceId: req.headers["x-zurs-device"] as string | undefined,
      userAgent: req.header("user-agent") ?? null,
      acceptLanguage: req.header("accept-language") ?? null,
      ip,
    });

    const verdict = await inspectActorBlock({ ip, deviceId });
    if (!verdict.blocked) return next();

    // Blocked — unless this address+device already proved itself through Google.
    if (await hasAccessReprieve({ ip, deviceId })) return next();

    const device = describeRequestDevice(req);
    console.warn("[ipBan] refused", {
      path: req.path,
      scope: verdict.scope,
      retryAfter: verdict.retryAfterSeconds,
      device: device.label,
    });

    res.setHeader("Retry-After", String(verdict.retryAfterSeconds));
    res.setHeader("Cache-Control", "no-store");

    const payload: IpBanRefusal = {
      code: "LOGIN_BLOCKED",
      blocked: true,
      scope: verdict.scope,
      retryAfter: verdict.retryAfterSeconds,
      expiresAt: verdict.expiresAt,
      durable: !verdict.degraded,
      message: banMessageKh(verdict.retryAfterSeconds),
    };
    return res.status(423).json(payload);
  } catch (error) {
    // Fail OPEN. An outage in the ban store must never take the storefront
    // offline. The cost is that an outage is also a window where blocks are
    // not enforced, which is the cheaper of the two failures.
    console.error("[ipBan] check failed, allowing request", error);
    return next();
  }
}

export function resetIpBanAllowlistForTests() {
  cachedAllowlist = null;
}
