import { describe, expect, it } from "vitest";
import { countryFlagForRegion, providerPackageBadge } from "./providerPresentation";

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
});
