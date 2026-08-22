import { describe, expect, it } from "vitest";
import {
  cambodiaSupportMarker,
  countryFlagForRegion,
  filterProviderGames,
  orderProviderGames,
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
