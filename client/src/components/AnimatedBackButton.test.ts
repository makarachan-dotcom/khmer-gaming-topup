import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("animated checkout back button", () => {
  it("uses an explicit leaving state before navigation and keeps a reduced-motion-safe path", () => {
    const component = readFileSync(resolve(process.cwd(), "client/src/components/AnimatedBackButton.tsx"), "utf8");
    expect(component).toContain('"animated-back-button--leaving"');
    expect(component).toContain("window.setTimeout(() => navigate(href), 360)");
    expect(component).toContain("if (reduceMotion) {");
    expect(component).toContain("navigate(href);");
  });

  it("provides polished mobile interaction styles and disables motion when requested", () => {
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(styles).toContain("@keyframes checkout-back-enter");
    expect(styles).toContain(".checkout-page__back:active");
    expect(styles).toContain(".checkout-page__back:focus-visible");
    expect(styles).toContain(".checkout-page__back.animated-back-button--leaving");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
