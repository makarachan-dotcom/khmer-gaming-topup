/** Minimum extra USD when a bigger pack is cheaper than a smaller one. */
export const shopLadderMinStepUsd = 0.3;
/** Maximum extra USD added on one inverted step, so the ladder stays believable. */
export const shopLadderMaxStepUsd = 2;

export type LadderPackage = {
  id: string;
  label: string;
  amountLabel: string;
  priceLabel?: string;
  priceUsd?: string;
};

export function packageAmountAndUnit(label: string, amountLabel: string) {
  const text = `${amountLabel} ${label}`.toLowerCase().replace(/,/g, "");
  if (/\b(?:weekly|daily|monthly|membership|subscription|pass|promo|special|event|crate)\b/.test(text)) return null;
  const match = text.match(/(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = (match[2] ?? "").replace(/s$/, "");
  if (!Number.isFinite(amount) || amount <= 0 || !unit) return null;
  return { amount, unit };
}

function readPackagePrice(item: LadderPackage) {
  if (item.priceUsd != null && item.priceUsd !== "") {
    const parsed = Number(item.priceUsd);
    if (Number.isFinite(parsed)) return parsed;
  }
  const value = String(item.priceLabel ?? "").match(/\d[\d,]*(?:\.\d+)?/)?.[0];
  const parsed = value ? Number(value.replace(/,/g, "")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/** Round up to a shop-looking .x9 so the bump does not look like cost + margin. */
export function shopPriceFromUsd(value: number) {
  const cents = Math.max(1, Math.ceil(value * 100 - 1e-9));
  const ones = cents % 10;
  const bumped = ones === 9 ? cents : cents + (9 - ones);
  return Number((bumped / 100).toFixed(2));
}

function writePackagePrice<T extends LadderPackage>(item: T, price: number): T {
  const priceUsd = price.toFixed(2);
  return { ...item, priceUsd, priceLabel: `$${priceUsd}` };
}

/**
 * If 110 diamonds is cheaper than 100 diamonds, lift the bigger pack by $0.30–$2.00
 * and round to a clean shop price. Never lowers a pack.
 */
export function applyShopPriceLadder<T extends LadderPackage>(items: T[]): T[] {
  const indexed = items.map((item, index) => ({ item, index, price: readPackagePrice(item), measure: packageAmountAndUnit(item.label, item.amountLabel) }));
  const groups = new Map<string, typeof indexed>();
  for (const entry of indexed) {
    if (!entry.measure || !Number.isFinite(entry.price)) continue;
    const list = groups.get(entry.measure.unit) ?? [];
    list.push(entry);
    groups.set(entry.measure.unit, list);
  }
  const next = items.slice();
  for (const group of groups.values()) {
    group.sort((left, right) => left.measure!.amount - right.measure!.amount || left.price - right.price);
    for (let i = 1; i < group.length; i += 1) {
      const previous = group[i - 1]!;
      const current = group[i]!;
      if (current.measure!.amount <= previous.measure!.amount) continue;
      if (current.price > previous.price) continue;
      const ratio = current.measure!.amount / previous.measure!.amount;
      const extra = Math.min(shopLadderMaxStepUsd, Math.max(shopLadderMinStepUsd, previous.price * (ratio - 1)));
      let lifted = shopPriceFromUsd(previous.price + extra);
      if (lifted <= previous.price) lifted = shopPriceFromUsd(previous.price + shopLadderMinStepUsd);
      current.price = lifted;
      next[current.index] = writePackagePrice(current.item, lifted);
    }
  }
  return next;
}

export function shopLadderUnitPrice(items: LadderPackage[], packageId: string) {
  const smoothed = applyShopPriceLadder(items);
  const match = smoothed.find((item) => item.id === packageId);
  return match ? readPackagePrice(match) : null;
}
