import { describe, expect, it } from "vitest";
import {
  checkoutPackageQuantity,
  expandStackableWeeklyPackages,
  isStackableWeeklyPass,
  stripWeeklyMultiplierLabel,
} from "./stackableWeeklyPackages";

describe("stackable weekly packages", () => {
  it("expands a weekly pass into 2x–5x cards priced as N purchases", () => {
    const packages = [
      { id: "d86", label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.10" },
      { id: "weekly", label: "Weekly Pass", amountLabel: "Weekly Pass", priceLabel: "$1.59" },
      { id: "elite", label: "Weekly Elite Bundle", amountLabel: "Weekly Elite Bundle", priceLabel: "$0.90" },
    ];
    const expanded = expandStackableWeeklyPackages(packages);
    expect(expanded.map((item) => item.id)).toEqual([
      "d86",
      "weekly",
      "weekly::x2",
      "weekly::x3",
      "weekly::x4",
      "weekly::x5",
      "elite",
    ]);
    expect(expanded.find((item) => item.id === "weekly::x2")).toMatchObject({
      label: "2x Weekly",
      amountLabel: "2x Weekly",
      priceLabel: "$3.18",
      quantity: 2,
      sourceOfferId: "weekly",
    });
    expect(expanded.find((item) => item.id === "weekly::x5")).toMatchObject({
      label: "5x Weekly",
      priceLabel: "$7.95",
      quantity: 5,
      sourceOfferId: "weekly",
    });
    expect(isStackableWeeklyPass(packages[1]!)).toBe(true);
    expect(isStackableWeeklyPass(packages[2]!)).toBe(false);
    expect(isStackableWeeklyPass(packages[0]!)).toBe(false);
  });

  it("does not invent ×2 when the catalog already has a weekly x2 offer", () => {
    const packages = [
      { id: "w1", label: "Weekly Pass", amountLabel: "Weekly Pass", priceLabel: "$1.50" },
      { id: "w2", label: "Weekly Pass x2", amountLabel: "Weekly Pass x2", priceLabel: "$3.00" },
    ];
    expect(expandStackableWeeklyPackages(packages).map((item) => item.id)).toEqual(["w1", "w1::x3", "w1::x4", "w1::x5", "w2"]);
  });

  it("keeps checkout quantity inside the paid 1–9 band", () => {
    expect(checkoutPackageQuantity(2)).toBe(2);
    expect(checkoutPackageQuantity(undefined)).toBe(1);
    expect(checkoutPackageQuantity(99)).toBe(9);
    expect(stripWeeklyMultiplierLabel("Weekly Pass ×2")).toBe("Weekly Pass");
    expect(stripWeeklyMultiplierLabel("2x Weekly")).toBe("Weekly");
    expect(stripWeeklyMultiplierLabel("5x Weekly")).toBe("Weekly");
  });
});
