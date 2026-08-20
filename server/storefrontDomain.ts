export const ADMIN_EMAIL = "chanmakara672@gmail.com";

export function isSingleAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}

export function buildOrderNumber(now = Date.now(), suffix = Math.random().toString(36).slice(2, 6)): string {
  return `TK-${now.toString().slice(-8)}-${suffix.toUpperCase()}`;
}

export function isTerminalOrderStatus(status: string): boolean {
  return ["delivered", "failed", "expired", "refunded"].includes(status);
}

export function buildZursMemberDisplayName(value?: string | null, random = Math.random): string {
  const suffix = "ZURS Member";
  const cleaned = value?.trim().replace(/\s+/g, " ") ?? "";
  if (!cleaned) return `${Math.floor(100_000_000 + random() * 900_000_000)} ${suffix}`;
  const base = cleaned.replace(/\s+zurs\s+member$/i, "").trim();
  return `${base || cleaned} ${suffix}`.slice(0, 140);
}
