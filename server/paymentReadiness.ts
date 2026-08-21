export type PaymentReadiness = { ready: boolean; reason: "automatic_payment_pending" | "ready" };

export function getAutomaticPaymentReadiness(): PaymentReadiness {
  const configured = Boolean(process.env.TOANCHETPAY_MERCHANT_ID && process.env.TOANCHETPAY_API_KEY && process.env.TOANCHETPAY_API_URL && process.env.TOANCHETPAY_WEBHOOK_SECRET);
  return configured ? { ready: true, reason: "ready" } : { ready: false, reason: "automatic_payment_pending" };
}

export function requireAutomaticPaymentReady() {
  const readiness = getAutomaticPaymentReadiness();
  if (!readiness.ready) throw new Error("Automatic Cambodian payment is not available yet. Purchases are temporarily disabled.");
  return readiness;
}
