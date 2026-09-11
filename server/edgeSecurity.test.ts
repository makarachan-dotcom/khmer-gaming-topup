import { describe, expect, it } from "vitest";
import { applyBackendSecurity, isCloudflareIp, visitorIpFromRequest } from "./edgeSecurity";
import type { NextFunction, Request, Response } from "express";

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
      status(code: number) { headers.status = String(code); return res; },
      end() { return res; },
    } as unknown as Response;
    let nextCalled = false;
    const next = (() => { nextCalled = true; }) as NextFunction;
    applyBackendSecurity({ ...req({}), method: "TRACE" } as Request, res, next);
    expect(nextCalled).toBe(false);
    expect(headers.status).toBe("405");

    applyBackendSecurity(req({}), res, next);
    expect(nextCalled).toBe(true);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Cache-Control"]).toBe("no-store");
  });
});
