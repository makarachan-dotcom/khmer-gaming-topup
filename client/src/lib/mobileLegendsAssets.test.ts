import { describe, expect, it } from "vitest";
import { isMobileLegendsGame, mobileLegendsDiamondAmount, mobileLegendsDiamondLabel } from "./mobileLegendsAssets";

describe("Mobile Legends package presentation", () => {
  it("recognizes Cambodia and Global Mobile Legends listings", () => {
    expect(isMobileLegendsGame("Mobile Legends Cambodia")).toBe(true);
    expect(isMobileLegendsGame("MLBB Global")).toBe(true);
    expect(isMobileLegendsGame("Free Fire Global")).toBe(false);
  });

  it("derives an editable diamond quantity from provider package text", () => {
    expect(mobileLegendsDiamondAmount("11,483 Diamonds", "11,483 + bonus")).toBe(11483);
    expect(mobileLegendsDiamondLabel("9288 Diamonds", "9288")).toBe("9,288 Diamonds");
  });
});
