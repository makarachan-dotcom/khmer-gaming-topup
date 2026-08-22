import { describe, expect, it } from "vitest";
import { isMobileLegendsGlobalGame, mobileLegendsDiamondAmount, mobileLegendsDiamondLabel } from "./mobileLegendsAssets";

describe("Mobile Legends package presentation", () => {
  it("targets only the provider Mobile Legends Global game ID", () => {
    expect(isMobileLegendsGlobalGame("mobile_legends_global")).toBe(true);
    expect(isMobileLegendsGlobalGame("MOBILE_LEGENDS_GLOBAL")).toBe(true);
    expect(isMobileLegendsGlobalGame("mobile_legends_brazil")).toBe(false);
    expect(isMobileLegendsGlobalGame("mobile_legends_adventure")).toBe(false);
  });

  it("derives an editable diamond quantity from provider package text", () => {
    expect(mobileLegendsDiamondAmount("11,483 Diamonds", "11,483 + bonus")).toBe(11483);
    expect(mobileLegendsDiamondLabel("9288 Diamonds", "9288")).toBe("9,288 Diamonds");
  });
});
