import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const status = readFileSync(new URL("./providerCredentialStatus.ts", import.meta.url), "utf8");
const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/AdminProviderSecurity.tsx", import.meta.url), "utf8");

describe("provider credential security boundary", () => {
  it("returns opaque configured/missing state without exposing credential values", async () => {
    expect(status).toContain('rotationMode: "encrypted_owner_rotation_with_env_fallback"');
    expect(status).toContain('state: state([');
    expect(status).not.toContain("return { token");
    expect(status).not.toContain("tokenFingerprint");
  });

  it("keeps credential rotation owner-only without rendering existing secret values", () => {
    expect(routers).toContain("providerCredentialStatus: ownerProcedure");
    expect(routers).toContain("rotateProviderCredential: ownerProcedure");
    expect(page).toContain("Encrypted rotation");
    expect(page).toContain('type="password"');
    expect(page).toContain("Payment Control នៅតែ OFF");
    expect(page).not.toContain("BAKONG_API_TOKEN");
    expect(page).not.toContain("FZR_CARDS_API_KEY");
  });
});
