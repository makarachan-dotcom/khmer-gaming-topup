import { describe, expect, it } from "vitest";
import { isImageContentType, providerArtworkSource } from "./providerArtwork";

describe("provider artwork route", () => {
  it("uses the managed provider-supplied Mobile Legends cover", () => {
    expect(providerArtworkSource("mobileLegends")).toBe("https://khmergame-girzfgts.manus.space/manus-storage/fzr-mobile-legends-global_d1d5e868.webp");
  });

  it("permits only image response types through the proxy", () => {
    expect(isImageContentType("image/webp")).toBe(true);
    expect(isImageContentType("text/html; charset=utf-8")).toBe(false);
    expect(isImageContentType(null)).toBe(false);
  });
});
