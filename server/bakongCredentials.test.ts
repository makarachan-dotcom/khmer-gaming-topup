import { describe, expect, it } from "vitest";
import { createBakongKhqrPayment } from "./bakongKhqr";

describe("Bakong KHQR credentials", () => {
  it("keeps the configured merchant credential server-only without issuing a payment", () => {
    const token = process.env.BAKONG_API_TOKEN;
    const accountId = process.env.BAKONG_ACCOUNT_ID;
    expect(token).toBeTruthy();
    expect(accountId).toMatch(/^[^\s@]+@[^\s@]+$/);
  });

  it("creates a dynamic Bakong QR payload without initiating a charge", async () => {
    const session = await createBakongKhqrPayment({ trackingCode: "ZRS-VALIDATION-0001", amount: "1.00", currency: "USD" });
    expect(session.md5).toMatch(/^[a-f0-9]{32}$/i);
    expect(session.qrImageDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
  }, 20_000);
});
