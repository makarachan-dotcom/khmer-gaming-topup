import { describe, expect, it } from "vitest";
import { isMobileLegendsGlobalGame, mobileLegendsDiamondAmount, mobileLegendsDiamondLabel, mobileLegendsPackageTone } from "./mobileLegendsAssets";

describe("Mobile Legends package presentation", () => {
  it("targets the unified Mobile Legends family route and its primary provider variant", () => {
    expect(isMobileLegendsGlobalGame("mobile_legends")).toBe(true);
    expect(isMobileLegendsGlobalGame("mobile_legends_global")).toBe(true);
    expect(isMobileLegendsGlobalGame("MOBILE_LEGENDS_GLOBAL")).toBe(true);
    expect(isMobileLegendsGlobalGame("mobile_legends_brazil")).toBe(false);
    expect(isMobileLegendsGlobalGame("mobile_legends_adventure")).toBe(false);
  });

  it("derives an editable diamond quantity from provider package text", () => {
    expect(mobileLegendsDiamondAmount("11,483 Diamonds", "11,483 + bonus")).toBe(11483);
    expect(mobileLegendsDiamondLabel("9288 Diamonds", "9288")).toBe("9,288 ពេជ្យ");
    expect(mobileLegendsDiamondAmount("250 + 25 Diamonds", "250 + 25 Diamonds")).toBe(275);
    expect(mobileLegendsDiamondLabel("250 + 25 Diamonds", "250 + 25 Diamonds")).toBe("275 ពេជ្យ");

  });

  it("selects a visual tone from the verified package type without changing package labels", () => {
    expect(mobileLegendsPackageTone("86 Diamonds", "86 Diamonds")).toBe("diamonds");
    expect(mobileLegendsPackageTone("250 + 25 Diamonds (First Top-Up Bonus)", "250 + 25 Diamonds (First Top-Up Bonus)")).toBe("bonus");
    expect(mobileLegendsPackageTone("Weekly Pass", "Weekly Pass")).toBe("pass");
    expect(mobileLegendsPackageTone("Special Event", "Special Event")).toBe("special");
  });
});
