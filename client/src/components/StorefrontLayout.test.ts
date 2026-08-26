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

  it("removes the Gaming & Digital subtitle and retains a clean AI-free mobile tab bar", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).not.toContain("GAMING &amp; DIGITAL");
    expect(componentSource).toContain("zurs-mobile-tabbar");
    expect(componentSource).toContain("zurs-mobile-tab--active");
    expect(componentSource).not.toContain('label: "AI"');
    expect(styleSource).toContain("zurs-particle-field");
  });

  it("moves a pill indicator between the two remaining mobile tabs", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("zurs-mobile-tab-indicator");
    expect(componentSource).toContain('"--mobile-tab-index": activeMobileTabIndex');
    expect(styleSource).toContain("--mobile-tab-index");
    expect(styleSource).toContain("width: calc((100% - 0.75rem) / 2)");
    expect(styleSource).not.toContain("width: calc((100% - 1.5rem) / 4)");
    expect(styleSource).toContain("zurs-mobile-tab-indicator-enter");
    expect(styleSource).toContain("tab-icon-active");
  });

  it("uses a compact two-item rounded mobile tab bar without public AI entry", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("hidden h-11 w-11");
    expect(componentSource).toContain("grid h-[3.25rem] grid-cols-2");
    expect(componentSource).toContain("gap-0.5");
    expect(componentSource).not.toContain('href: "/ai"');
    expect(componentSource).toContain("rounded-full");
    expect(styleSource).toContain("border-radius: 999px");
  });

  it("uses a matching rounded top header without changing desktop controls", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    expect(componentSource).toContain("zurs-compact-header sticky top-2");
    expect(componentSource).toContain("rounded-[1.25rem]");
  });

  it("uses a banner-aligned particle field with staggered reduced-motion-safe twinkles", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("zurs-particle-field");
    expect(componentSource).toContain("particleSlots");
    expect(styleSource).toContain("zurs-particle-twinkle");
    expect(styleSource).toContain("prefers-reduced-motion: no-preference");
    expect(styleSource).toContain("oklch(0.19 0.08 261)");
  });

  it("uses Kantumruy Pro for the storefront and Hanuman for long Khmer copy", () => {
    const documentSource = readFileSync(join(process.cwd(), "client/index.html"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(documentSource).toContain("family=Hanuman");
    expect(documentSource).toContain("family=Kantumruy+Pro");
    expect(styleSource).toContain('font-family: "Hanuman", "Kantumruy Pro"');
    expect(styleSource).toContain("prefers-reduced-motion: no-preference");
  });
});
