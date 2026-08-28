import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("secure payment-link boundary", () => {
  const source = readFileSync(join(process.cwd(), "server/paymentLinkRoutes.ts"), "utf8");
  const db = readFileSync(join(process.cwd(), "server/db.ts"), "utf8");
  const schema = readFileSync(join(process.cwd(), "drizzle/schema.ts"), "utf8");
  const app = readFileSync(join(process.cwd(), "server/app.ts"), "utf8");
  const vercel = readFileSync(join(process.cwd(), "vercel.json"), "utf8");
  const robots = readFileSync(join(process.cwd(), "client/public/robots.txt"), "utf8");

  it("uses random URL-safe tokens and stores only a SHA-256 hash", () => {
    expect(db).toContain('randomBytes(24).toString("base64url")');
    expect(db).toContain('createHash("sha256").update(value).digest("hex")');
    expect(schema).toContain('tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique()');
    expect(schema).toContain('tokenPrefix: varchar("tokenPrefix", { length: 8 }).notNull()');
  });

  it("enforces owner, gate, binding, expiry, and terminal invalidation before QR issue", () => {
    expect(db).toContain('if (!order[0] || !["pending", "awaiting_payment"].includes(order[0].status))');
    expect(db).toContain('code: "PAYMENTS_CLOSED"');
    expect(db).toContain('link.boundSessionHash !== input.sessionHash || link.boundDeviceHash !== input.deviceHash');
    expect(db).toContain('securePaymentLinkTtlMs = 15 * 60 * 1000');
    expect(db).toContain('status: "cancelled", consumedAt: new Date()');
    expect(source).toContain('req.body?.method !== "khqr"');
  });

  it("applies private cache and crawler headers plus abuse limits to raw payment routes", () => {
    expect(source).toContain('Cache-Control", "no-store, private, max-age=0');
    expect(source).toContain('X-Robots-Tag", "noindex, nofollow, noarchive');
    expect(source).toContain('checkRateLimit(req, "payment-link-issue"');
    expect(source).toContain('checkRateLimit(req, "payment-link-invalid"');
    expect(source).toContain("rateLimitConstants.paymentLinkIssue.requests");
    expect(source).toContain("rateLimitConstants.paymentLinkInvalid.requests");
    expect(app).toContain('registerSecurePaymentLinkRoutes(app)');
    expect(vercel).toContain('"source": "/pay/:path*"');
    expect(vercel).toContain('"X-Robots-Tag", "value": "noindex, nofollow, noarchive"');
    expect(robots).toContain("Disallow: /pay/");
  });
});
