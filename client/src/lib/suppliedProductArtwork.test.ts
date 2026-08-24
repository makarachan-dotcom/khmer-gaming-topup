import { describe, expect, it } from "vitest";
import { suppliedProductArtworkAmountCount, suppliedProductArtworkForPackage } from "./suppliedProductArtwork";

describe("supplied product artwork", () => {
  it("returns an image only when the public game and provider amount label match exactly", () => {
    expect(suppliedProductArtworkForPackage("free_fire_my_sg", "25 Diamonds")).toContain("01K4C28HCP5G9T9T2BRQ786GHD.png");
    expect(suppliedProductArtworkForPackage("honor_of_kings", "80 Tokens")).toContain("01K4QNW8NHVY9CS1R0XCBEV461.png");
    expect(suppliedProductArtworkForPackage("magic_chess_gogo_global", "55 Diamonds")).toContain("01K86D7AH2F87NN7VDGGKKJHXR.png");
    expect(suppliedProductArtworkForPackage("free_fire_my_sg", "26 Diamonds")).toBeNull();
    expect(suppliedProductArtworkForPackage("unapproved-game", "25 Diamonds")).toBeNull();
  });

  it("uses the supplied PUBG UC artwork only for exact UC amounts on already-public PUBG variants", () => {
    expect(suppliedProductArtworkForPackage("pubg_mobile_auto", "60 UC")).toContain("01K4QSDYN8NTH9HESDG3GB5EG5.png");
    expect(suppliedProductArtworkForPackage("pubg_mobile_fast", "8,100 UC")).toBeNull();
    expect(suppliedProductArtworkForPackage("pubg_mobile_fast", "8100 UC")).toContain("01K4QT0F51DD5ZR7XM57E2VKDW.png");
  });

  it("uses only the strictly matched uploaded MLBB pass artwork and never maps an approximate diamond amount", () => {
    expect(suppliedProductArtworkForPackage("mobile_legends", "Weekly Pass")).toContain("01KJ809BB0VGX2QWEG33342T5B");
    expect(suppliedProductArtworkForPackage("mobile_legends", "Twilight Pass")).toContain("01KJ82DHRY9DYRG4XCCCSRZ3R1");
    expect(suppliedProductArtworkForPackage("mobile_legends", "Weekly Pass x2")).toBeNull();
    expect(suppliedProductArtworkForPackage("mobile_legends", "250 + 25 Diamonds (First Top-Up Bonus)")).toBeNull();
  });

  it("contains only the product image entries supplied by the owner", () => {
    expect(suppliedProductArtworkAmountCount()).toBe(79);
  });
});
