import { describe, expect, it } from "vitest";
import { applyShopPriceLadder, keepCheapestEquivalentPackages, packageAmountAndUnit, packageIdentityKey, shopLadderUnitPrice, shopPriceFromUsd } from "./packagePriceLadder";

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

  it("publishes only the cheapest equivalent offer to shoppers", () => {
    const visible = keepCheapestEquivalentPackages([
      { id: "expensive", label: "50 + 5 Diamonds", amountLabel: "50 + 5 Diamonds", priceLabel: "$1.20" },
      { id: "cheap", label: "55 Diamonds", amountLabel: "55 Diamonds", priceLabel: "$0.99" },
    ]);
    expect(visible.map((item) => item.id)).toEqual(["cheap"]);
  });

  it("recognizes parenthesized bonus sums and emoji-attached amounts as the same package", () => {
    expect(packageAmountAndUnit("(78+8) Diamonds", "(78+8) Diamonds")).toEqual({ amount: 86, unit: "diamond" });
    expect(packageAmountAndUnit("86💎 Diamonds", "86💎 Diamonds")).toEqual({ amount: 86, unit: "diamond" });
    expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).toBe(packageIdentityKey("(78+8) Diamonds", "(78+8) Diamonds"));
    expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).toBe(packageIdentityKey("86💎 Diamonds", "86💎 Diamonds"));
    expect(packageIdentityKey("Weekly Diamond Pass", "Weekly Diamond Pass")).toBe(
      packageIdentityKey("Weekly Diamond Pass (MLBB)", "Weekly Diamond Pass (MLBB)"),
    );
  });

  it("shows only the cheapest package when the diamond sums match", () => {
    const visible = keepCheapestEquivalentPackages([
      { id: "expensive", label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.50" },
      { id: "cheap", label: "(78+8) Diamonds", amountLabel: "(78+8) Diamonds", priceLabel: "$1.10" },
      { id: "other", label: "172 Diamonds", amountLabel: "172 Diamonds", priceLabel: "$2.90" },
    ]);
    expect(visible.map((item) => item.id).sort()).toEqual(["cheap", "other"]);
  });

  it("treats every equivalent diamond expression as one package no matter how it is written", () => {
    // All of these mean 86 diamonds received.
    const eightySix = [
      "86 Diamonds",
      "(78+8) Diamonds",
      "(78 + 8) Diamonds",
      "(78+8)Diamonds",
      "78+8 Diamonds",
      "78 + 8 Diamonds",
      "86 Diamonds (78+8)",
      "86 (78+8) Diamonds",
      "(78+8) Bonus Diamonds",
      "86💎",
      "💎 86 Diamonds",
    ];
    for (const label of eightySix) {
      expect(packageAmountAndUnit(label, label)).toEqual({ amount: 86, unit: "diamond" });
      expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).toBe(packageIdentityKey(label, label));
    }
    // Bonus-word sums are real totals: 86 + 8 means 94, not 86.
    expect(packageAmountAndUnit("86 Diamonds + 8 Bonus", "86 Diamonds + 8 Bonus")).toEqual({ amount: 94, unit: "diamond" });
    expect(packageIdentityKey("94 Diamonds", "94 Diamonds")).toBe(
      packageIdentityKey("86 Diamonds + 8 Bonus", "86 Diamonds + 8 Bonus"),
    );
    expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).not.toBe(
      packageIdentityKey("86 Diamonds + 8 Bonus", "86 Diamonds + 8 Bonus"),
    );
    // Multipliers multiply: 2x 86 means 172.
    expect(packageAmountAndUnit("2x 86 Diamonds", "2x 86 Diamonds")).toEqual({ amount: 172, unit: "diamond" });
    expect(packageAmountAndUnit("86 Diamonds x2", "86 Diamonds x2")).toEqual({ amount: 172, unit: "diamond" });
    expect(packageIdentityKey("172 Diamonds", "172 Diamonds")).toBe(
      packageIdentityKey("2x 86 Diamonds", "2x 86 Diamonds"),
    );
    expect(packageIdentityKey("172 Diamonds", "172 Diamonds")).toBe(
      packageIdentityKey("(86+86) Diamonds", "(86+86) Diamonds"),
    );
    // Different totals never merge.
    expect(packageIdentityKey("86 Diamonds", "86 Diamonds")).not.toBe(
      packageIdentityKey("172 Diamonds", "172 Diamonds"),
    );
  });

  it("publishes only the cheapest row when several labels describe the same diamond total", () => {
    const visible = keepCheapestEquivalentPackages([
      { id: "a", label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.50" },
      { id: "b", label: "(78+8) Diamonds", amountLabel: "(78+8) Diamonds", priceLabel: "$1.10" },
      { id: "c", label: "2x 43 Diamonds", amountLabel: "2x 43 Diamonds", priceLabel: "$1.05" },
      { id: "d", label: "78+8 Diamonds", amountLabel: "78+8 Diamonds", priceLabel: "$1.20" },
      { id: "e", label: "172 Diamonds", amountLabel: "172 Diamonds", priceLabel: "$2.90" },
    ]);
    expect(visible.map((item) => item.id).sort()).toEqual(["c", "e"]);
  });

});
