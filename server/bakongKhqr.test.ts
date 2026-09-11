import { afterEach, describe, expect, it, vi } from "vitest";
import { checkBakongKhqrPayment, resetBakongMerchantPreflightCache, verifyBakongMerchantAccount } from "./bakongKhqr";

const bakongEnv = {
  BAKONG_API_TOKEN: "test-token",
  BAKONG_ACCOUNT_ID: "merchant@bank",
  BAKONG_MERCHANT_NAME: "ZURS STORE",
  BAKONG_MERCHANT_CITY: "Phnom Penh",
  BAKONG_MERCHANT_PHONE: "099000000",
  BAKONG_STORE_LABEL: "ZURS",
};
const paymentInput = { md5: "safe-md5", expectedAmount: "500", expectedCurrency: "KHR" as const };

describe("Bakong KHQR response handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetBakongMerchantPreflightCache();
    for (const [key, value] of Object.entries(bakongEnv)) process.env[key] = value;
  });

  it("returns an unavailable status instead of throwing when an upstream check returns HTML", async () => {
    Object.assign(process.env, bakongEnv);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!DOCTYPE html><html><body>Temporary error</body></html>", { status: 502, headers: { "Content-Type": "text/html" } })));

    await expect(checkBakongKhqrPayment(paymentInput)).resolves.toMatchObject({ status: "unavailable", reason: "empty_or_malformed_bakong_response" });
  });

  it("accepts a USD QR that Bakong reports as the bank's riel settlement", async () => {
    Object.assign(process.env, bakongEnv);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      responseCode: 0,
      data: { hash: "fc98028c", amount: 81, currency: "KHR" },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(checkBakongKhqrPayment({ md5: "safe-md5", expectedAmount: "0.02", expectedCurrency: "USD" })).resolves.toMatchObject({ status: "paid", transactionHash: "fc98028c" });
  });

  it("accepts ISO numeric currency codes and an alternate hash field", async () => {
    Object.assign(process.env, bakongEnv);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      responseCode: 0,
      data: { transactionHash: "h".repeat(64), amount: 0.02, currency: 840 },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(checkBakongKhqrPayment({ md5: "safe-md5", expectedAmount: "0.02", expectedCurrency: "USD" })).resolves.toMatchObject({ status: "paid" });
  });

  it("rejects a successful response whose supplied recipient does not match the stored merchant account", async () => {
    Object.assign(process.env, bakongEnv);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      responseCode: 0,
      data: { hash: "h".repeat(64), amount: 500, currency: "KHR", toAccountId: "other@bank" },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));

    await expect(checkBakongKhqrPayment(paymentInput)).resolves.toMatchObject({ status: "unavailable", reason: "bakong_transaction_did_not_match_stored_session" });
  });

  it("distinguishes documented missing-account from undocumented rejected preflight", async () => {
    Object.assign(process.env, bakongEnv);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ responseCode: 1, errorCode: 11 }), { status: 200 })));
    await expect(verifyBakongMerchantAccount()).resolves.toBe("account_not_found");

    resetBakongMerchantPreflightCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ responseCode: 1, errorCode: 17 }), { status: 200 })));
    await expect(verifyBakongMerchantAccount()).resolves.toBe("rejected");
  });
});
