import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

  it("applies the requested pure-CSS Topographic effect to the ZURS STORE brand name", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('<div className="fx-topographic">ZURS STORE</div>');
    expect(componentSource).not.toContain("fx-magnetic");
    expect(styleSource).toContain('font: 600 28px/1.15 "JetBrains Mono", monospace;');
    expect(styleSource).toContain("repeating-radial-gradient(ellipse at 30% 55%");
    expect(styleSource).toContain("--ink: oklch(0.29 0.06 260);");
    expect(styleSource).toContain("--ink-3: oklch(0.62 0.17 220);");
    expect(styleSource).toContain("animation: fx-topographic 5s linear infinite;");
    expect(styleSource).toContain("to { background-position: 130px 0, -170px 0; }");
    expect(styleSource).toContain(".fx-topographic { animation: none; }");
  });

  it("centers the Gaming & Digital subtitle beneath the animated brand name", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    expect(componentSource).toContain('className="mt-1 whitespace-nowrap text-center text-[8px] font-bold tracking-[0.16em] text-indigo-600">GAMING &amp; DIGITAL');
  });
});
