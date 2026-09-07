export const DELIVERY_METHODS = ["CDK", "COUPON", "LINK", "READY_ACCOUNT", "NOTE"] as const;
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number];

export type PartnerDelivery = {
  method: DeliveryMethod;
  coupon?: string;
  link?: string;
  accountEmail?: string;
  accountPassword?: string;
  note?: string;
  instructions?: string;
  deliveredAt: string;
  deliveredByUserId: number;
};

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parsePartnerDelivery(raw: unknown): PartnerDelivery | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const method = row.method;
  if (method !== "CDK" && method !== "COUPON" && method !== "LINK" && method !== "READY_ACCOUNT" && method !== "NOTE") return null;
  const deliveredAt = typeof row.deliveredAt === "string" ? row.deliveredAt : "";
  const deliveredByUserId = typeof row.deliveredByUserId === "number" ? row.deliveredByUserId : 0;
  return {
    method,
    coupon: clip(row.coupon, 400) || undefined,
    link: clip(row.link, 2000) || undefined,
    accountEmail: clip(row.accountEmail, 320) || undefined,
    accountPassword: clip(row.accountPassword, 400) || undefined,
    note: clip(row.note, 2000) || undefined,
    instructions: clip(row.instructions, 4000) || undefined,
    deliveredAt,
    deliveredByUserId,
  };
}

export function publicPartnerDelivery(details: unknown, status: string): PartnerDelivery | null {
  if (status !== "delivered") return null;
  if (!details || typeof details !== "object" || Array.isArray(details)) return null;
  return parsePartnerDelivery((details as Record<string, unknown>).delivery);
}

export function buildPartnerDelivery(input: {
  method: DeliveryMethod;
  coupon?: string;
  link?: string;
  accountEmail?: string;
  accountPassword?: string;
  note?: string;
  instructions?: string;
  deliveredByUserId: number;
}): PartnerDelivery {
  const method = input.method;
  const coupon = clip(input.coupon, 400);
  const link = clip(input.link, 2000);
  const accountEmail = clip(input.accountEmail, 320);
  const accountPassword = clip(input.accountPassword, 400);
  const note = clip(input.note, 2000);
  const instructions = clip(input.instructions, 4000);
  if ((method === "CDK" || method === "COUPON") && coupon.length < 2) throw new Error(method === "CDK" ? "សូមបញ្ចូលលេខកូដ CDK។" : "សូមបញ្ចូលលេខកូដ Coupon។");
  if (method === "LINK") {
    let parsed: URL;
    try { parsed = new URL(link); } catch { throw new Error("សូមបញ្ចូលតំណ HTTPS។"); }
    if (parsed.protocol !== "https:") throw new Error("តំណត្រូវប្រើ HTTPS។");
  }
  if (method === "READY_ACCOUNT") {
    if (!/^\S+@\S+\.\S+$/.test(accountEmail)) throw new Error("សូមបញ្ចូល email គណនី។");
    if (accountPassword.length < 2) throw new Error("សូមបញ្ចូលពាក្យសម្ងាត់។");
  }
  if (method === "NOTE" && note.length < 2) throw new Error("សូមសរសេរព័ត៌មានសេវា។");
  return {
    method,
    coupon: coupon || undefined,
    link: link || undefined,
    accountEmail: accountEmail || undefined,
    accountPassword: accountPassword || undefined,
    note: note || undefined,
    instructions: instructions || undefined,
    deliveredAt: new Date().toISOString(),
    deliveredByUserId: input.deliveredByUserId,
  };
}
