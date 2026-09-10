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

const automaticCategoryOrder = ["Diamond", "Token", "Weekly Card", "Monthly Pack", "Elite Pack", "Super Offer", "កញ្ចប់ពិសេស"];

function packageWords(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  return `${item.label} ${item.amountLabel}`.toLowerCase();
}

export function normalizePackageCategoryLabel(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function isDiamondPackage(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  if (/\b(?:weekly|daily|monthly|membership|subscription|pass)\b/.test(copy)) return false;
  return /\bdiamonds?\b/.test(copy);
}

/** A readable fallback until an Admin assigns a category to the individual offer. */
export function automaticPackageCategoryLabel(item: Pick<CategoryPackage, "label" | "amountLabel">) {
  const copy = packageWords(item);
  if (/\bmonthly\b/.test(copy)) return "Monthly Pack";
  if (/\bweekly\b/.test(copy)) return "Weekly Card";
  if (/\b(?:elite|premium)\b/.test(copy)) return "Elite Pack";
  if (/\b(?:daily|membership|subscription|pass)\b/.test(copy)) return "Weekly Card";
  if (isDiamondPackage(item)) return "Diamond";
  if (/\b(?:bonus|first\s*top[\s-]*up|extra)\b|\+\s*\d[\d,]*(?:\s*[a-z]+)?\b/.test(copy)) return "Super Offer";
  if (/\b(?:promo|special|discount|sale|event|exclusive|full\s*ticket)\b/.test(copy)) return "កញ្ចប់ពិសេស";
  return "Token";
}

export function categoryLabelForPackage(item: CategoryPackage, overrides: ReadonlyMap<string, string> | Record<string, string> = {}) {
  const categoryMap = overrides as ReadonlyMap<string, string>;
  const candidate = typeof categoryMap.get === "function" ? categoryMap.get(item.id) : (overrides as Record<string, string>)[item.id];
  return normalizePackageCategoryLabel(candidate ?? "") || automaticPackageCategoryLabel(item);
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
  if (/diamond/.test(categoryId)) return items.filter((item) => isDiamondPackage(item));
  return items.filter((item) => categoryLabelForPackage(item, overrides).toLocaleLowerCase() === categoryId);
}
