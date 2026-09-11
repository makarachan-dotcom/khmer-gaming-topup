import { describe, expect, it } from "vitest";
import { gameRegionMarker } from "@/lib/providerPresentation";
import { canRenderProviderArtwork, hasProviderApprovedGameLogo, resolveProviderGameLogo } from "./ProviderGameIdentity";

describe("provider game identity", () => {
  it("accepts only secure provider-approved logo URLs", () => {
    expect(hasProviderApprovedGameLogo("https://provider.example/game.png")).toBe(true);
    expect(hasProviderApprovedGameLogo("http://provider.example/game.png")).toBe(false);
    expect(hasProviderApprovedGameLogo()).toBe(false);
  });

  it("uses an Admin-uploaded managed logo before the Mobile Legends fallback artwork", () => {
    const uploadedLogo = "/manus-storage/appwrite/zurs_media/admin-media/example/logo.webp";
    expect(resolveProviderGameLogo("Mobile Legends (Global)", uploadedLogo)).toBe("/api/media/appwrite/zurs_media/admin-media/example/logo.webp");
    expect(resolveProviderGameLogo("Mobile Legends (Global)", "https://reseller.fazercards.com/blocked.webp")).toBe("https://reseller.fazercards.com/blocked.webp");
    expect(resolveProviderGameLogo("Mobile Legends (Global)")).toBe("/api/provider-artwork/mobile-legends");
    expect(resolveProviderGameLogo("Roblox Robux")).toBe("/package-art/roblox-logo.png");
    expect(canRenderProviderArtwork("/api/provider-artwork/mobile-legends")).toBe(true);
    expect(canRenderProviderArtwork("/package-art/roblox-logo.png")).toBe(true);
    expect(canRenderProviderArtwork("/api/media/appwrite/zurs_media/admin-media/example/logo.webp")).toBe(true);
    expect(resolveProviderGameLogo("Acecraft", "https://provider.example/acecraft.png")).toBe("https://provider.example/acecraft.png");
  });

  it("uses a country flag only for a recognized region and otherwise labels a game as Global", () => {
    expect(gameRegionMarker("Mobile Legends (Indonesia)", "Indonesia")).toMatchObject({ kind: "country", flag: "🇮🇩", label: "Indonesia" });
    expect(gameRegionMarker("Acecraft")).toEqual({ kind: "global", label: "Global" });
  });
});
