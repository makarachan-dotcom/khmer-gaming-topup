import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("provider credential rotation security contract", () => {
  it("persists AES-GCM envelope fields and audit metadata without a plaintext credential column", () => {
    const schema = read("drizzle/schema.ts");
    expect(schema).toContain("providerCredentialVersions");
    expect(schema).toContain("ciphertext: text(\"ciphertext\").notNull()");
    expect(schema).toContain("authTag: varchar(\"authTag\"");
    expect(schema).toContain("providerCredentialAudits");
    expect(schema).not.toContain("plaintextCredential");
  });

  it("requires owner-only confirmation and validation before encryption activation", () => {
    const router = read("server/routers.ts");
    expect(router).toContain("rotateProviderCredential: ownerProcedure");
    expect(router).toContain("validateProviderCredentialCandidate");
    expect(router).toContain("if (validation !== \"validated\")");
    expect(router).toContain("encryptCredential(input.credential)");
    expect(router).toContain("ROLLBACK FAZERCARDS");
    expect(router).toContain("rollbackProviderCredential: ownerProcedure");
  });

  it("keeps runtime fallback and admin UI free of credential disclosure or payment activation", () => {
    const resolver = read("server/providerCredentialResolver.ts");
    const ui = read("client/src/pages/AdminProviderSecurity.tsx");
    expect(resolver).toContain("deploymentCredential?.trim() ?? null");
    expect(ui).toContain("type=\"password\"");
    expect(ui).toContain("Payment Control នៅតែ OFF");
    expect(ui).not.toContain("defaultValue={process.env");
  });
});
