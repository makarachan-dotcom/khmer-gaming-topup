import type { NextFunction, Request, Response } from "express";

/**
 * Visitor IP and API hardening.
 *
 * Cloudflare is optional. Headers like `cf-connecting-ip` are only trusted when
 * the hop that reached us is a Cloudflare edge. Otherwise a client can spoof
 * those headers and rotate rate-limit identity. Without Cloudflare we use
 * Vercel's own forwarded address, which the platform sets and the client
 * cannot overwrite.
 */

const CLOUDFLARE_V4: Array<[number, number]> = [
  [ip4("173.245.48.0"), 20],
  [ip4("103.21.244.0"), 22],
  [ip4("103.22.200.0"), 22],
  [ip4("103.31.4.0"), 22],
  [ip4("141.101.64.0"), 18],
  [ip4("108.162.192.0"), 18],
  [ip4("190.93.240.0"), 20],
  [ip4("188.114.96.0"), 20],
  [ip4("197.234.240.0"), 22],
  [ip4("198.41.128.0"), 17],
  [ip4("162.158.0.0"), 15],
  [ip4("104.16.0.0"), 13],
  [ip4("104.24.0.0"), 14],
  [ip4("172.64.0.0"), 13],
  [ip4("131.0.72.0"), 22],
];

const CLOUDFLARE_V6_PREFIXES = [
  "2400:cb00:",
  "2606:4700:",
  "2803:f800:",
  "2405:b500:",
  "2405:8100:",
  "2a06:98c0:",
  "2c0f:f248:",
];

function ip4(value: string): number {
  const parts = value.split(".").map((part) => Number(part));
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function headerValue(headers: Request["headers"], name: string): string {
  const raw = headers[name];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function firstHop(value: string): string {
  return value.split(",")[0]!.trim();
}

export function normalizeIp(raw: string): string {
  const value = raw.trim().replace(/^\[|\]$/g, "").split("%")[0]!.trim();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(value);
  return mapped?.[1] ?? value;
}

export function isPlausibleIp(raw: string): boolean {
  const ip = normalizeIp(raw);
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    return ip.split(".").every((part) => {
      const n = Number(part);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }
  return /^[a-f0-9:]+$/i.test(ip) && ip.includes(":");
}

export function isCloudflareIp(raw: string): boolean {
  const ip = normalizeIp(raw);
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    const n = ip4(ip);
    return CLOUDFLARE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (base & mask);
    });
  }
  const lower = `${ip.toLowerCase()}:`;
  return CLOUDFLARE_V6_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function trustedConnectingIp(req: Pick<Request, "headers" | "socket">): string {
  const vercel = firstHop(headerValue(req.headers, "x-vercel-forwarded-for"));
  if (isPlausibleIp(vercel)) return normalizeIp(vercel);
  const socket = req.socket?.remoteAddress ?? "";
  if (isPlausibleIp(socket)) return normalizeIp(socket);
  return "";
}

/**
 * Real visitor address for bans and rate limits.
 * Cloudflare visitor IP is used only when the previous hop is a Cloudflare edge.
 */
export function visitorIpFromRequest(req: Pick<Request, "headers" | "socket">): string {
  const connecting = trustedConnectingIp(req);
  if (connecting && isCloudflareIp(connecting)) {
    const visitor = firstHop(headerValue(req.headers, "cf-connecting-ip") || headerValue(req.headers, "true-client-ip"));
    if (isPlausibleIp(visitor)) return normalizeIp(visitor);
  }
  if (connecting) return connecting;
  if (process.env.NODE_ENV !== "production") {
    const forwarded = firstHop(headerValue(req.headers, "x-forwarded-for"));
    if (isPlausibleIp(forwarded)) return normalizeIp(forwarded);
  }
  return "unknown";
}

/** Browser origins allowed to call the API with credentials. Never `*`. */
export const STORE_CORS_ORIGINS = ["https://www.zurs.me", "https://zurs.me"] as const;

/**
 * Page CSP. `script-src` includes `'unsafe-inline'` because `client/index.html`
 * ships JSON-LD blocks as inline scripts and Vercel static HTML has no nonce.
 * Fonts/OAuth/Lottie hosts below are the ones the storefront already loads.
 * `connect-src` includes `https://fonts.gstatic.com` so Noto Lottie emoji JSON
 * can load; `img-src` includes DO Spaces / Fazer Cards because catalog art is
 * served from those hosts today.
 */
export const HTML_CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://www.zurs.me https://files.manuscdn.com https://*.appwrite.io https://*.googleusercontent.com https://*.cdn.digitaloceanspaces.com https://reseller.fazercards.com",
  "connect-src 'self' https://www.zurs.me https://zurs.me https://*.appwrite.io https://accounts.google.com https://fonts.gstatic.com",
  "media-src 'self' blob:",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

export const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";

export const SECURITY_TXT = [
  "Contact: mailto:support@zurs.me",
  "Expires: 2027-09-12T00:00:00.000Z",
  "Preferred-Languages: km, en",
  "Canonical: https://www.zurs.me/.well-known/security.txt",
  "",
].join("\n");

export function applyStoreCors(req: Pick<Request, "headers" | "method">, res: Response) {
  const origin = headerValue(req.headers, "origin");
  if (origin && (STORE_CORS_ORIGINS as readonly string[]).includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Vary", "Origin");
  }
}

export function applyBackendSecurity(req: Request, res: Response, next: NextFunction) {
  if (req.method === "TRACE" || req.method === "TRACK") {
    res.setHeader("Allow", "GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS");
    return res.status(405).end();
  }
  if ((req.originalUrl || req.url || "").length > 8_192) return res.status(414).end();

  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader("Content-Security-Policy", API_CONTENT_SECURITY_POLICY);
  res.removeHeader("X-Powered-By");
  if (req.path.startsWith("/api") || (req.originalUrl || "").startsWith("/api")) res.setHeader("Cache-Control", "no-store");
  applyStoreCors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  return next();
}
