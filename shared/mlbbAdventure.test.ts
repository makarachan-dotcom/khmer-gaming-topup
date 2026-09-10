import { describe, expect, it } from "vitest";
import { isMobileLegendsAdventureGame, isMlbbMcashPackage, isRegularMobileLegendsVariant, withoutMlbbAdventurePackages } from "./mlbbAdventure";

describe("MLBB Adventure vs regular Mobile Legends", () => {
  it("treats adventure as a different game from regular MLBB", () => {
    expect(isMobileLegendsAdventureGame("mobile_legends_adventure")).toBe(true);
    expect(isMobileLegendsAdventureGame("mobile_legends", "Mobile Legends Adventure")).toBe(true);
    expect(isMobileLegendsAdventureGame("mobile_legends_global")).toBe(false);
    expect(isRegularMobileLegendsVariant("mobile_legends_global")).toBe(true);
    expect(isRegularMobileLegendsVariant("mobile_legends_adventure")).toBe(false);
  });

  it("removes M-CASH packs from regular MLBB lists", () => {
    const packages = [
      { id: "d86", label: "86 Diamonds", amountLabel: "86 Diamonds" },
      { id: "cash", label: "60 M-CASH", amountLabel: "60 M-CASH" },
      { id: "cash2", label: "300 MCASH", amountLabel: "300 MCASH" },
      { id: "weekly", label: "Weekly Pass", amountLabel: "Weekly Pass" },
    ];
    expect(packages.filter(isMlbbMcashPackage).map((item) => item.id)).toEqual(["cash", "cash2"]);
    expect(withoutMlbbAdventurePackages(packages).map((item) => item.id)).toEqual(["d86", "weekly"]);
  });
});
