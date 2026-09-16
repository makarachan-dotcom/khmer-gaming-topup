import { describe, expect, it } from "vitest";
import {
  expandStorefrontProviderIds,
  groupAvailabilityLikeStorefront,
  groupCatalogGamesLikeStorefront,
  keepCheapestAdminOffers,
  storefrontCatalogFamily,
} from "./AdminPricing";

describe("admin catalog keeps provider controls separate", () => {
  it("keeps every Free Fire regional route as a separate admin game", () => {
    expect(storefrontCatalogFamily({ id: "free_fire_bd", name: "Free Fire (BD)" })?.id).toBe("free_fire");
    expect(storefrontCatalogFamily({ titleEn: "Free Fire (MY/SG)" })?.titleEn).toBe("Free Fire");
    expect(groupAvailabilityLikeStorefront([
      { id: "free_fire_bd", name: "Free Fire (BD)", isActive: true },
      { id: "free_fire_my_sg", name: "Free Fire (MY/SG)", isActive: false },
      { id: "8_ball_pool", name: "8 Ball Pool", isActive: true },
    ]).map((item) => item.id)).toEqual(["free_fire_bd", "free_fire_my_sg", "8_ball_pool"]);
  });

  it("keeps the cheapest package first and preserves expensive reserves", () => {
    const unique = keepCheapestAdminOffers([
      { id: "high", amountLabel: "100 Diamonds", basePriceUsd: "1.00", profitMarginPercent: "0", priceUsd: "1.20", isActive: true, providerAuthorized: true },
      { id: "low", amountLabel: "100 Diamonds", basePriceUsd: "0.80", profitMarginPercent: "0", priceUsd: "0.95", isActive: true, providerAuthorized: true },
      { id: "first", amountLabel: "100 Diamonds (First Top-Up)", basePriceUsd: "1.10", profitMarginPercent: "0", priceUsd: "1.30", isActive: true, providerAuthorized: true },
      { id: "weekly", amountLabel: "Weekly Membership", basePriceUsd: "2.00", profitMarginPercent: "0", priceUsd: "2.20", isActive: true, providerAuthorized: true },

    ]);
    expect(unique.map((item) => item.id)).toEqual(["low", "high", "first", "weekly"]);
  });

  it("keeps Free Fire catalog rows and toggles one provider id at a time", () => {
    const grouped = groupCatalogGamesLikeStorefront([
      { id: "fzr-a", titleEn: "Free Fire (BD)", packages: [{ id: "bd-100", amountLabel: "100 Diamonds", basePriceUsd: "1.00", profitMarginPercent: "0", priceUsd: "1.10", isActive: true, providerAuthorized: true }] },
      { id: "fzr-b", titleEn: "Free Fire (MY/SG)", packages: [{ id: "sg-100", amountLabel: "100 Diamonds", basePriceUsd: "0.80", profitMarginPercent: "0", priceUsd: "0.90", isActive: true, providerAuthorized: true }] },
    ]);
    expect(grouped).toHaveLength(2);
    expect(grouped.map((item) => item.id)).toEqual(["fzr-a", "fzr-b"]);
    expect(expandStorefrontProviderIds("free_fire", [
      { id: "free_fire_bd", name: "Free Fire (BD)", isActive: true },
      { id: "free_fire_my_sg", name: "Free Fire (MY/SG)", isActive: true },
    ])).toEqual(["free_fire"]);
  });

  it("keeps MLBB Adventure / M-CASH out of regular Mobile Legends", () => {
    expect(storefrontCatalogFamily({ id: "mobile_legends_global", name: "Mobile Legends (Global)" })?.id).toBe("mobile_legends");
    expect(storefrontCatalogFamily({ id: "mobile_legends_adventure", name: "Mobile Legends Adventure" })).toBeNull();
    const grouped = groupCatalogGamesLikeStorefront([
      { id: "mlbb", titleEn: "Mobile Legends (Global)", packages: [{ id: "d86", amountLabel: "86 Diamonds", basePriceUsd: "1.00", profitMarginPercent: "0", priceUsd: "1.10", isActive: true, providerAuthorized: true }] },
      { id: "adv", titleEn: "Mobile Legends Adventure", packages: [{ id: "cash", amountLabel: "60 M-CASH", basePriceUsd: "1.00", profitMarginPercent: "0", priceUsd: "1.10", isActive: true, providerAuthorized: true }] },
    ]);
    expect(grouped.map((item) => item.titleEn)).toEqual(["Mobile Legends (Global)", "Mobile Legends Adventure"]);
    expect(grouped.find((item) => item.titleEn === "Mobile Legends (Global)")?.packages?.map((item) => item.id)).toEqual(["d86"]);
  });
});
