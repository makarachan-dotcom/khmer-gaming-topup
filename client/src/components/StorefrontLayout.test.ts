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

  it("keeps the requested pure-CSS Magnetic logo-adjacent markup, timing, tokens, and reduced-motion fallback", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('className="fx-magnetic" role="img" aria-label="MAGNET"');
    expect(componentSource).toContain('>M</b><b aria-hidden="true"');
    expect(componentSource).toContain('>T</b></div>');
    expect(styleSource).toContain('font: 600 30px/1.1 "JetBrains Mono", monospace;');
    expect(styleSource).toContain("animation: fx-magnetic 2.7s ease-in-out infinite;");
    expect(styleSource).toContain("animation-delay: calc(var(--i) * .07s);");
    expect(styleSource).toContain(".fx-magnetic b:nth-child(odd) { color: var(--ink-3); }");
    expect(styleSource).toContain(".fx-magnetic b { animation: none; }");
  });
});
