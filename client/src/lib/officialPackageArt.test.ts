import { describe, expect, it } from "vitest";
import { officialPackageArtFor } from "./officialPackageArt";

describe("official package art", () => {
  it("maps Free Fire shop items to matching product art", () => {
    expect(officialPackageArtFor("free_fire", "Free Fire", "100 Diamonds", "100 Diamonds")).toContain("ff-diamond-s");
    expect(officialPackageArtFor("free_fire", "Free Fire", "520 Diamonds", "520 Diamonds")).toContain("ff-diamond-m");
    expect(officialPackageArtFor("free_fire", "Free Fire", "2180 Diamonds", "2180 Diamonds")).toContain("ff-diamond-l");
    expect(officialPackageArtFor("free_fire", "Free Fire", "Weekly Membership", "Weekly Membership")).toContain("ff-weekly");
    expect(officialPackageArtFor("free_fire", "Free Fire", "Monthly Pass", "Monthly Pass")).toContain("ff-monthly");
  });

  it("maps MLBB, PUBG, and Honor of Kings items to their own product art", () => {
    expect(officialPackageArtFor("mobile_legends", "Mobile Legends", "Weekly Pass", "Weekly Pass")).toContain("mlbb-weekly");
    expect(officialPackageArtFor("mobile_legends", "Mobile Legends", "Twilight Pass", "Twilight Pass")).toContain("mlbb-twilight");
    expect(officialPackageArtFor("pubg_mobile", "PUBG Mobile", "60 UC", "60 UC")).toContain("pubg-uc");
    expect(officialPackageArtFor("honor_of_kings", "Honor of Kings", "80 Tokens", "80 Tokens")).toContain("hok-tokens");
  });
});
