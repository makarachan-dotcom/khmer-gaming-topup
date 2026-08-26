import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("streamdown", () => ({ Streamdown: () => null }));
import { isProtectedMediaTarget } from "./StorefrontLayout";

class MediaElement {
  constructor(private readonly media: boolean) {}
  closest(selector: string) { return this.media && selector === "img, video" ? this : null; }
}

describe("storefront media protection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes only image and video targets for unobtrusive interaction safeguards", () => {
    vi.stubGlobal("Element", MediaElement);
    expect(isProtectedMediaTarget(new MediaElement(true))).toBe(true);
    expect(isProtectedMediaTarget(new MediaElement(false))).toBe(false);
    expect(isProtectedMediaTarget(null)).toBe(false);
  });

  it("removes the unwanted Wireframe OUTLINE decoration from the header", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).not.toContain("fx-contour");
    expect(componentSource).not.toContain("OUTLINE");
    expect(styleSource).not.toContain(".fx-contour");
  });

  it("uses a compact animated ZURS.me wordmark rather than the former Topographic brand", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('className="fx-zurs-me"');
    expect(componentSource).toContain('aria-label="ZURS.me"');
    expect(componentSource).not.toContain("fx-topographic");
    expect(styleSource).toContain(".fx-zurs-me");
    expect(styleSource).toContain("zurs-letter-settle");
    expect(styleSource).not.toContain(".fx-topographic");
  });

  it("removes the Gaming & Digital subtitle and retains a clean AI-first mobile tab bar", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).not.toContain("GAMING &amp; DIGITAL");
    expect(componentSource).toContain("zurs-mobile-tabbar");
    expect(componentSource).toContain("zurs-mobile-tab--active");
    expect(componentSource).toContain('label: "AI"');
    expect(styleSource).toContain("radial-gradient(circle, oklch(0.49 0.05 267 / 0.18)");
  });

  it("moves a dedicated indicator when the active mobile tab changes", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("zurs-mobile-tab-indicator");
    expect(componentSource).toContain('"--mobile-tab-index": activeMobileTabIndex');
    expect(styleSource).toContain("--mobile-tab-index");
    expect(styleSource).toContain("zurs-mobile-tab-indicator-enter");
    expect(styleSource).toContain("tab-icon-active");
  });

  it("keeps mobile AI as a route-backed tab and removes the mobile floating scroll control", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    expect(componentSource).toContain('onClick={() => setLocation("/ai")}');
    expect(componentSource).toContain("hidden h-11 w-11");
    expect(componentSource).toContain("grid h-[4.6rem] grid-cols-3");
  });
});
