export const WEEKLY_PASS_MULTIPLES = [2, 3, 4, 5] as const;

type NamedPackage = {
  id: string;
  label: string;
  amountLabel: string;
  priceLabel: string;
};

export type StackableWeeklyPackage<T extends NamedPackage> = T & {
  quantity: number;
  sourceOfferId: string;
};

function packageCopy(item: Pick<NamedPackage, "label" | "amountLabel">) {
  return `${item.label} ${item.amountLabel}`.toLowerCase();
}

function hasWeeklyMultiplier(copy: string, count: number) {
  return new RegExp(`(?:x\\s*${count}|×\\s*${count}|\\*\\s*${count}|${count}\\s*x)\\b`).test(copy);
}

export function isStackableWeeklyPass(item: Pick<NamedPackage, "label" | "amountLabel">) {
  const copy = packageCopy(item);
  if (!/\bweekly\b/.test(copy)) return false;
  if (/\b(?:twilight|elite|epic|bundle|starlight|monthly|lite)\b/.test(copy)) return false;
  if (hasWeeklyMultiplier(copy, 2) || hasWeeklyMultiplier(copy, 3) || hasWeeklyMultiplier(copy, 4) || hasWeeklyMultiplier(copy, 5)) return false;
  return true;
}

export function stripWeeklyMultiplierLabel(label: string) {
  return label.replace(/^\s*\d+\s*[×xX*]\s*/u, "").replace(/\s*[×xX*]\s*\d+\s*$/u, "").trim();
}

function readPrice(priceLabel: string) {
  const value = priceLabel.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
  const parsed = value ? Number(value.replace(/,/g, "")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function weeklyMultiplierCardLabel(count: number) {
  return `${count}x Weekly`;
}

export function expandStackableWeeklyPackages<T extends NamedPackage>(items: T[]): Array<StackableWeeklyPackage<T>> {
  const expanded: Array<StackableWeeklyPackage<T>> = [];
  for (const item of items) {
    expanded.push({ ...item, quantity: 1, sourceOfferId: item.id });
    if (!isStackableWeeklyPass(item)) continue;
    const unit = readPrice(item.priceLabel);
    if (!(unit > 0)) continue;
    for (const count of WEEKLY_PASS_MULTIPLES) {
      if (items.some((candidate) => /\bweekly\b/.test(packageCopy(candidate)) && hasWeeklyMultiplier(packageCopy(candidate), count))) continue;
      expanded.push({
        ...item,
        id: `${item.id}::x${count}`,
        label: weeklyMultiplierCardLabel(count),
        amountLabel: weeklyMultiplierCardLabel(count),
        priceLabel: `$${(unit * count).toFixed(2)}`,
        quantity: count,
        sourceOfferId: item.id,
      });
    }
  }
  return expanded;
}

export function checkoutPackageQuantity(value: unknown) {
  const quantity = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(quantity)) return 1;
  return Math.min(9, Math.max(1, quantity));
}
