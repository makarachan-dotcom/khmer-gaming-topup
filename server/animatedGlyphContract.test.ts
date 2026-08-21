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

  it("uses the owner-provided outline loader for activity states with safe fallbacks", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/OutlineLoader.tsx"), "utf8");
    expect(source).toContain("https://khmergame-girzfgts.manus.space/manus-storage/zurs-outline-loader_3529c2fb.json");
    expect(source).toContain('import("lottie-web")');
    expect(source).toContain("prefers-reduced-motion: reduce");
    expect(source).toContain("LoaderCircle");
  });
});
