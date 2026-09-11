export const MOBILE_TAB_HREFS = ["/", "/topup", "/account"] as const;
export type MobileTabHref = (typeof MOBILE_TAB_HREFS)[number];
export const TAB_ORDER_STORAGE_KEY = "zurs:mobile-tab-order";
export const TAB_LONG_PRESS_MS = 420;

export function parseMobileTabOrder(raw: string | null | undefined): MobileTabHref[] {
  const allowed = new Set<string>(MOBILE_TAB_HREFS);
  const fallback = [...MOBILE_TAB_HREFS];
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return fallback;
    const next: MobileTabHref[] = [];
    for (const value of parsed) {
      if (typeof value === "string" && allowed.has(value) && !next.includes(value as MobileTabHref)) {
        next.push(value as MobileTabHref);
      }
    }
    for (const href of MOBILE_TAB_HREFS) {
      if (!next.includes(href)) next.push(href);
    }
    return next;
  } catch {
    return fallback;
  }
}

export function moveTab<T>(order: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = order.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function tabIndexFromClientX(clientX: number, rect: { left: number; width: number }, count: number): number {
  if (count <= 0 || rect.width <= 0) return 0;
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width - 0.01);
  return Math.min(count - 1, Math.floor((x / rect.width) * count));
}

/** How far a resting tab should slide while another is being dragged across it. */
export function tabShiftX(index: number, origin: number, hover: number, slotWidth: number): number {
  if (origin === hover || slotWidth === 0) return 0;
  if (origin < hover && index > origin && index <= hover) return -slotWidth;
  if (origin > hover && index >= hover && index < origin) return slotWidth;
  return 0;
}
