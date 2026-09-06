import { eq, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { siteContent } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Shared key/value store for live support chat state.
 *
 * WHY THIS FILE EXISTS
 *
 * This app is deployed as Vercel serverless functions (see vercel.json:
 * `api/[...path].ts`). Every HTTP request may be served by a different
 * instance, so a `Map` in module scope is NOT shared state - it is per
 * instance, and it vanishes between requests.
 *
 * Support chat originally stored sessions in Redis with a `Map` fallback. On a
 * deployment where Upstash is not configured, that fallback becomes the only
 * store, which produced exactly this bug: `POST /open` created the session on
 * instance A, the customer's first message landed on instance B, `getSession`
 * returned null, and the customer saw "chat not found" and could never reach a
 * human. The chat could not work at all, on any device.
 *
 * MySQL is the one store this deployment definitely shares, so chat state now
 * lives there. `site_content` is reused as a namespaced key/value table because
 * the codebase already uses it that way for JSON blobs (provider availability,
 * delegated admin permissions, payment methods, contact admins). Reusing it
 * avoids a schema migration, which matters: a migration the operator never
 * runs would leave the chat exactly as broken as it is today.
 *
 * Two details keep these rows harmless:
 *  - `isActive: false`, so they can never surface in the public site-content
 *    feed (`db.ts` filters that feed on `isActive`).
 *  - every row carries its own expiry, because `site_content` has no TTL.
 *    Expired rows are deleted when they are next read, so state does not
 *    accumulate.
 */

const keyPrefix = "support-chat:";
const rowTitle = "Support chat runtime state";

type Envelope = { v: string; exp: number };

export type SupportKvEntry = { key: string; value: string; expiresAt: number };

function rowKey(key: string) {
  return keyPrefix + key;
}

function parseEnvelope(raw: string | null | undefined): Envelope | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Envelope | null;
    if (!parsed || typeof parsed.v !== "string" || typeof parsed.exp !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

/** True when a shared store is actually reachable, not merely configured. */
export async function supportKvReady(): Promise<boolean> {
  try {
    return Boolean(await getDb());
  } catch {
    return false;
  }
}

/** Reads a live entry, including its absolute expiry (needed by the quota). */
export async function supportKvReadEntry(
  key: string,
): Promise<{ value: string; expiresAt: number } | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({ bodyKh: siteContent.bodyKh })
    .from(siteContent)
    .where(eq(siteContent.contentKey, rowKey(key)))
    .limit(1);
  const envelope = parseEnvelope(rows[0]?.bodyKh);
  if (!envelope) return null;
  if (envelope.exp <= Date.now()) {
    void supportKvDelete(key);
    return null;
  }
  return { value: envelope.v, expiresAt: envelope.exp };
}

export async function supportKvRead(key: string): Promise<string | null> {
  const entry = await supportKvReadEntry(key);
  return entry ? entry.value : null;
}

/**
 * Writes with an ABSOLUTE expiry. The daily quota is a rolling 24h window, so
 * bumping the counter must never push its own reset time further away.
 */
export async function supportKvWriteUntil(
  key: string,
  value: string,
  expiresAt: number,
): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const body = JSON.stringify({ v: value, exp: expiresAt } as Envelope);
  await db
    .insert(siteContent)
    .values({
      id: nanoid(),
      contentKey: rowKey(key),
      titleKh: rowTitle,
      bodyKh: body,
      mediaUrl: null,
      isActive: false,
      updatedByUserId: null,
    })
    .onDuplicateKeyUpdate({ set: { bodyKh: body, isActive: false } });
  return true;
}

export async function supportKvWrite(
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  return supportKvWriteUntil(key, value, Date.now() + Math.max(1, ttlSeconds) * 1000);
}

export async function supportKvDelete(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.delete(siteContent).where(eq(siteContent.contentKey, rowKey(key)));
  } catch {
    /* best effort: an orphaned row expires on its own and is swept on read */
  }
}

/** Lists live entries under a sub-prefix, sweeping expired rows as it goes. */
export async function supportKvList(subPrefix: string, limit: number): Promise<SupportKvEntry[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({ contentKey: siteContent.contentKey, bodyKh: siteContent.bodyKh })
    .from(siteContent)
    .where(like(siteContent.contentKey, rowKey(subPrefix) + "%"))
    .limit(Math.max(1, limit));
  const entries: SupportKvEntry[] = [];
  const current = Date.now();
  rows.forEach((row) => {
    const envelope = parseEnvelope(row.bodyKh);
    const key = row.contentKey.slice(keyPrefix.length);
    if (!envelope) return;
    if (envelope.exp <= current) {
      void supportKvDelete(key);
      return;
    }
    entries.push({ key, value: envelope.v, expiresAt: envelope.exp });
  });
  return entries;
}
