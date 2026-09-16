/** Smallest extra USD when a bigger pack is cheaper than a smaller one. */
export const shopLadderMinStepUsd = 0.01;
/** Largest extra USD on one inverted step — never a huge jump. */
export const shopLadderMaxStepUsd = 2;

export type LadderPackage = {
  id: string;
  label: string;
  amountLabel: string;
  priceLabel?: string;
  priceUsd?: string;
};

export function packageAmountAndUnit(label: string, amountLabel: string) {
  const text = `${amountLabel} ${label}`.toLowerCase().replace(/,/g, "").replace(/ពេជ្យ|ពេជ្រ/g, " diamond ");
  if (/\b(?:weekly|daily|monthly|membership|subscription|pass|promo|special|event|crate)\b/.test(text)) return null;

  const bonus = text.match(/(\d+(?:\.\d+)?)(?:\s*[a-z]+)?\s*\+\s*(\d+(?:\.\d+)?)\s*([a-z]+)/);
  if (bonus) {
    const amount = Number(bonus[1]) + Number(bonus[2]);
    const unit = (bonus[3] ?? "").replace(/s$/, "");
    if (Number.isFinite(amount) && amount > 0 && unit) return { amount, unit };
  }

  let best: { amount: number; unit: string } | null = null;
  for (const match of text.matchAll(/(\d+(?:\.\d+)?)\s*([a-z]+)/g)) {
    const amount = Number(match[1]);
    const unit = (match[2] ?? "").replace(/s$/, "");
    if (!Number.isFinite(amount) || amount <= 0 || !unit) continue;
    if (!best || amount > best.amount) best = { amount, unit };
  }
  return best;
}

/** One shop card per amount+unit. Extra words (region, first top-up) do not create a second price. */
export function packageIdentityKey(label: string, amountLabel = "") {
  const measure = packageAmountAndUnit(label, amountLabel);
  if (measure) return `qty:${measure.amount}:${measure.unit}`;
  const name = `${label} ${amountLabel}`.toLowerCase().replace(/ពេជ្យ|ពេជ្រ/g, "diamond").replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
  return `name:${name}`;
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

/** Return only the cheapest offer for each received-quantity/package identity. */
export function keepCheapestEquivalentPackages<T extends LadderPackage>(items: T[]) {
  const cheapest = new Map<string, { item: T; price: number }>();
  for (const item of items) {
    const price = readPackagePrice(item);
    const key = packageIdentityKey(item.label, item.amountLabel);
    const current = cheapest.get(key);
    if (!current || price < current.price || (price === current.price && item.id.localeCompare(current.item.id) < 0)) {
      cheapest.set(key, { item, price });
    }
  }
  return [...cheapest.values()].map(({ item }) => item);
}

/** Round up to the next cent so the ladder stays a clean shop price. */
export function shopPriceFromUsd(value: number) {
  return Number((Math.ceil(value * 100 - 1e-9) / 100).toFixed(2));
}

function writePackagePrice<T extends LadderPackage>(item: T, price: number): T {
  const priceUsd = price.toFixed(2);
  return { ...item, priceUsd, priceLabel: `$${priceUsd}` };
}

/**
 * If 110 diamonds is cheaper than 100 diamonds, lift the bigger pack a little
 * ($0.01–$0.30 typically, never more than $2) so prices stay in order.
 * Never lowers a pack.
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
