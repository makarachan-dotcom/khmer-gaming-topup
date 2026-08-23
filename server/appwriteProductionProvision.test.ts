import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Appwrite production provisioning", () => {
  it("requires an explicit confirmation and enables only the record database and collection", async () => {
    const script = await readFile(new URL("../scripts/provision-appwrite-production.mjs", import.meta.url), "utf8");
    expect(script).toContain('APPWRITE_PROVISION_CONFIRM !== "ZURS_STORE"');
    expect(script).toContain('databaseId, name: "ZURS STORE Records", enabled: true');
    expect(script).toContain('collectionId,');
    expect(script).toContain('documentSecurity: true,');
    expect(script).toContain('enabled: true,');
  });
});
