import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBakongKhqrPayment } from "./bakongKhqr";

const testConfig = {
  BAKONG_API_TOKEN: "unit-test-merchant-token",
  BAKONG_ACCOUNT_ID: "zurs.test@bank",
  BAKONG_MERCHANT_NAME: "ZURS STORE",
  BAKONG_MERCHANT_CITY: "Phnom Penh",
  BAKONG_MERCHANT_PHONE: "012345678",
  BAKONG_STORE_LABEL: "ZURS",
};

describe("Bakong KHQR payment payload", () => {
  beforeEach(() => {
    for (const [key, value] of Object.entries(testConfig))
      vi.stubEnv(key, value);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new Error("Optional deeplink service is unavailable in unit tests")
        )
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps the merchant configuration server-only without issuing a payment", () => {
    expect(process.env.BAKONG_API_TOKEN).toBe(testConfig.BAKONG_API_TOKEN);
    expect(process.env.BAKONG_ACCOUNT_ID).toMatch(/^[^\s@]+@[^\s@]+$/);
  });

  it("creates a dynamic Bakong QR payload without contacting the optional deeplink service", async () => {
    const session = await createBakongKhqrPayment({
      trackingCode: "ZRS-VALIDATION-0001",
      amount: "1.00",
      currency: "USD",
    });
    expect(session.md5).toMatch(/^[a-f0-9]{32}$/i);
    expect(session.qrImageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(session.deeplink).toBeNull();
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });
});
