import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("Appwrite migration safety", () => {
  it("uses deterministic document identifiers and excludes Gmail sender refresh tokens", async () => {
    const script = await readFile(new URL("../scripts/migrate-mysql-to-appwrite.mjs", import.meta.url), "utf8");
    expect(script).toContain('crypto.createHash("sha256")');
    expect(script).toContain('response.status === 409');
    expect(script).toContain('"payment_transactions"');
    expect(script).not.toContain('"gmail_sender_connections"');
    expect(script).not.toContain('"game_products"');
    expect(script).not.toContain('"smm_services"');
    expect(script).toContain('process.exit(0)');
  });

  it("removes catalog defaults from staging rather than treating them as provider-authorized data", async () => {
    const script = await readFile(new URL("../scripts/reconcile-appwrite-staging.mjs", import.meta.url), "utf8");
    expect(script).toContain('"game_products"');
    expect(script).toContain('"game_packages"');
    expect(script).toContain('"smm_services"');
    expect(script).toContain('"smm_tiers"');
    expect(script).toContain('method: "DELETE"');
  });
});
