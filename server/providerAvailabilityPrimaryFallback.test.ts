import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("primary provider availability fallback", () => {
  it("persists Admin visibility policy in the primary ledger before requiring Appwrite availability storage", () => {
    const source = readFileSync(new URL("./providerCatalog.ts", import.meta.url), "utf8");
    expect(source).toContain('const { setPrimaryProviderAvailability } = await import("./db")');
    expect(source).toContain("const primary = await setPrimaryProviderAvailability");
    expect(source).toContain("if (primary) return primary;");
    expect(source.indexOf("if (primary) return primary;")).toBeLessThan(source.indexOf("if (!isAppwriteStoreConfigured())"));
  });
});
