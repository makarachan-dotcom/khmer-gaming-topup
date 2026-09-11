import { describe, expect, it } from "vitest";
import { getKhqrReconciliationDisposition, getKhqrWalletReconciliationDisposition } from "./khqrReconciliation";

const callback = { md5: "a".repeat(32), orderId: "order-verified-123", amount: "100", currency: "KHR" as const };
const pending = { provider: "bakong_khqr", ...callback, paymentStatus: "pending", orderStatus: "awaiting_payment" };

describe("KHQR reconciliation guard", () => {
  it("permits only the exact pending payment session", () => {
    expect(getKhqrReconciliationDisposition(pending, callback)).toBe("reconcile");
  });

  it("rejects a changed amount, currency, order, or provider reference", () => {
    expect(getKhqrReconciliationDisposition(pending, { ...callback, amount: "101" })).toBe("reject");
    expect(getKhqrReconciliationDisposition(pending, { ...callback, currency: "USD" })).toBe("reject");
    expect(getKhqrReconciliationDisposition(pending, { ...callback, orderId: "other-order" })).toBe("reject");
    expect(getKhqrReconciliationDisposition({ ...pending, provider: "other" }, callback)).toBe("reject");
  });

  it("handles already-paid matching sessions without a second payment transition", () => {
    expect(getKhqrReconciliationDisposition({ ...pending, paymentStatus: "paid", orderStatus: "paid" }, callback)).toBe("idempotent");
    expect(getKhqrReconciliationDisposition({ ...pending, paymentStatus: "paid", orderStatus: "delivered" }, callback)).toBe("idempotent");
  });

  it("permits only the exact pending wallet session and is idempotent after credit", () => {
    const wallet = { provider: "bakong_khqr", md5: callback.md5, walletId: "wallet-topup-123", amount: "100", status: "pending" };
    const walletCallback = { ...callback, orderId: "wallet:wallet-topup-123" };
    expect(getKhqrWalletReconciliationDisposition(wallet, walletCallback)).toBe("reconcile");
    expect(getKhqrWalletReconciliationDisposition(wallet, { ...walletCallback, amount: "101" })).toBe("reject");
    expect(getKhqrWalletReconciliationDisposition(wallet, { ...walletCallback, currency: "USD" })).toBe("reject");
    expect(getKhqrWalletReconciliationDisposition({ ...wallet, status: "paid" }, walletCallback)).toBe("idempotent");
  });
});
