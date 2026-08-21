import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("central loading overlay", () => {
  it("uses an accessible fixed liquid-glass status overlay with activity motion", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/LoadingOverlay.tsx"), "utf8");
    expect(source).toContain("fixed inset-0");
    expect(source).toContain("z-[80]");
    expect(source).toContain('role="status"');
    expect(source).toContain('name="activity"');
    expect(source).toContain("if (!open) return null");
  });
});
