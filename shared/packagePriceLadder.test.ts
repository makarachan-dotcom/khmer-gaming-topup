import { describe, expect, it } from "vitest";
import { applyShopPriceLadder, shopLadderUnitPrice, shopPriceFromUsd } from "./packagePriceLadder";

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
});
