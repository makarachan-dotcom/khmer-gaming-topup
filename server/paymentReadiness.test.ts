import { afterEach, describe, expect, it, vi } from "vitest";
import { resetBakongMerchantPreflightCache } from "./bakongKhqr";
import { getAutomaticPaymentReadiness, getPublicPaymentReadiness, requireAutomaticPaymentReady } from "./paymentReadiness";

const keys = ["BAKONG_API_TOKEN", "BAKONG_ACCOUNT_ID", "BAKONG_MERCHANT_NAME", "BAKONG_MERCHANT_CITY", "BAKONG_MERCHANT_PHONE", "BAKONG_STORE_LABEL", "KHQR_WORKER_URL", "KHQR_AUTOMATION_API_KEY", "KHQR_WORKER_CALLBACK_SECRET"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

function configureCompletePaymentEnvironment() {
  process.env.BAKONG_API_TOKEN = "token";
  process.env.BAKONG_ACCOUNT_ID = "merchant@bkrt";
  process.env.BAKONG_MERCHANT_NAME = "ZURS STORE";
  process.env.BAKONG_MERCHANT_CITY = "Phnom Penh";
  process.env.BAKONG_MERCHANT_PHONE = "099383360";
  process.env.BAKONG_STORE_LABEL = "ZURS";
  process.env.KHQR_WORKER_URL = "https://pay-worker.example.com";
  process.env.KHQR_AUTOMATION_API_KEY = "worker-test-api-key";
  process.env.KHQR_WORKER_CALLBACK_SECRET = "a-32-character-test-secret-for-worker";
}

afterEach(() => {
  keys.forEach((key) => { const value = original[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  resetBakongMerchantPreflightCache();
  vi.unstubAllGlobals();
});

describe("automatic payment readiness", () => {
  it("blocks all purchases until all payment credentials are configured", async () => {
    keys.forEach((key) => delete process.env[key]);
    await expect(getAutomaticPaymentReadiness()).resolves.toEqual({ ready: false, reason: "automatic_payment_pending" });
    await expect(requireAutomaticPaymentReady()).rejects.toThrow("Purchases are temporarily disabled");
  });

  it("reports ready only when merchant preflight and worker credentials both pass", async () => {
    configureCompletePaymentEnvironment();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ responseCode: 0 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(getAutomaticPaymentReadiness()).resolves.toEqual({ ready: true, reason: "ready" });
    await expect(getAutomaticPaymentReadiness()).resolves.toEqual({ ready: true, reason: "ready" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("blocks new public sessions when Bakong does not verify the merchant, even with the owner switch enabled", async () => {
    configureCompletePaymentEnvironment();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ responseCode: 1 }), { status: 200 })));
    await expect(getAutomaticPaymentReadiness()).resolves.toEqual({ ready: false, reason: "merchant_unverified" });
    await expect(getPublicPaymentReadiness(true)).resolves.toEqual({ ready: false, reason: "merchant_unverified" });
  });

  it("keeps public payment off until the owner master switch is enabled after merchant verification", async () => {
    configureCompletePaymentEnvironment();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ responseCode: 0 }), { status: 200 })));
    await expect(getPublicPaymentReadiness(false)).resolves.toEqual({ ready: false, reason: "payment_switch_off" });
    await expect(getPublicPaymentReadiness(true)).resolves.toEqual({ ready: true, reason: "ready" });
  });
});
