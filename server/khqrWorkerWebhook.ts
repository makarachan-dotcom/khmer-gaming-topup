import crypto from "node:crypto";

type KhqrWorkerCallbackBase = { md5: string; orderId: string; amount: string | number; currency: "KHR" | "USD"; timestamp: string };
export type KhqrWorkerCallback =
  | (KhqrWorkerCallbackBase & { event: "payment.paid" })
  | (KhqrWorkerCallbackBase & { event: "payment.expired" })
  | (KhqrWorkerCallbackBase & { event: "payment.verification_deferred"; reason: "bakong_daily_request_limit" });

export function verifyKhqrWorkerSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined) {
  if (!secret || secret.length < 32 || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function parseKhqrWorkerCallback(rawBody: Buffer): KhqrWorkerCallback | null {
  try {
    const input = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    const timestamp = typeof input.timestamp === "string" ? Date.parse(input.timestamp) : Number.NaN;
    const hasValidBase = typeof input.md5 === "string" && /^[a-f0-9]{16,128}$/i.test(input.md5) && typeof input.orderId === "string" && input.orderId.length >= 4 && ["KHR", "USD"].includes(String(input.currency)) && (typeof input.amount === "number" || typeof input.amount === "string") && Number.isFinite(Number(input.amount)) && Number.isFinite(timestamp) && Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000;
    if (!hasValidBase) return null;
    const base: KhqrWorkerCallbackBase = { md5: input.md5 as string, orderId: input.orderId as string, amount: input.amount as string | number, currency: input.currency as "KHR" | "USD", timestamp: input.timestamp as string };
    if (input.event === "payment.paid") return { event: "payment.paid", ...base };
    if (input.event === "payment.expired") return { event: "payment.expired", ...base };
    if (input.event === "payment.verification_deferred" && input.reason === "bakong_daily_request_limit") return { event: "payment.verification_deferred", reason: "bakong_daily_request_limit", ...base };
    return null;
  } catch { return null; }
}
