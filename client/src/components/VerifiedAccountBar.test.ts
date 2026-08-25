import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("VerifiedAccountBar", () => {
  it("keeps identifiers masked and retains the immediate edit-ID action", () => {
    const source = readFileSync(join(process.cwd(), "client/src/components/VerifiedAccountBar.tsx"), "utf8");
    expect(source).toContain("•••${value.slice(-4)}");
    expect(source).toContain("កែ ID");
    expect(source).toContain("fixed left-1/2");
  });
});
