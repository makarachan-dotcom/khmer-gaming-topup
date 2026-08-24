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

  it("keeps the requested pure-CSS wireframe SVG markup, tokens, motion, and reduced-motion fallback", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('<svg className="fx-contour" viewBox="0 0 260 56" role="img" aria-label="OUTLINE"><text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">OUTLINE</text></svg>');
    expect(componentSource).not.toContain("dominant-baseline");
    expect(componentSource).not.toContain("text-anchor");
    expect(styleSource).toContain("--ink: currentColor;");
    expect(styleSource).toContain("--ink-2: #FF4FD8;");
    expect(styleSource).toContain("--ink-3: #4FF8FF;");
    expect(styleSource).toContain("stroke-dasharray: 34 66;");
    expect(styleSource).toContain("animation: fx-contour 3.2s linear infinite;");
    expect(styleSource).toContain("to { stroke-dashoffset: -100; }");
    expect(styleSource).toContain(".fx-contour text { animation: none; }");
  });

  it("applies the requested pure-CSS Topographic effect to the ZURS STORE brand name", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('<div className="fx-topographic">ZURS STORE</div>');
    expect(componentSource).not.toContain("fx-magnetic");
    expect(styleSource).toContain('font: 600 28px/1.15 "JetBrains Mono", monospace;');
    expect(styleSource).toContain("repeating-radial-gradient(ellipse at 30% 55%");
    expect(styleSource).toContain("animation: fx-topographic 5s linear infinite;");
    expect(styleSource).toContain("to { background-position: 130px 0, -170px 0; }");
    expect(styleSource).toContain(".fx-topographic { animation: none; }");
  });
});
