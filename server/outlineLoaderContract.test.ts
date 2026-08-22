import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("outline loader contract", () => {
  it("uses the owner-supplied LoadingV2 asset with a reduced-motion-safe static state", () => {
    const loader = readFileSync(resolve(process.cwd(), "client/src/components/OutlineLoader.tsx"), "utf8");
    const overlay = readFileSync(resolve(process.cwd(), "client/src/components/LoadingOverlay.tsx"), "utf8");
    expect(loader).not.toContain('animate-spin');
    expect(loader).toContain('/manus-storage/loading-v2-outline_78a8cd0e.json');
    expect(loader).toContain('lottie.loadAnimation');
    expect(loader).toContain('prefers-reduced-motion: reduce');
    expect(loader).toContain('outline-loader-fallback');
    expect(loader).toContain('outline-loader-lottie');
    expect(overlay).toContain('OutlineLoader');
  });
});
