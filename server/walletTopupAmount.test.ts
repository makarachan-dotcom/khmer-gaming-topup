import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("wallet top-up amount contract", () => {
  it("keeps prior server-side amount validation while the customer Wallet pause hides all top-up amounts", () => {
    const wallet = readFileSync(resolve(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(wallet).toContain("Wallet បិទជាបណ្តោះអាសន្ន");
    expect(wallet).not.toContain("quickAmounts");
    expect(wallet).not.toContain("numericAmount");
    expect(database).toContain("amount < 100");
    expect(database).toContain("between 100 and 10,000,000 KHR");
  });
});
