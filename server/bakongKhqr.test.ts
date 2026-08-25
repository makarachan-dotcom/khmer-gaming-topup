import { afterEach, describe, expect, it, vi } from "vitest";
import { checkBakongKhqrPayment } from "./bakongKhqr";

const bakongEnv = {
  BAKONG_API_TOKEN: "test-token",
  BAKONG_ACCOUNT_ID: "merchant@bank",
  BAKONG_MERCHANT_NAME: "ZURS STORE",
  BAKONG_MERCHANT_CITY: "Phnom Penh",
  BAKONG_MERCHANT_PHONE: "099000000",
  BAKONG_STORE_LABEL: "ZURS",
};

describe("Bakong KHQR response handling", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(bakongEnv)) process.env[key] = value;
  });

  it("returns an unavailable status instead of throwing when an upstream check returns HTML", async () => {
    Object.assign(process.env, bakongEnv);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!DOCTYPE html><html><body>Temporary error</body></html>", { status: 502, headers: { "Content-Type": "text/html" } })));

    await expect(checkBakongKhqrPayment({ md5: "safe-md5", expectedAmount: "500", expectedCurrency: "KHR" })).resolves.toMatchObject({ status: "unavailable", reason: "empty_or_malformed_bakong_response" });
  });
});
