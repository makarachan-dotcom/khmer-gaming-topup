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
    expect(componentSource).toContain('<svg className="fx-contour" viewBox="0 0 260 56" role="img" aria-label="OUTLINE"><text x="50%" y="50%" dominant-baseline="central" text-anchor="middle">OUTLINE</text></svg>');
    expect(styleSource).toContain("--ink: currentColor;");
    expect(styleSource).toContain("--ink-2: #FF4FD8;");
    expect(styleSource).toContain("--ink-3: #4FF8FF;");
    expect(styleSource).toContain("stroke-dasharray: 34 66;");
    expect(styleSource).toContain("animation: fx-contour 3.2s linear infinite;");
    expect(styleSource).toContain("to { stroke-dashoffset: -100; }");
    expect(styleSource).toContain(".fx-contour text { animation: none; }");
  });
});
