import { moneyEquals } from "./paymentSecurity";

export type KhqrStoredPayment = {
  provider: string;
  md5: string;
  orderId: string;
  amount: string | number;
  currency: "KHR" | "USD";
  paymentStatus: string;
  orderStatus: string;
};

export type KhqrWorkerCallbackIdentity = {
  md5: string;
  orderId: string;
  amount: string | number;
  currency: "KHR" | "USD";
};

export type KhqrStoredWalletTopup = {
  provider: string;
  md5: string;
  walletId: string;
  amount: string | number;
  status: string;
};

export function getKhqrReconciliationDisposition(
  stored: KhqrStoredPayment | undefined,
  callback: KhqrWorkerCallbackIdentity,
) {
  if (!stored) return "reject" as const;
  if (
    stored.provider !== "bakong_khqr"
    || stored.md5 !== callback.md5
    || stored.orderId !== callback.orderId
    || stored.currency !== callback.currency
    // Exact minor-unit comparison. `Number()` would let "2.00000001" and
    // scientific notation slip through an amount check.
    || !moneyEquals(stored.amount, callback.amount, stored.currency)
  ) return "reject" as const;
  if (stored.paymentStatus === "paid" && (stored.orderStatus === "paid" || stored.orderStatus === "delivered")) return "idempotent" as const;
  if (stored.paymentStatus !== "pending" || stored.orderStatus !== "awaiting_payment") return "reject" as const;
  return "reconcile" as const;
}

export function getKhqrWalletReconciliationDisposition(
  stored: KhqrStoredWalletTopup | undefined,
  callback: KhqrWorkerCallbackIdentity,
) {
  if (!stored) return "reject" as const;
  if (
    stored.provider !== "bakong_khqr"
    || stored.md5 !== callback.md5
    || callback.orderId !== `wallet:${stored.walletId}`
    || callback.currency !== "KHR"
    || !moneyEquals(stored.amount, callback.amount, "KHR")
  ) return "reject" as const;
  if (stored.status === "paid") return "idempotent" as const;
  if (stored.status !== "pending") return "reject" as const;
  return "reconcile" as const;
}
