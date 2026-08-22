import { describe, expect, it } from "vitest";
import { gameRegionMarker } from "@/lib/providerPresentation";
import { hasProviderApprovedGameLogo, resolveProviderGameLogo } from "./ProviderGameIdentity";

describe("provider game identity", () => {
  it("accepts only secure provider-approved logo URLs", () => {
    expect(hasProviderApprovedGameLogo("https://provider.example/game.png")).toBe(true);
    expect(hasProviderApprovedGameLogo("http://provider.example/game.png")).toBe(false);
    expect(hasProviderApprovedGameLogo()).toBe(false);
  });

  it("uses the managed copy of provider-supplied Mobile Legends artwork when its origin blocks browser rendering", () => {
    expect(resolveProviderGameLogo("Mobile Legends (Global)", "https://reseller.fazercards.com/blocked.webp")).toBe("https://khmergame-girzfgts.manus.space/manus-storage/fzr-mobile-legends-global_d1d5e868.webp");
    expect(resolveProviderGameLogo("Acecraft", "https://provider.example/acecraft.png")).toBe("https://provider.example/acecraft.png");
  });

  it("uses a country flag only for a recognized region and otherwise labels a game as Global", () => {
    expect(gameRegionMarker("Mobile Legends (Indonesia)", "Indonesia")).toMatchObject({ kind: "country", flag: "🇮🇩", label: "Indonesia" });
    expect(gameRegionMarker("Acecraft")).toEqual({ kind: "global", label: "Global" });
  });
});
