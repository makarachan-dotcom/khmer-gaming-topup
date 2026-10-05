/**
 * Pchum Ben 2026 festival discount: 10% off all packages (Oct 5-12),
 * with a guaranteed $0.09 profit floor per package.
 *
 * discounted = max(priceUsd * 0.9, basePriceUsd + 0.09)
 */

export const PCHUM_BEN_END_UTC = Date.parse("2026-10-12T17:00:00Z"); // Oct 13 00:00 +07
export const PCHUM_BEN_DISCOUNT_RATE = 0.10;
export const PCHUM_BEN_MIN_PROFIT_USD = 0.09;

export function isPchumBenActive(now: number = Date.now()): boolean {
  return now < PCHUM_BEN_END_UTC;
}

/**
 * Apply the Pchum Ben 10% discount with $0.09 profit floor.
 * Returns the final sale price (never below cost + $0.09).
 */
export function applyPchumBenDiscount(priceUsd: number, basePriceUsd: number | null): number {
  if (!isPchumBenActive()) return priceUsd;
  const discounted = priceUsd * (1 - PCHUM_BEN_DISCOUNT_RATE);
  const floor = (basePriceUsd ?? 0) + PCHUM_BEN_MIN_PROFIT_USD;
  const final = Math.max(discounted, floor);
  // Round to cents.
  return Math.round(final * 100) / 100;
}

/** Format a USD price label. */
export function usdLabel(value: number): string {
  return `$${value.toFixed(2)}`;
}
