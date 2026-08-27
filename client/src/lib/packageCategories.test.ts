import { describe, expect, it } from "vitest";
import { automaticPackageCategoryLabel, buildPackageCategories, categoryLabelForPackage, filterPackagesByCategory } from "./packageCategories";

const packages = [
  { id: "token", label: "86 Diamonds", amountLabel: "86 Diamonds" },
  { id: "weekly", label: "Weekly Membership", amountLabel: "Weekly Membership" },
  { id: "bonus", label: "60 UC + 5 UC", amountLabel: "65 UC" },
  { id: "special", label: "Promo Crate", amountLabel: "1 Crate" },
];

describe("package category presentation", () => {
  it("derives useful default categories from package data", () => {
    expect(packages.map(automaticPackageCategoryLabel)).toEqual(["Token", "Weekly Card", "Super Offer", "កញ្ចប់ពិសេស"]);
  });

  it("uses a saved Admin category override only for the matching offer", () => {
    const overrides = new Map([["token", "ពេញនិយម"]]);
    expect(categoryLabelForPackage(packages[0]!, overrides)).toBe("ពេញនិយម");
    expect(categoryLabelForPackage(packages[1]!, overrides)).toBe("Weekly Card");
  });

  it("builds tab counts from package data and filters without mutating the package list", () => {
    const overrides = { token: "ពេញនិយម", special: "ពេញនិយម" };
    expect(buildPackageCategories(packages, overrides)).toEqual([
      { id: "weekly card", label: "Weekly Card", count: 1 },
      { id: "super offer", label: "Super Offer", count: 1 },
      { id: "ពេញនិយម", label: "ពេញនិយម", count: 2 },
    ]);
    expect(filterPackagesByCategory(packages, "ពេញនិយម", overrides).map((item) => item.id)).toEqual(["token", "special"]);
    expect(filterPackagesByCategory(packages, "all", overrides)).toBe(packages);
    expect(packages.map((item) => item.id)).toEqual(["token", "weekly", "bonus", "special"]);
  });
});
