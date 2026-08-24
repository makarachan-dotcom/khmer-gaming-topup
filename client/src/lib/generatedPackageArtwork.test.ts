import { describe, expect, it } from "vitest";
import { generatedPackageArtworkForPackage, generatedPackageArtworkKind } from "./generatedPackageArtwork";

describe("generatedPackageArtwork", () => {
  it("maps authorized package labels to meaningful artwork categories without placeholders", () => {
    expect(generatedPackageArtworkKind("25 Diamonds", "25 Diamonds")).toBe("diamonds");
    expect(generatedPackageArtworkKind("Weekly Membership", "Weekly Pass")).toBe("pass");
    expect(generatedPackageArtworkKind("Level Up Package - L3", "Level Up Package - L3")).toBe("level-up");
    expect(generatedPackageArtworkKind("Special Bonus", "Bonus Chest")).toBe("special");
    expect(generatedPackageArtworkKind("0.49 DEAL", "0.49 DEAL")).toBe("deal");
    expect(generatedPackageArtworkKind("51 BC", "51 BC")).toBe("bc");
    expect(generatedPackageArtworkKind("Lucky Bag Week", "Lucky Bag Week")).toBe("lucky-bag");
    expect(generatedPackageArtworkKind("Bloodstrike Pre-order Item", "Bloodstrike Pre-order Item")).toBe("preorder");
    expect(generatedPackageArtworkKind("Enable Cornucopia", "Enable Cornucopia")).toBe("special");
  });

  it("returns a distinct web-managed artwork URL for exact provider package types", () => {
    expect(generatedPackageArtworkForPackage("25 Diamonds", "25 Diamonds").url).toMatch(/^\/manus-storage\//);
    expect(generatedPackageArtworkForPackage("0.49 DEAL", "0.49 DEAL").url).not.toBe(generatedPackageArtworkForPackage("51 BC", "51 BC").url);
    expect(generatedPackageArtworkForPackage("Lucky Bag Week", "Lucky Bag Week").url).not.toBe(generatedPackageArtworkForPackage("Bloodstrike Pre-order Item", "Bloodstrike Pre-order Item").url);
  });
});
