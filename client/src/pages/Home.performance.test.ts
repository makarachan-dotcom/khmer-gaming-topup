import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("storefront image loading performance", () => {
  it("preloads the critical banner and connects to its CDN before app rendering", () => {
    const documentSource = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(documentSource).toContain('rel="preconnect" href="https://files.manuscdn.com"');
    expect(documentSource).toContain('rel="preload"');
    expect(documentSource).toContain('as="image"');
    expect(documentSource).toContain('fetchpriority="high"');
  });

  it("uses explicit aspect frames, async decode, and native lazy loading for noncritical media", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain("aspect-[16/5.5]");
    expect(homeSource).toContain('fetchPriority="high"');
    expect(homeSource).toContain("zurs-banner-slide--pan");
    expect(homeSource).toContain('loading="lazy"');
    expect(homeSource).toContain('decoding="async"');
    expect(homeSource).toContain('sizes="(max-width: 639px) 50vw');
    expect(homeSource).toContain('aspect-[16/10]');
  });

  it("keeps the Weekly Loyalty Giveaway card out of the public Home page", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).not.toContain("LiveSpinPromo");
    expect(homeSource).not.toContain("Weekly Loyalty Giveaway");
  });

  it("uses an address-free Accept Payment strip with a right-aligned KHQR logo", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain("ACCEPT PAYMENT");
    expect(homeSource).toContain('src={khqrLogoUrl}');
    expect(homeSource).toContain('alt="KHQR"');
    expect(homeSource).not.toContain("zurs-game-count");
    expect(homeSource).not.toContain("payment-location");
    expect(homeSource).not.toContain("zurs-status-notice");
  });
});
