import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("outline loader contract", () => {
  it("does not retain a rotating fallback in the shared loader or central overlay", () => {
    const loader = readFileSync(resolve(process.cwd(), "client/src/components/OutlineLoader.tsx"), "utf8");
    const overlay = readFileSync(resolve(process.cwd(), "client/src/components/LoadingOverlay.tsx"), "utf8");
    const styles = readFileSync(resolve(process.cwd(), "client/src/index.css"), "utf8");
    expect(loader).not.toContain('animate-spin');
    expect(loader).toContain('outline-loader-dot--one');
    expect(loader).toContain('strokeLinecap="round"');
    expect(overlay).toContain('OutlineLoader');
    expect(styles).toContain('.animate-spin { animation: outline-loader-static-pulse');
  });
});
