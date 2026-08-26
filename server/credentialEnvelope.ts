import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type CredentialEnvelope = {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
};

function keyFromEnvironment(): Buffer {
  const encoded = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("Credential encryption is not configured");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("Credential encryption key must decode to 32 bytes");
  return key;
}

export function encryptCredential(plaintext: string): CredentialEnvelope {
  const key = keyFromEnvironment();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") };
}

export function decryptCredential(envelope: CredentialEnvelope): string {
  if (envelope.version !== 1) throw new Error("Unsupported credential envelope version");
  const decipher = createDecipheriv("aes-256-gcm", keyFromEnvironment(), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8");
}
