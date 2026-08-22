import { getBakongPaymentReadiness } from "./bakongKhqr";

export type PaymentReadiness = { ready: boolean; reason: "automatic_payment_pending" | "ready" };

export function getAutomaticPaymentReadiness(): PaymentReadiness {
  return getBakongPaymentReadiness();
}

export function requireAutomaticPaymentReady() {
  const readiness = getAutomaticPaymentReadiness();
  if (!readiness.ready) throw new Error("Automatic Cambodian payment is not available yet. Purchases are temporarily disabled.");
  return readiness;
}
