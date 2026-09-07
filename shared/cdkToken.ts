export type PublicCdkStatus = {
  required: true;
  submitted: boolean;
  preview: string | null;
  upgrading: boolean;
  upgraded: boolean;
};

export function isCdkOrder(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return false;
  const row = details as Record<string, unknown>;
  if (row.kind !== "partner_service" && row.adminQueue !== "partner_service") return false;
  return row.partnerDeliveryType === "CDK";
}

export function validateCdkToken(raw: unknown) {
  if (typeof raw !== "string") throw new Error("សូម paste token។");
  const token = raw.replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if (token.length < 20) throw new Error("Token ខ្លីពេក។ សូម paste token ពេញ។");
  if (token.length > 8000) throw new Error("Token វែងពេក។");
  return token;
}

export function tokenPreview(token: string) {
  return `••••${token.slice(-4)}`;
}

export function publicCdkStatus(details: unknown, status: string): PublicCdkStatus | null {
  if (!isCdkOrder(details)) return null;
  const row = details as Record<string, unknown>;
  const submitted = row.cdkTokenSubmitted === true;
  return {
    required: true,
    submitted,
    preview: typeof row.cdkTokenPreview === "string" ? row.cdkTokenPreview : null,
    upgrading: submitted && status === "paid",
    upgraded: status === "delivered",
  };
}

export function readAdminCdkToken(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  const secret = (details as Record<string, unknown>).cdkTokenSecret;
  if (typeof secret === "string" && secret.trim()) return secret;
  if (!secret || typeof secret !== "object" || Array.isArray(secret)) return null;
  const row = secret as { v?: unknown };
  return typeof row.v === "string" && row.v.trim() ? row.v : null;
}

export function redactCdkSecret(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details)) return details;
  const next = { ...(details as Record<string, unknown>) };
  delete next.cdkTokenSecret;
  return next;
}
