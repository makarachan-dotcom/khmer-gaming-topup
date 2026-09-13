export type CategoryPackage = {
  id: string;
  label: string;
  amountLabel: string;
};

export type PackageCategory = {
  id: string;
  label: string;
  count: number;
};

const automaticCategoryOrder = ["ពេជ្យ", "Token", "Weekly Card", "Twilight Pass", "Monthly Pack", "Elite Pack", "Super Offer", "កញ្ចប់ពិសេស"];

function packageWords(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  return `${item.label} ${item.amountLabel}`.toLowerCase();
}

export function normalizePackageCategoryLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

function isWeeklyPackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  return /\bweekly\b/.test(copy) && !/\btwilight\b/.test(copy);
}

function isMonthlyPackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  return /\bmonthly\b/.test(packageWords(item));
}

function isTwilightPackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  return /\btwilight\b/.test(packageWords(item));
}

function isElitePackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  if (isWeeklyPackage(item) || isMonthlyPackage(item) || isTwilightPackage(item)) return false;
  return /\b(?:elite|premium|starlight)\b/.test(copy);
}

export function isDiamondPackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  if (/\b(?:weekly|daily|monthly|membership|subscription|pass|twilight|starlight)\b/.test(copy)) return false;
  return /\bdiamonds?\b/.test(copy);
}

function isTokenCurrencyPackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  if (isDiamondPackage(item) || isWeeklyPackage(item) || isMonthlyPackage(item) || isTwilightPackage(item) || isElitePackage(item)) return false;
  return /\b(?:uc|robux|stars?|tokens?|coins?)\b/.test(copy);
}

/** A readable fallback until an Admin assigns a category to the individual offer. */
export function automaticPackageCategoryLabel(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  if (isMonthlyPackage(item)) return "Monthly Pack";
  if (isWeeklyPackage(item)) return "Weekly Card";
  if (isTwilightPackage(item)) return "Twilight Pass";
  if (isElitePackage(item)) return "Elite Pack";
  if (isDiamondPackage(item)) return "ពេជ្យ";
  if (/\b(?:bonus|first\s*top[\s-]*up|extra|limited|value\s*pack|bundle)\b/.test(copy) || /\+\s*\d[\d,]*(?:\s*[a-z]+)?\b/.test(copy)) return "Super Offer";
  if (/\b(?:promo|special|discount|sale|event|exclusive|full\s*ticket)\b/.test(copy)) return "កញ្ចប់ពិសេស";
  if (isTokenCurrencyPackage(item)) return "Token";
  return "Super Offer";
}

export function categoryLabelForPackage(item: CategoryPackage, overrides: ReadonlyMap<string, string> | Record<string, string> = {}) {
  const categoryMap = overrides as ReadonlyMap<string, string>;
  const candidate = typeof categoryMap.get === "function" ? categoryMap.get(item.id) : (overrides as Record<string, string>)[item.id];
  const override = normalizePackageCategoryLabel(candidate ?? "");
  const automatic = automaticPackageCategoryLabel(item);
  if (!override) return automatic;
  if (override.toLocaleLowerCase() === "diamond" && !isDiamondPackage(item)) return automatic;
  if (override === "ពេជ្យ" && !isDiamondPackage(item)) return automatic;
  return override;
}

export function buildPackageCategories(items: CategoryPackage[], overrides: ReadonlyMap<string, string> | Record<string, string> = {}) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const label = categoryLabelForPackage(item, overrides);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ id: label.toLocaleLowerCase(), label, count }))
    .sort((left, right) => {
      const leftOrder = automaticCategoryOrder.indexOf(left.label);
      const rightOrder = automaticCategoryOrder.indexOf(right.label);
      if (leftOrder >= 0 || rightOrder >= 0) return (leftOrder < 0 ? Number.MAX_SAFE_INTEGER : leftOrder) - (rightOrder < 0 ? Number.MAX_SAFE_INTEGER : rightOrder);
      return left.label.localeCompare(right.label, "km");
    });
}

export function filterPackagesByCategory<T extends CategoryPackage>(items: T[], categoryId: string, overrides: ReadonlyMap<string, string> | Record<string, string> = {}) {
  if (!categoryId || categoryId === "all") return items;
  const selected = categoryId.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (selected === "diamond" || selected === "ពេជ្យ") return isDiamondPackage(item);
    const label = categoryLabelForPackage(item, overrides).toLocaleLowerCase();
    if (label !== selected) return false;
    if (selected === "weekly card") return isWeeklyPackage(item);
    if (selected === "twilight pass") return isTwilightPackage(item);
    return true;
  });
}
