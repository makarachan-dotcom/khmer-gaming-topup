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
    || Number(stored.amount) !== Number(callback.amount)
  ) return "reject" as const;
  if (stored.paymentStatus === "paid" && stored.orderStatus === "paid") return "idempotent" as const;
  if (stored.paymentStatus !== "pending" || stored.orderStatus !== "awaiting_payment") return "reject" as const;
  return "reconcile" as const;
}
