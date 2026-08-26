import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("public AI retirement copy", () => {
  it("keeps Account help and Terms free of customer-facing AI references", () => {
    const account = readFileSync(join(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    const legal = readFileSync(join(process.cwd(), "client/src/pages/Legal.tsx"), "utf8");
    expect(account).not.toContain("ZURS AI");
    expect(legal).not.toContain("ZURS AI");
  });
});
