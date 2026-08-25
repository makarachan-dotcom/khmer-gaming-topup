import { describe, expect, it } from "vitest";
import { getKhqrReconciliationDisposition } from "./khqrReconciliation";

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
  });
});
