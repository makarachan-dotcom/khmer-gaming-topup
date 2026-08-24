import { afterEach, describe, expect, it } from "vitest";
import { getAutomaticPaymentReadiness, getPublicPaymentReadiness, requireAutomaticPaymentReady } from "./paymentReadiness";

const keys = ["BAKONG_API_TOKEN", "BAKONG_ACCOUNT_ID", "BAKONG_MERCHANT_NAME", "BAKONG_MERCHANT_CITY", "BAKONG_MERCHANT_PHONE", "BAKONG_STORE_LABEL"] as const;
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

  it("reports ready only when the complete Bakong merchant configuration exists", () => {
    process.env.BAKONG_API_TOKEN = "token";
    process.env.BAKONG_ACCOUNT_ID = "merchant@bkrt";
    process.env.BAKONG_MERCHANT_NAME = "ZURS STORE";
    process.env.BAKONG_MERCHANT_CITY = "Phnom Penh";
    process.env.BAKONG_MERCHANT_PHONE = "099383360";
    process.env.BAKONG_STORE_LABEL = "ZURS";
    expect(getAutomaticPaymentReadiness()).toEqual({ ready: true, reason: "ready" });
  });

  it("keeps public payment off until the owner master switch is enabled even when Bakong credentials are complete", () => {
    process.env.BAKONG_API_TOKEN = "token";
    process.env.BAKONG_ACCOUNT_ID = "merchant@bkrt";
    process.env.BAKONG_MERCHANT_NAME = "ZURS STORE";
    process.env.BAKONG_MERCHANT_CITY = "Phnom Penh";
    process.env.BAKONG_MERCHANT_PHONE = "099383360";
    process.env.BAKONG_STORE_LABEL = "ZURS";
    expect(getPublicPaymentReadiness(false)).toEqual({ ready: false, reason: "payment_switch_off" });
    expect(getPublicPaymentReadiness(true)).toEqual({ ready: true, reason: "ready" });
  });
});
