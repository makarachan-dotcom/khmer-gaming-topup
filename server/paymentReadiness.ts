import { getBakongPaymentReadiness } from "./bakongKhqr";
import { getKhqrWorkerCredentials } from "./khqrWorkerSecrets";

export type PaymentReadiness = { ready: boolean; reason: "automatic_payment_pending" | "merchant_unverified" | "ready" };
export type ProductPurchaseReadiness = { ready: false; reason: "security_review" };

export async function getAutomaticPaymentReadiness(): Promise<PaymentReadiness> {
  const bakong = await getBakongPaymentReadiness();
  const credentials = getKhqrWorkerCredentials();
  const workerReady = Boolean(process.env.KHQR_WORKER_URL?.startsWith("https://") && credentials.apiKey && credentials.callbackSecret && credentials.callbackSecret.length >= 32);
  if (!bakong.ready) return bakong;
  return workerReady ? { ready: true, reason: "ready" } : { ready: false, reason: "automatic_payment_pending" };
}

export async function requireAutomaticPaymentReady() {
  const readiness = await getAutomaticPaymentReadiness();
  if (!readiness.ready) throw new Error("Automatic Cambodian payment is not available yet. Purchases are temporarily disabled.");
  return readiness;
}

export type PublicPaymentReadiness = { ready: boolean; reason: "automatic_payment_pending" | "merchant_unverified" | "payment_switch_off" | "ready" };

export async function getPublicPaymentReadiness(paymentSwitchEnabled: boolean): Promise<PublicPaymentReadiness> {
  const automatic = await getAutomaticPaymentReadiness();
  if (!automatic.ready) return automatic;
  return paymentSwitchEnabled ? { ready: true, reason: "ready" } : { ready: false, reason: "payment_switch_off" };
}

export function getProductPurchaseReadiness(): ProductPurchaseReadiness {
  return { ready: false, reason: "security_review" };
}

export function requireProductPurchaseEnabled() {
  throw new Error("Product purchase is temporarily disabled while ZURS STORE completes its payment-security review.");
}
