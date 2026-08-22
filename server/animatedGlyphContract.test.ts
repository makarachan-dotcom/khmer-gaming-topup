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

  it("uses the owner-supplied LoadingV2 outline loader for activity states", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/OutlineLoader.tsx"), "utf8");
    expect(source).toContain('const loadingV2AssetUrl = "/loading-v2.json"');
    expect(source).toContain('import type { AnimationItem } from "lottie-web"');
    expect(source).toContain('import("lottie-web")');
    expect(source).toContain("LoadingV2Placeholder");
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("LoadingV2");
    expect(source).not.toContain("outline-loader-fallback");
    expect(source).not.toContain("animate-spin");
  });
});
