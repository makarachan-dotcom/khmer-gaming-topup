import crypto from "node:crypto";

export type KhqrWorkerCallback = { event: "payment.paid"; md5: string; orderId: string; amount: string | number; currency: "KHR" | "USD"; timestamp: string };

export function verifyKhqrWorkerSignature(rawBody: Buffer, signature: string | undefined, secret: string | undefined) {
  if (!secret || secret.length < 32 || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function parseKhqrWorkerCallback(rawBody: Buffer): KhqrWorkerCallback | null {
  try {
    const input = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    const timestamp = typeof input.timestamp === "string" ? Date.parse(input.timestamp) : Number.NaN;
    if (input.event !== "payment.paid" || typeof input.md5 !== "string" || !/^[a-f0-9]{16,128}$/i.test(input.md5) || typeof input.orderId !== "string" || input.orderId.length < 4 || !["KHR", "USD"].includes(String(input.currency)) || (typeof input.amount !== "number" && typeof input.amount !== "string") || !Number.isFinite(Number(input.amount)) || !Number.isFinite(timestamp) || Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) return null;
    return { event: "payment.paid", md5: input.md5, orderId: input.orderId, amount: input.amount as string | number, currency: input.currency as "KHR" | "USD", timestamp: input.timestamp as string };
  } catch { return null; }
}
