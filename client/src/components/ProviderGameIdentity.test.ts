import { describe, expect, it } from "vitest";
import { gameRegionMarker } from "@/lib/providerPresentation";
import { hasProviderApprovedGameLogo } from "./ProviderGameIdentity";

describe("provider game identity", () => {
  it("accepts only secure provider-approved logo URLs", () => {
    expect(hasProviderApprovedGameLogo("https://provider.example/game.png")).toBe(true);
    expect(hasProviderApprovedGameLogo("http://provider.example/game.png")).toBe(false);
    expect(hasProviderApprovedGameLogo()).toBe(false);
  });

  it("uses a country flag only for a recognized region and otherwise labels a game as Global", () => {
    expect(gameRegionMarker("Mobile Legends (Indonesia)", "Indonesia")).toMatchObject({ kind: "country", flag: "🇮🇩", label: "Indonesia" });
    expect(gameRegionMarker("Acecraft")).toEqual({ kind: "global", label: "Global" });
  });
});
