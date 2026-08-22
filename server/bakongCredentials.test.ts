import { describe, expect, it } from "vitest";
import { createBakongKhqrPayment } from "./bakongKhqr";

describe("Bakong KHQR credentials", () => {
  it("can validate the configured merchant account without exposing the developer token", async () => {
    const token = process.env.BAKONG_API_TOKEN;
    const accountId = process.env.BAKONG_ACCOUNT_ID;
    expect(token).toBeTruthy();
    expect(accountId).toMatch(/^[^\s@]+@[^\s@]+$/);

    const response = await fetch("https://api-bakong.nbc.gov.kh/v1/check_bakong_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    const payload = await response.json() as { responseCode?: number; errorCode?: number };
    expect(response.status).toBe(200);
    expect(payload.responseCode).toBe(0);
    expect(payload.errorCode ?? null).toBeNull();
  }, 20_000);

  it("creates a dynamic Bakong QR payload without initiating a charge", async () => {
    const session = await createBakongKhqrPayment({ trackingCode: "ZRS-VALIDATION-0001", amount: "1.00", currency: "USD" });
    expect(session.md5).toMatch(/^[a-f0-9]{32}$/i);
    expect(session.qrImageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  }, 20_000);
});
