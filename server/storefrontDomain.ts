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
