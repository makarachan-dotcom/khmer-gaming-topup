import { describe, expect, it } from "vitest";
import {
  isPubgTopupGame,
  pubgUcArtworkForAmount,
  pubgUcDisplayAmount,
  pubgUcFallbackArtwork,
} from "./pubgUcAssets";

describe("PUBG UC package artwork", () => {
  it("recognizes PUBG product identities without changing other games", () => {
    expect(isPubgTopupGame("pubg_mobile_global", "PUBG Mobile")).toBe(true);
    expect(isPubgTopupGame("new-pubg", "PUBG Mobile")).toBe(true);
    expect(isPubgTopupGame("free_fire_global", "Free Fire")).toBe(false);
  });

  it("uses supplied UC art only for exact provider amounts", () => {
    expect(pubgUcArtworkForAmount("60 UC")).toContain("uyyNbCjPfviXKQLj.png");
    expect(pubgUcArtworkForAmount("1,800 UC")).toContain("bTrtEqvswWdmLDKX.png");
    expect(pubgUcArtworkForAmount("8,100 UC")).toContain("GJJlrzeXsdGEqqXH.png");
    expect(pubgUcArtworkForAmount("60 UC + 5 UC")).toBeNull();
    expect(pubgUcArtworkForAmount("Prime Plus")).toBeNull();
  });

  it("provides a generic online UC image for every unmatched provider package", () => {
    expect(pubgUcFallbackArtwork).toContain("pvWkNiIBtgouSNwH.jpeg");
  });

  it("preserves the authorized provider text for a dynamic UC fallback", () => {
    expect(pubgUcDisplayAmount("60 UC + 5 UC")).toBe("60 UC + 5 UC");
    expect(pubgUcDisplayAmount("  325 UC ")).toBe("325 UC");
  });
});
