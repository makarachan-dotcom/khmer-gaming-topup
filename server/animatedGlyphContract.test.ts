import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("animated glyph integration", () => {
  it("uses the approved animation runtime with a reduced-motion fallback", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/AnimatedGlyph.tsx"), "utf8");
    expect(source).toContain('import("react-useanimations")');
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("checkmark");
    expect(source).toContain("home");
    expect(source).toContain("OutlineLoader");
    expect(source).not.toContain("notification");
  });

  it("uses the approved non-rotating outline-and-dots loader for activity states", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/OutlineLoader.tsx"), "utf8");
    expect(source).toContain('strokeLinecap="round"');
    expect(source).toContain("outline-loader-dot--one");
    expect(source).toContain("outline-loader-dot--two");
    expect(source).toContain("outline-loader-dot--three");
    expect(source).not.toContain("animate-spin");
  });
});
