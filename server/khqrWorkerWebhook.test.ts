import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseKhqrWorkerCallback, verifyKhqrWorkerSignature } from "./khqrWorkerWebhook";

describe("KHQR worker webhook", () => {
  const secret = "a-32-character-test-secret-for-webhook";
  const body = Buffer.from(JSON.stringify({ event: "payment.paid", md5: "a".repeat(32), orderId: "order-verified-123", amount: "100", currency: "KHR", timestamp: new Date().toISOString() }));
  it("accepts an exactly signed, current callback payload", () => {
    const signature = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyKhqrWorkerSignature(body, signature, secret)).toBe(true);
    expect(parseKhqrWorkerCallback(body)).toMatchObject({ currency: "KHR", amount: "100" });
  });
  it("accepts a current signed provider-limit status event without treating it as a payment", () => {
    const deferredBody = Buffer.from(JSON.stringify({ event: "payment.verification_deferred", reason: "bakong_daily_request_limit", md5: "b".repeat(32), orderId: "order-verified-456", amount: "100", currency: "KHR", timestamp: new Date().toISOString() }));
    const signature = crypto.createHmac("sha256", secret).update(deferredBody).digest("hex");
    expect(verifyKhqrWorkerSignature(deferredBody, signature, secret)).toBe(true);
    expect(parseKhqrWorkerCallback(deferredBody)).toMatchObject({ event: "payment.verification_deferred", reason: "bakong_daily_request_limit" });
  });
  it("accepts a current signed expiry status without treating it as payment confirmation", () => {
    const expiredBody = Buffer.from(JSON.stringify({ event: "payment.expired", md5: "c".repeat(32), orderId: "order-verified-789", amount: "100", currency: "KHR", timestamp: new Date().toISOString() }));
    const signature = crypto.createHmac("sha256", secret).update(expiredBody).digest("hex");
    expect(verifyKhqrWorkerSignature(expiredBody, signature, secret)).toBe(true);
    expect(parseKhqrWorkerCallback(expiredBody)).toMatchObject({ event: "payment.expired" });
  });
  it("registers the Bakong callback alias through the same signed worker handler", () => {
    const appSource = readFileSync(join(process.cwd(), "server/app.ts"), "utf8");
    expect(appSource).toContain('app.post("/api/webhooks/khqr-worker", khqrWorkerWebhookBody, khqrWorkerWebhookHandler)');
    expect(appSource).toContain('app.post("/api/webhooks/bakong", khqrWorkerWebhookBody, khqrWorkerWebhookHandler)');
    expect(appSource).toContain("recordKhqrWorkerPaymentExpired");
    expect(appSource).toContain('confirmedBy: "worker"');
    const signatureIndex = appSource.indexOf("verifyKhqrWorkerSignature");
    const volumeIndex = appSource.indexOf("rateLimitBuckets.khqrWebhook,");
    expect(signatureIndex).toBeGreaterThan(-1);
    expect(volumeIndex).toBeGreaterThan(signatureIndex);
  });
  it("rejects an invalid signature and a stale callback", () => {
    expect(verifyKhqrWorkerSignature(body, "0".repeat(64), secret)).toBe(false);
    const staleBody = Buffer.from(JSON.stringify({ event: "payment.paid", md5: "a".repeat(32), orderId: "order-verified-123", amount: "100", currency: "KHR", timestamp: "2020-01-01T00:00:00.000Z" }));
    expect(parseKhqrWorkerCallback(staleBody)).toBeNull();
  });
});
