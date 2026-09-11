import { describe, expect, it } from "vitest";
import { applyBackendSecurity, HTML_CONTENT_SECURITY_POLICY, isCloudflareIp, SECURITY_TXT, visitorIpFromRequest } from "./edgeSecurity";
import type { NextFunction, Request, Response } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function req(headers: Record<string, string>, remoteAddress = "127.0.0.1") {
  return { headers, socket: { remoteAddress }, path: "/api/trpc", originalUrl: "/api/trpc", url: "/api/trpc", method: "POST" } as unknown as Request;
}

describe("cloudflare-aware visitor IP", () => {
  it("ignores spoofed Cloudflare visitor headers when the hop is not Cloudflare", () => {
    expect(visitorIpFromRequest(req({
      "cf-connecting-ip": "1.2.3.4",
      "cf-ray": "aaaaaaaaaaaaaaaa-SIN",
      "x-vercel-forwarded-for": "8.8.8.8",
    }))).toBe("8.8.8.8");
  });

  it("uses Cloudflare visitor IP only when Vercel received a Cloudflare edge", () => {
    expect(visitorIpFromRequest(req({
      "cf-connecting-ip": "1.2.3.4",
      "x-vercel-forwarded-for": "104.16.10.2",
    }))).toBe("1.2.3.4");
  });

  it("keeps Vercel identity without Cloudflare", () => {
    expect(visitorIpFromRequest(req({
      "x-vercel-forwarded-for": "203.80.12.9",
      "x-forwarded-for": "9.9.9.9",
    }))).toBe("203.80.12.9");
  });

  it("recognises published Cloudflare ranges", () => {
    expect(isCloudflareIp("104.16.1.1")).toBe(true);
    expect(isCloudflareIp("1.1.1.1")).toBe(false);
    expect(isCloudflareIp("2606:4700::1")).toBe(true);
  });
});

describe("backend API hardening", () => {
  it("rejects TRACE and sets security headers on API traffic", () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) { headers[name] = value; return res; },
      removeHeader(name: string) { delete headers[name]; return res; },
      status(code: number) { headers.status = String(code); return res; },
      end() { return res; },
    } as unknown as Response;
    let nextCalled = false;
    const next = (() => { nextCalled = true; }) as NextFunction;
    applyBackendSecurity({ ...req({}), method: "TRACE" } as Request, res, next);
    expect(nextCalled).toBe(false);
    expect(headers.status).toBe("405");

    headers["X-Powered-By"] = "Express";
    applyBackendSecurity(req({}), res, next);
    expect(nextCalled).toBe(true);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Cache-Control"]).toBe("no-store");
    expect(headers["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(headers["Permissions-Policy"]).toContain("payment=()");
    expect(headers["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
    expect(headers["X-Powered-By"]).toBeUndefined();
  });

  it("allows credentialed CORS only from the store origins and never uses *", () => {
    const headers: Record<string, string> = {};
    const res = {
      setHeader(name: string, value: string) { headers[name] = value; return res; },
      removeHeader(name: string) { delete headers[name]; return res; },
      status(code: number) { headers.status = String(code); return res; },
      end() { return res; },
    } as unknown as Response;
    const next = (() => undefined) as NextFunction;
    applyBackendSecurity(req({ origin: "https://evil.example" }), res, next);
    expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();

    applyBackendSecurity(req({ origin: "https://www.zurs.me" }), res, next);
    expect(headers["Access-Control-Allow-Origin"]).toBe("https://www.zurs.me");
    expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    expect(headers["Access-Control-Allow-Origin"]).not.toBe("*");
  });
});

describe("public security artifacts", () => {
  it("ships security.txt and a page CSP without wildcard CORS", () => {
    const published = readFileSync(resolve(process.cwd(), "client/public/.well-known/security.txt"), "utf8");
    expect(published).toContain("Contact: mailto:support@zurs.me");
    expect(published).toContain("Canonical: https://www.zurs.me/.well-known/security.txt");
    expect(SECURITY_TXT).toContain("support@zurs.me");
    expect(HTML_CONTENT_SECURITY_POLICY).toContain("default-src 'self'");
    expect(HTML_CONTENT_SECURITY_POLICY).toContain("https://fonts.googleapis.com");
    expect(HTML_CONTENT_SECURITY_POLICY).toContain("https://accounts.google.com");
    expect(HTML_CONTENT_SECURITY_POLICY).toContain("connect-src 'self' https://www.zurs.me https://zurs.me https://*.appwrite.io https://accounts.google.com https://fonts.gstatic.com");
    const vercel = readFileSync(resolve(process.cwd(), "vercel.json"), "utf8");
    expect(vercel).toContain(HTML_CONTENT_SECURITY_POLICY);
    expect(vercel).not.toMatch(/Access-Control-Allow-Origin["']?\s*[:=]\s*["']\*/);
    const vercelJson = JSON.parse(vercel) as { rewrites: Array<{ source: string; destination: string }>; headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
    const spa = vercelJson.rewrites.find((rule) => rule.destination === "/index.html" && rule.source.includes("path"));
    expect(spa?.source).toContain(".well-known");
    const staticCors = vercelJson.headers
      .filter((block) => block.source === "/((?!api/).*)")
      .flatMap((block) => block.headers)
      .filter((header) => header.key === "Access-Control-Allow-Origin");
    expect(staticCors.every((header) => header.value === "https://www.zurs.me")).toBe(true);
    expect(staticCors.length).toBeGreaterThan(0);
    const app = readFileSync(resolve(process.cwd(), "server/app.ts"), "utf8");
    expect(app).toContain('app.disable("x-powered-by")');
    expect(app).toContain("/.well-known/security.txt");
  });
});
