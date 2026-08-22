import { describe, expect, it } from "vitest";
import { countryFlagForRegion, orderProviderGames, providerPackageBadge } from "./providerPresentation";

describe("provider package presentation", () => {
  it("labels only provider-described package types", () => {
    expect(providerPackageBadge("Weekly Elite Pack")).toMatchObject({ tone: "weekly" });
    expect(providerPackageBadge("50 + 5 Diamonds")).toMatchObject({ tone: "bonus" });
    expect(providerPackageBadge("80 Diamonds")).toBeNull();
  });

  it("maps known provider regions to a small country flag", () => {
    expect(countryFlagForRegion("Indonesia")).toMatchObject({ flag: "🇮🇩" });
    expect(countryFlagForRegion("Unknown region")).toBeNull();
  });

  it("orders Cambodia games before Global and other provider regions", () => {
    expect(orderProviderGames([
      { id: "other", name: "Arena of Valor", region: "Indonesia" },
      { id: "global", name: "Mobile Legends", region: "Global" },
      { id: "kh", name: "EAFC Mobile", region: "Cambodia" },
    ]).map((game) => game.id)).toEqual(["kh", "global", "other"]);
  });
});
