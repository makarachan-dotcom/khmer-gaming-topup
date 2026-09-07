import { eq, like } from "drizzle-orm";
import { nanoid } from "nanoid";
import { siteContent } from "../drizzle/schema";
import { getDb } from "./db";

export const PARTNER_OVERRIDE_PREFIX = "psvc:";

export type PartnerServiceOverride = {
  priceUsd?: string;
  nameEn?: string;
  nameKh?: string;
  descriptionEn?: string;
  descriptionKh?: string;
  instructionsEn?: string;
  instructionsKh?: string;
  hidden?: boolean;
};

const MONEY = /^\d{1,6}(?:\.\d{1,2})?$/;
let cache: { expires: number; value: Map<string, PartnerServiceOverride> } | null = null;

export function partnerOverrideKey(slug: string) {
  return `${PARTNER_OVERRIDE_PREFIX}${slug.slice(0, 90)}`;
}

function clip(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parsePartnerOverride(raw: unknown): PartnerServiceOverride | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const priceUsd = clip(row.priceUsd, 12);
  const parsed: PartnerServiceOverride = {
    priceUsd: MONEY.test(priceUsd) && Number(priceUsd) >= 0.01 && Number(priceUsd) <= 100000 ? priceUsd : undefined,
    nameEn: clip(row.nameEn, 180) || undefined,
    nameKh: clip(row.nameKh, 180) || undefined,
    descriptionEn: clip(row.descriptionEn, 800) || undefined,
    descriptionKh: clip(row.descriptionKh, 800) || undefined,
    instructionsEn: clip(row.instructionsEn, 800) || undefined,
    instructionsKh: clip(row.instructionsKh, 800) || undefined,
    hidden: row.hidden === true,
  };
  return Object.values(parsed).some((value) => value !== undefined && value !== false) || parsed.hidden ? parsed : {};
}

export function resetPartnerOverrideCache() {
  cache = null;
}

export async function listPartnerOverrides() {
  if (cache && cache.expires > Date.now()) return cache.value;
  const db = await getDb();
  const map = new Map<string, PartnerServiceOverride>();
  if (!db) return map;
  const rows = await db.select({ contentKey: siteContent.contentKey, bodyKh: siteContent.bodyKh }).from(siteContent).where(like(siteContent.contentKey, `${PARTNER_OVERRIDE_PREFIX}%`));
  for (const row of rows) {
    const slug = row.contentKey.slice(PARTNER_OVERRIDE_PREFIX.length);
    if (!slug) continue;
    try {
      const parsed = parsePartnerOverride(JSON.parse(row.bodyKh ?? "{}"));
      if (parsed) map.set(slug, parsed);
    } catch {
      /* skip a broken row; the rest of the catalog still loads */
    }
  }
  cache = { expires: Date.now() + 15_000, value: map };
  return map;
}

export async function getPartnerOverride(slug: string) {
  return (await listPartnerOverrides()).get(slug) ?? null;
}

export async function savePartnerOverride(input: { slug: string; override: PartnerServiceOverride; updatedByUserId: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const slug = input.slug.trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,89}$/.test(slug)) throw new Error("សេវានេះមិនត្រឹមត្រូវ។");
  const parsed = parsePartnerOverride(input.override) ?? {};
  const key = partnerOverrideKey(slug);
  const bodyKh = JSON.stringify(parsed);
  const existing = await db.select({ id: siteContent.id }).from(siteContent).where(eq(siteContent.contentKey, key)).limit(1);
  const values = { titleKh: slug, bodyKh, mediaUrl: null as string | null, isActive: false, updatedByUserId: input.updatedByUserId };
  if (existing[0]) await db.update(siteContent).set(values).where(eq(siteContent.id, existing[0].id));
  else await db.insert(siteContent).values({ id: nanoid(), contentKey: key, ...values });
  resetPartnerOverrideCache();
  return { success: true as const, slug, override: parsed };
}
