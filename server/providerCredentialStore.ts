import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { providerCredentialAudits, providerCredentialVersions } from "../drizzle/schema";
import { decryptCredential, type CredentialEnvelope } from "./credentialEnvelope";
import { getDb } from "./db";

export type RotatableProvider = "fazercards" | "bakong";

function historyRow(row: typeof providerCredentialVersions.$inferSelect) {
  return { id: row.id, provider: row.provider, state: row.state, createdByUserId: row.createdByUserId, activatedAt: row.activatedAt, supersededAt: row.supersededAt, createdAt: row.createdAt };
}

export async function getActiveEncryptedProviderCredential(provider: RotatableProvider) {
  const db = await getDb();
  if (!db) return null;
  try {
    const [row] = await db.select().from(providerCredentialVersions).where(and(eq(providerCredentialVersions.provider, provider), eq(providerCredentialVersions.state, "active"))).orderBy(desc(providerCredentialVersions.activatedAt)).limit(1);
    if (!row) return null;
    return decryptCredential({ version: 1, iv: row.iv, tag: row.authTag, ciphertext: row.ciphertext });
  } catch {
    return null;
  }
}

export async function getProviderCredentialHistory() {
  const db = await getDb();
  if (!db) return { versions: [], audits: [] };
  const [versions, audits] = await Promise.all([
    db.select().from(providerCredentialVersions).orderBy(desc(providerCredentialVersions.createdAt)).limit(30),
    db.select().from(providerCredentialAudits).orderBy(desc(providerCredentialAudits.createdAt)).limit(50),
  ]);
  return {
    versions: versions.map(historyRow),
    audits: audits.map((row) => ({ provider: row.provider, action: row.action, fromVersionId: row.fromVersionId, toVersionId: row.toVersionId, actorUserId: row.actorUserId, reason: row.reason, createdAt: row.createdAt })),
  };
}

export async function recordProviderCredentialValidationRejected(input: { provider: RotatableProvider; actorUserId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Credential storage is unavailable");
  await db.insert(providerCredentialAudits).values({ id: nanoid(), provider: input.provider, action: "validation_rejected", actorUserId: input.actorUserId, reason: input.reason.trim().slice(0, 240) });
}

export async function activateEncryptedProviderCredential(input: { provider: RotatableProvider; envelope: CredentialEnvelope; actorUserId: number; reason: string }) {
  const db = await getDb();
  if (!db) throw new Error("Credential storage is unavailable");
  const nextId = nanoid();
  const now = new Date();
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(providerCredentialVersions).where(and(eq(providerCredentialVersions.provider, input.provider), eq(providerCredentialVersions.state, "active"))).orderBy(desc(providerCredentialVersions.activatedAt)).limit(1);
    if (current) await tx.update(providerCredentialVersions).set({ state: "superseded", supersededAt: now }).where(eq(providerCredentialVersions.id, current.id));
    await tx.insert(providerCredentialVersions).values({ id: nextId, provider: input.provider, envelopeVersion: input.envelope.version, ciphertext: input.envelope.ciphertext, iv: input.envelope.iv, authTag: input.envelope.tag, state: "active", validationStatus: "validated", createdByUserId: input.actorUserId, activatedAt: now });
    await tx.insert(providerCredentialAudits).values({ id: nanoid(), provider: input.provider, action: "activate", fromVersionId: current?.id ?? null, toVersionId: nextId, actorUserId: input.actorUserId, reason: input.reason.trim().slice(0, 240) });
    return { versionId: nextId };
  });
}

export async function rollbackProviderCredential(input: { provider: RotatableProvider; actorUserId: number; reason: string; targetVersionId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Credential storage is unavailable");
  const now = new Date();
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(providerCredentialVersions).where(and(eq(providerCredentialVersions.provider, input.provider), eq(providerCredentialVersions.state, "active"))).limit(1);
    if (input.targetVersionId) {
      const [target] = await tx.select().from(providerCredentialVersions).where(and(eq(providerCredentialVersions.id, input.targetVersionId), eq(providerCredentialVersions.provider, input.provider), eq(providerCredentialVersions.state, "superseded"))).limit(1);
      if (!target) throw new Error("Selected credential version is unavailable for rollback");
      if (current) await tx.update(providerCredentialVersions).set({ state: "superseded", supersededAt: now }).where(eq(providerCredentialVersions.id, current.id));
      await tx.update(providerCredentialVersions).set({ state: "active", supersededAt: null, activatedAt: now }).where(eq(providerCredentialVersions.id, target.id));
      await tx.insert(providerCredentialAudits).values({ id: nanoid(), provider: input.provider, action: "rollback_to_version", fromVersionId: current?.id ?? null, toVersionId: target.id, actorUserId: input.actorUserId, reason: input.reason.trim().slice(0, 240) });
      return { activeVersionId: target.id };
    }
    if (current) await tx.update(providerCredentialVersions).set({ state: "superseded", supersededAt: now }).where(eq(providerCredentialVersions.id, current.id));
    await tx.insert(providerCredentialAudits).values({ id: nanoid(), provider: input.provider, action: "rollback_to_env", fromVersionId: current?.id ?? null, toVersionId: null, actorUserId: input.actorUserId, reason: input.reason.trim().slice(0, 240) });
    return { activeVersionId: null };
  });
}
