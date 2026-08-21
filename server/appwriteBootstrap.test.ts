import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Appwrite staging bootstrap", () => {
  it("keeps the migration database and collection private until validation", async () => {
    const script = await readFile(new URL("../scripts/bootstrap-appwrite.mjs", import.meta.url), "utf8");
    expect(script).toContain('enabled: false');
    expect(script).toContain('permissions: []');
    expect(script).toContain('Keep this database disabled until record counts, payment totals, and permissions are independently verified.');
  });
});
