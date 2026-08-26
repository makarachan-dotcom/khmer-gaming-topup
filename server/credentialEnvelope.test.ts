import { describe, expect, it } from "vitest";
import { decryptCredential, encryptCredential } from "./credentialEnvelope";

const configuredKey = Buffer.from(process.env.CREDENTIAL_ENCRYPTION_KEY ?? "", "base64");
const credentialKeyTest = configuredKey.length === 32 ? it : it.skip;

describe("credential encryption master key", () => {
  credentialKeyTest("uses the configured server-only key for an AES-GCM envelope round-trip", () => {
    expect(configuredKey).toHaveLength(32);
    const sentinel = "validation-only-secret";
    const envelope = encryptCredential(sentinel);
    expect(JSON.stringify(envelope)).not.toContain(sentinel);
    expect(decryptCredential(envelope)).toBe(sentinel);
  });
});
