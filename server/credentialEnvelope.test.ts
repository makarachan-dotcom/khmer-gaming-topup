import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "./credentialEnvelope";

describe("credential encryption master key", () => {
  it("uses the configured server-only key for an AES-GCM envelope round-trip", () => {
    expect(Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY ?? "", "base64")).toHaveLength(32);
    const sentinel = "validation-only-secret";
    const envelope = encryptCredential(sentinel);
    expect(JSON.stringify(envelope)).not.toContain(sentinel);
    expect(decryptCredential(envelope)).toBe(sentinel);
  });
});
