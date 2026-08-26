import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("wallet top-up amount contract", () => {
  it("allows the approved 100 KHR validation amount consistently in the client and server rules", () => {
    const wallet = readFileSync(resolve(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(wallet).toContain("const quickAmounts = [100, 1000");
    expect(wallet).toContain("numericAmount >= 100");
    expect(wallet).toContain("អប្បបរមា ៛100");
    expect(database).toContain("amount < 100");
    expect(database).toContain("between 100 and 10,000,000 KHR");
  });
});
