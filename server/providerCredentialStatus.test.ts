import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const status = readFileSync(new URL("./providerCredentialStatus.ts", import.meta.url), "utf8");
const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const page = readFileSync(new URL("../client/src/pages/AdminProviderSecurity.tsx", import.meta.url), "utf8");

describe("provider credential security boundary", () => {
  it("returns opaque configured/missing state without exposing credential values", () => {
    expect(status).toContain('rotationMode: "deployment_secret_only"');
    expect(status).toContain('state: state([');
    expect(status).not.toContain("return { token");
    expect(status).not.toContain("tokenFingerprint");
  });

  it("keeps credential status owner-only and never renders token-entry controls", () => {
    expect(routers).toContain("providerCredentialStatus: ownerProcedure");
    expect(page).toContain("Secure rotation boundary");
    expect(page).toContain("never accepts, stores, or displays provider tokens");
    expect(page).not.toContain('type="password"');
    expect(page).not.toContain("BAKONG_API_TOKEN");
    expect(page).not.toContain("FZR_CARDS_API_KEY");
  });
});
