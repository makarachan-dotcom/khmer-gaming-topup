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
    expect(officialPackageArtFor("mobile_legends", "Mobile Legends", "11 + 1 Diamonds", "11 Diamonds")).toContain("mlbb-diamond-xs");
    expect(officialPackageArtFor("mobile_legends", "Mobile Legends", "250 Diamonds", "250 Diamonds")).toContain("mlbb-diamonds");
    expect(officialPackageArtFor("mobile_legends", "Mobile Legends", "500 Diamonds", "500 Diamonds")).toContain("mlbb-bag");
    expect(officialPackageArtFor("mobile_legends", "Mobile Legends", "1889 Diamonds", "1889 Diamonds")).toContain("mlbb-chest");
    expect(officialPackageArtFor("pubg_mobile", "PUBG Mobile", "60 UC", "60 UC")).toContain("pubg-uc");
    expect(officialPackageArtFor("honor_of_kings", "Honor of Kings", "80 Tokens", "80 Tokens")).toContain("hok-tokens");
  });

  it("maps Telegram and Roblox packs to their own product art, not diamonds", () => {
    expect(officialPackageArtFor("telegram_stars", "Telegram Stars", "500 Stars", "500 Stars")).toContain("telegram-stars");
    expect(officialPackageArtFor("telegram_premium", "Telegram Premium", "Premium 1 Month", "1 Month")).toContain("telegram-premium");
    expect(officialPackageArtFor("roblox_robux", "Roblox", "800 Robux", "800 Robux")).toContain("robux");
  });
});
