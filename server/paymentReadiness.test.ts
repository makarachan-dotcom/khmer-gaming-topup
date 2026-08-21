import { afterEach, describe, expect, it } from "vitest";
import { getAutomaticPaymentReadiness, requireAutomaticPaymentReady } from "./paymentReadiness";

const keys = ["TOANCHETPAY_MERCHANT_ID", "TOANCHETPAY_API_KEY", "TOANCHETPAY_API_URL", "TOANCHETPAY_WEBHOOK_SECRET"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  keys.forEach((key) => { const value = original[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; });
});

describe("automatic payment readiness", () => {
  it("blocks all purchases until all payment credentials are configured", () => {
    keys.forEach((key) => delete process.env[key]);
    expect(getAutomaticPaymentReadiness()).toEqual({ ready: false, reason: "automatic_payment_pending" });
    expect(() => requireAutomaticPaymentReady()).toThrow("Purchases are temporarily disabled");
  });

  it("reports ready only when the complete automatic-payment credential set exists", () => {
    process.env.TOANCHETPAY_MERCHANT_ID = "merchant";
    process.env.TOANCHETPAY_API_KEY = "key";
    process.env.TOANCHETPAY_API_URL = "https://payment.example.test";
    process.env.TOANCHETPAY_WEBHOOK_SECRET = "webhook";
    expect(getAutomaticPaymentReadiness()).toEqual({ ready: true, reason: "ready" });
  });
});
