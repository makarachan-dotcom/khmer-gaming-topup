import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("outline loader contract", () => {
  it("uses the owner-supplied LoadingV2 asset with a reduced-motion-safe static state", () => {
    const loader = readFileSync(resolve(process.cwd(), "client/src/components/OutlineLoader.tsx"), "utf8");
    const overlay = readFileSync(resolve(process.cwd(), "client/src/components/LoadingOverlay.tsx"), "utf8");
    expect(loader).not.toContain('animate-spin');
    expect(loader).toContain('const loadingV2AssetUrl = "/loading-v2.json"');
    expect(loader).toContain('LoadingV2Placeholder');
    expect(loader).toContain('cache: "force-cache"');
    expect(loader).toContain('lottie.loadAnimation');
    expect(loader).toContain('prefers-reduced-motion: reduce');
    expect(loader).toContain('LoadingV2');
    expect(loader).toContain('loading-v2__animation');
    expect(loader).not.toContain('outline-loader-fallback');
    expect(overlay).toContain('OutlineLoader');
    expect(overlay).toContain('pointer-events-none');
  });
});
