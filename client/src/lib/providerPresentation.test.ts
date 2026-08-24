import { describe, expect, it } from "vitest";
import {
  cambodiaSupportMarker,
  countryFlagForRegion,
  filterProviderGames,
  groupProviderGamesByBaseName,
  orderProviderGames,
  providerGameNameParts,
  providerGameVariantLabel,
  providerPackageBadge,
} from "./providerPresentation";

describe("provider package presentation", () => {
  it("labels only provider-described package types", () => {
    expect(providerPackageBadge("Weekly Elite Pack")).toMatchObject({
      tone: "weekly",
    });
    expect(providerPackageBadge("50 + 5 Diamonds")).toMatchObject({
      tone: "bonus",
    });
    expect(providerPackageBadge("80 Diamonds")).toBeNull();
  });

  it("maps known provider regions to a small country flag", () => {
    expect(countryFlagForRegion("Indonesia")).toMatchObject({ flag: "🇮🇩" });
    expect(countryFlagForRegion("Unknown region")).toBeNull();
  });

  it("marks every public listing as Cambodia-supported without changing its catalog region", () => {
    expect(cambodiaSupportMarker("Mobile Legends", "Global")).toEqual({ flag: "🇰🇭", label: "Cambodia · Global" });
    expect(cambodiaSupportMarker("Free Fire (SG)", "Singapore")).toEqual({ flag: "🇰🇭", label: "Cambodia · Singapore" });
    expect(cambodiaSupportMarker("Arena of Valor", "Indonesia")).toEqual({ flag: "🇰🇭", label: "Cambodia · Indonesia" });
  });

  it("orders Cambodia games before Global and other provider regions", () => {
    expect(
      orderProviderGames([
        { id: "other", name: "Arena of Valor", region: "Indonesia" },
        { id: "global", name: "Mobile Legends", region: "Global" },
        { id: "kh", name: "EAFC Mobile", region: "Cambodia" },
      ]).map(game => game.id)
    ).toEqual(["kh", "global", "other"]);
  });

  it("filters the customer catalog by query and supported region view", () => {
    const games = [
      { id: "kh", name: "EAFC Mobile", region: "Cambodia" },
      { id: "global", name: "Mobile Legends", region: "Global" },
      { id: "other", name: "Arena of Valor", region: "Indonesia" },
    ];
    expect(filterProviderGames(games, "legends").map(game => game.id)).toEqual([
      "global",
    ]);
    expect(
      filterProviderGames(games, "", "cambodia").map(game => game.id)
    ).toEqual(["kh", "global", "other"]);
    expect(
      filterProviderGames(games, "", "global").map(game => game.id)
    ).toEqual(["global"]);
  });
});


describe("provider game catalog grouping", () => {
  it("separates a provider title into its base game and genuine variant", () => {
    expect(providerGameNameParts("Mobile Legends (Global)")).toEqual({ baseName: "Mobile Legends", variant: "Global" });
    expect(providerGameNameParts("Free Fire (MY/SG)")).toEqual({ baseName: "Free Fire", variant: "MY/SG" });
    expect(providerGameNameParts("Blood Strike MENA")).toEqual({ baseName: "Blood Strike", variant: "MENA" });
    expect(providerGameNameParts("Mobile Legends: Adventure")).toEqual({ baseName: "Mobile Legends: Adventure", variant: "" });
  });

  it("groups every equivalent public game name and retains each provider product id", () => {
    const games = [
      { id: "mobile_legends_promo", name: "Mobile Legends (Promo)", region: "Promo" },
      { id: "mobile_legends_global", name: "Mobile Legends (Global)", region: "Global" },
      { id: "mobile_legends_special", name: "Mobile Legends (Special)", region: "Special" },
      { id: "free_fire_sg", name: "Free Fire (SG)", region: "Singapore" },
      { id: "free_fire_kh", name: "Free Fire (KH)", region: "Cambodia" },
      { id: "pubg_mobile_auto", name: "PUBG Mobile (Auto)", region: "Global" },
      { id: "pubg_mobile_fast", name: "PUBG Mobile (Fast)", region: "Global" },
      { id: "honor_of_kings", name: "Honor of Kings", region: "Global" },
    ];

    const grouped = groupProviderGamesByBaseName(games);
    const mobileLegends = grouped.find(group => group.baseName === "Mobile Legends");
    const freeFire = grouped.find(group => group.baseName === "Free Fire");
    const pubgMobile = grouped.find(group => group.baseName === "PUBG Mobile");
    const honorOfKings = grouped.find(group => group.baseName === "Honor of Kings");

    expect(mobileLegends?.games.map(game => game.id)).toEqual(["mobile_legends_global", "mobile_legends_promo", "mobile_legends_special"]);
    expect(mobileLegends?.games.map(providerGameVariantLabel)).toEqual(["Global", "Promo", "Special"]);
    expect(freeFire?.games.map(game => game.id)).toEqual(["free_fire_kh", "free_fire_sg"]);
    expect(freeFire?.games.map(providerGameVariantLabel)).toEqual(["KH", "SG"]);
    expect(pubgMobile?.games.map(game => game.id)).toEqual(["pubg_mobile_auto", "pubg_mobile_fast"]);
    expect(pubgMobile?.games.map(providerGameVariantLabel)).toEqual(["Auto", "Fast"]);
    expect(honorOfKings?.games.map(game => game.id)).toEqual(["honor_of_kings"]);
  });

  it("uses Global only as the compact label for an unqualified title inside a group", () => {
    expect(providerGameVariantLabel({ id: "blood_strike", name: "Blood Strike" })).toBe("Global");
  });
});
