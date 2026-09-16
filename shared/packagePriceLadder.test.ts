import { describe, expect, it } from "vitest";
import { applyShopPriceLadder, packageAmountAndUnit, packageIdentityKey, shopLadderUnitPrice, shopPriceFromUsd } from "./packagePriceLadder";

describe("shop price ladder", () => {
  it("lifts a bigger diamond pack that is cheaper than a smaller one", () => {
    const packages = [
      { id: "110", label: "110 Diamonds", amountLabel: "110 Diamonds", priceLabel: "$0.73" },
      { id: "100", label: "100 Diamonds", amountLabel: "100 Diamonds", priceLabel: "$0.76" },
    ];
    const smoothed = applyShopPriceLadder(packages);
    const hundred = smoothed.find((item) => item.id === "100");
    const hundredTen = smoothed.find((item) => item.id === "110");
    expect(hundred?.priceLabel).toBe("$0.76");
    expect(Number(hundredTen?.priceUsd)).toBeGreaterThan(Number(hundred?.priceUsd));
    const extra = Number(hundredTen?.priceUsd) - 0.76;
    expect(extra).toBeGreaterThanOrEqual(0.01);
    expect(extra).toBeLessThanOrEqual(0.3);
    expect(hundredTen?.priceLabel).toBe("$0.84");
  });

  it("does not change weekly cards or already-ordered prices", () => {
    const packages = [
      { id: "weekly", label: "Weekly Membership", amountLabel: "Weekly Membership", priceLabel: "$2.20" },
      { id: "86", label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$0.70" },
      { id: "172", label: "172 Diamonds", amountLabel: "172 Diamonds", priceLabel: "$1.40" },
    ];
    expect(applyShopPriceLadder(packages).map((item) => item.priceLabel)).toEqual(["$2.20", "$0.70", "$1.40"]);
  });

  it("rounds shop prices up to the next cent", () => {
    expect(shopPriceFromUsd(0.836)).toBe(0.84);
    expect(shopLadderUnitPrice([
      { id: "100", label: "100 Diamonds", amountLabel: "100 Diamonds", priceUsd: "0.76" },
      { id: "110", label: "110 Diamonds", amountLabel: "110 Diamonds", priceUsd: "0.73" },
    ], "110")).toBe(0.84);
  });

  it("counts bonus diamonds by what the player receives, so small packs stay cheap", () => {
    expect(packageAmountAndUnit("127 + 13 Diamonds", "127 Diamonds")).toEqual({ amount: 140, unit: "diamond" });
    expect(packageAmountAndUnit("14 Diamonds", "14 Diamonds")).toEqual({ amount: 14, unit: "diamond" });
    expect(packageAmountAndUnit("60 UC + 5 UC", "65 UC")).toEqual({ amount: 65, unit: "uc" });
    expect(packageAmountAndUnit("60 UC + 5 UC", "60 UC + 5 UC")).toEqual({ amount: 65, unit: "uc" });

    const packages = [
      { id: "bonus", label: "127 + 13 Diamonds", amountLabel: "127 Diamonds", priceLabel: "$2.85" },
      { id: "small", label: "14 Diamonds", amountLabel: "14 Diamonds", priceLabel: "$0.25" },
      { id: "mid", label: "16 Diamonds", amountLabel: "16 Diamonds", priceLabel: "$0.28" },
    ];
    const smoothed = applyShopPriceLadder(packages);
    expect(smoothed.find((item) => item.id === "small")?.priceLabel).toBe("$0.25");
    expect(smoothed.find((item) => item.id === "mid")?.priceLabel).toBe("$0.28");
    expect(smoothed.find((item) => item.id === "bonus")?.priceLabel).toBe("$2.85");
  });


  it("treats Khmer diamond copy as the same unit as Diamonds", () => {
    expect(packageAmountAndUnit("86 ពេជ្យ", "86 ពេជ្យ")).toEqual({ amount: 86, unit: "diamond" });
    expect(packageAmountAndUnit("86 Diamond", "86 Diamond")).toEqual({ amount: 86, unit: "diamond" });
  });

  it("keeps one identity for the same diamond amount even when labels differ", () => {
    expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).toBe(packageIdentityKey("86 Diamond", "86 ពេជ្យ"));
    expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).toBe(packageIdentityKey("86 Diamonds (First Top-Up)", "86 Diamonds"));
    expect(packageIdentityKey("250 + 25 Diamonds", "250 + 25 Diamonds")).not.toBe(packageIdentityKey("250 Diamonds", "250 Diamonds"));
    expect(packageIdentityKey("50 + 5 Diamonds", "50 + 5 Diamonds")).toBe(packageIdentityKey("55 Diamonds", "55 Diamonds"));
    expect(packageIdentityKey("Weekly Pass", "Weekly Pass")).not.toBe(packageIdentityKey("2x Weekly", "2x Weekly"));
  });

});
