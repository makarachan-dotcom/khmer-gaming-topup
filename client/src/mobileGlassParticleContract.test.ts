import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("mobile liquid-glass and particle contract", () => {
  it("keeps an expanded visible particle field and a translucent footer", () => {
    const layout = source("client/src/components/StorefrontLayout.tsx");
    const css = source("client/src/index.css");
    expect(layout).toContain('"96%", "29%", "1px"');
    expect(layout).toContain("zurs-footer-glass");
    expect(css).toContain(".zurs-footer-glass");
    expect(css).toContain("opacity: 0.38");
    expect(css).toContain(".zurs-dotted-shell::before");
    expect(css).toContain("background-size: 31px 31px");
    expect(css).toContain("zurs-particle-twinkle");
  });

  it("uses soft liquid-glass surfaces for mobile catalog controls", () => {
    const home = source("client/src/pages/Home.tsx");
    const css = source("client/src/index.css");
    expect(home).toContain("zurs-mobile-glass group block rounded-2xl");
    expect(home).toContain("zurs-mobile-glass h-11 w-full");
    expect(home).toContain("zurs-mobile-glass flex gap-1");
    expect(css).toContain(".zurs-mobile-glass");
  });
});
