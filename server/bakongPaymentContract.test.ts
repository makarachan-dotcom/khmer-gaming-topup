import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Bakong KHQR payment contract", () => {
  it("keeps Bakong credentials on the server and verifies exact payment evidence before marking an order paid", () => {
    const adapter = readFileSync(resolve(process.cwd(), "server/bakongKhqr.ts"), "utf8");
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    expect(adapter).toContain('import bakongKhqr from "bakong-khqr"');
    expect(adapter).not.toContain('createRequire(import.meta.url)');
    expect(adapter).toContain('process.env.BAKONG_API_TOKEN');
    expect(adapter).toContain('check_transaction_by_md5');
    expect(adapter).toContain('matchesAmount');
    expect(adapter).toContain('matchesCurrency');
    expect(adapter).toContain('matchesReceiver');
    expect(adapter).toContain('!returnedReceiver || returnedReceiver === config.accountId.toLowerCase()');
    expect(db).toContain('provider: "bakong_khqr"');
    expect(db).toContain('createBakongKhqrPayment');
    expect(db).toContain('checkBakongKhqrPayment');
    expect(db).toContain('updateOrderStatus({ orderId: input.orderId, status: "paid" })');
  });

  it("offers a generated QR and owner-scoped refresh action to checkout without client-provided payment claims", () => {
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const checkout = readFileSync(resolve(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    expect(router).toContain('refreshPayment: protectedProcedure');
    expect(checkout).toContain('qrImageDataUrl');
    expect(checkout).toContain('refresh.mutate({ orderId })');
    expect(checkout).toContain('setInterval');
    expect(checkout).toContain('OutlineLoader');
  });
});
