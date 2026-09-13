import { describe, expect, it } from "vitest";
import { automaticPackageCategoryLabel, buildPackageCategories, categoryLabelForPackage, filterPackagesByCategory, isDiamondPackage } from "./packageCategories";

const packages = [
  { id: "token", label: "86 Diamonds", amountLabel: "86 Diamonds" },
  { id: "weekly", label: "Weekly Membership", amountLabel: "Weekly Membership" },
  { id: "bonus", label: "60 UC + 5 UC", amountLabel: "65 UC" },
  { id: "special", label: "Promo Crate", amountLabel: "1 Crate" },
];

describe("package category presentation", () => {
  it("derives useful default categories from package data", () => {
    expect(packages.map(automaticPackageCategoryLabel)).toEqual(["ពេជ្យ", "Weekly Card", "Super Offer", "កញ្ចប់ពិសេស"]);
  });

  it("automatically separates monthly and elite packages into useful filters", () => {
    expect(automaticPackageCategoryLabel({ label: "Monthly Elite Pack", amountLabel: "Monthly Elite Pack" })).toBe("Monthly Pack");
    expect(automaticPackageCategoryLabel({ label: "Weekly Elite Pack", amountLabel: "Weekly Elite Pack" })).toBe("Weekly Card");
    expect(automaticPackageCategoryLabel({ label: "Elite Pack", amountLabel: "Elite Pack" })).toBe("Elite Pack");
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

  it("shows only diamond packs when the Diamond filter is selected", () => {
    const mixed = [
      ...packages,
      { id: "weekly-named-diamond", label: "Weekly Diamond Pass", amountLabel: "Weekly Diamond Pass" },
    ];
    expect(isDiamondPackage(packages[0]!)).toBe(true);
    expect(filterPackagesByCategory(mixed, "diamond").map((item) => item.id)).toEqual(["token"]);
  });

  it("keeps Mobile Legends filters exclusive to the selected pack type", () => {
    const mlbb = [
      { id: "d10", label: "10 + 1 Diamonds", amountLabel: "10 Diamonds" },
      { id: "d86", label: "86 Diamonds", amountLabel: "86 Diamonds" },
      { id: "limited", label: "Limited-Time Value Pack", amountLabel: "Limited-Time Value Pack" },
      { id: "weekly", label: "Weekly Pass", amountLabel: "Weekly Pass" },
      { id: "twilight", label: "Twilight Pass", amountLabel: "Twilight Pass" },
    ];
    expect(mlbb.map(automaticPackageCategoryLabel)).toEqual(["ពេជ្យ", "ពេជ្យ", "Super Offer", "Weekly Card", "Twilight Pass"]);
    expect(filterPackagesByCategory(mlbb, "diamond").map((item) => item.id)).toEqual(["d10", "d86"]);
    expect(filterPackagesByCategory(mlbb, "ពេជ្យ").map((item) => item.id)).toEqual(["d10", "d86"]);
    expect(filterPackagesByCategory(mlbb, "weekly card").map((item) => item.id)).toEqual(["weekly"]);
    expect(filterPackagesByCategory(mlbb, "twilight pass").map((item) => item.id)).toEqual(["twilight"]);
    expect(filterPackagesByCategory(mlbb, "super offer").map((item) => item.id)).toEqual(["limited"]);
  });

  it("keeps Token filter on currency packs that are not diamonds", () => {
    const items = [
      { id: "uc", label: "60 UC", amountLabel: "60 UC" },
      { id: "robux", label: "800 Robux", amountLabel: "800 Robux" },
      { id: "stars", label: "500 Stars", amountLabel: "500 Stars" },
      { id: "diamonds", label: "100 Diamonds", amountLabel: "100 Diamonds" },
    ];
    expect(filterPackagesByCategory(items, "token").map((item) => item.id)).toEqual(["uc", "robux", "stars"]);
    expect(filterPackagesByCategory(items, "diamond").map((item) => item.id)).toEqual(["diamonds"]);
  });
});
