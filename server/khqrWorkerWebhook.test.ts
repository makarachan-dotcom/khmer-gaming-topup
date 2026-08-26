import crypto from "node:crypto";
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
  it("rejects an invalid signature and a stale callback", () => {
    expect(verifyKhqrWorkerSignature(body, "0".repeat(64), secret)).toBe(false);
    const staleBody = Buffer.from(JSON.stringify({ event: "payment.paid", md5: "a".repeat(32), orderId: "order-verified-123", amount: "100", currency: "KHR", timestamp: "2020-01-01T00:00:00.000Z" }));
    expect(parseKhqrWorkerCallback(staleBody)).toBeNull();
  });
});
