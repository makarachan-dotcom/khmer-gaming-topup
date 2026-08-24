import { describe, expect, it } from "vitest";
import { generatedPackageArtworkForPackage, generatedPackageArtworkKind } from "./generatedPackageArtwork";

describe("generatedPackageArtwork", () => {
  it("maps authorized package labels to meaningful artwork categories without placeholders", () => {
    expect(generatedPackageArtworkKind("25 Diamonds", "25 Diamonds")).toBe("diamonds");
    expect(generatedPackageArtworkKind("Weekly Membership", "Weekly Pass")).toBe("pass");
    expect(generatedPackageArtworkKind("Level Up Package - L3", "Level Up Package - L3")).toBe("level-up");
    expect(generatedPackageArtworkKind("Special Bonus", "Bonus Chest")).toBe("special");
  });

  it("returns a web-managed artwork URL for every package category", () => {
    expect(generatedPackageArtworkForPackage("25 Diamonds", "25 Diamonds").url).toMatch(/^\/manus-storage\//);
  });
});
