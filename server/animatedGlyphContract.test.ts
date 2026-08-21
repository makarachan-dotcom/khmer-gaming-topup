import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("animated glyph integration", () => {
  it("uses the approved Lottie runtime with a reduced-motion fallback", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/AnimatedGlyph.tsx"), "utf8");
    expect(source).toContain('import UseAnimations from "react-useanimations"');
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("notification");
    expect(source).toContain("checkmark");
  });
});
