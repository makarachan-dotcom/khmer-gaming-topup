import { z } from "zod";
import { getAppwriteProviderAvailability, getAppwriteProviderCatalog, isAppwriteStoreConfigured, type AppwriteProviderCatalog, updateAppwriteProviderAvailability } from "./appwriteStore";

export const providerFieldSchema = z.object({
  key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/),
  label: z.string().trim().min(1).max(120),
  placeholder: z.string().trim().max(160).optional(),
  required: z.boolean(),
  kind: z.enum(["text", "number"]),
});

export const providerGameSchema = z.object({
  id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  logoUrl: z.string().url().refine((url) => url.startsWith("https://"), "Game logo must use HTTPS").optional(),
  region: z.string().trim().min(1).max(80).optional(),
  provider: z.string().trim().min(1).max(120),
  requiredFields: z.array(providerFieldSchema).max(12),
});

export const providerPackageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  amountLabel: z.string().trim().min(1).max(160),
  priceLabel: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(120),
  paymentMethods: z.array(z.enum(["khqr", "bank"])).min(1).max(2),
});

const fzrTopupsSchema = z.object({
  ok: z.literal(true),
  kind: z.literal("topup"),
  items: z.array(z.object({ category_id: z.string().trim().min(1).max(120), name: z.string().trim().min(1).max(160), note: z.string().optional() })).max(500),
  meta: z.object({ next_cursor: z.string().trim().min(1).nullable().optional(), has_more: z.boolean().optional() }).optional(),
});

const fzrOffersSchema = z.object({
  ok: z.literal(true),
  kind: z.literal("topup"),
  category_id: z.string().trim().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  offers: z.array(z.object({ offer_id: z.string().trim().min(1).max(160).nullable(), name: z.string().trim().min(1).max(160), price_usd: z.string().regex(/^\d+(\.\d+)?$/) })).max(250),
  fields: z.array(z.object({ key: z.string().trim().regex(/^[a-z][a-zA-Z0-9_]{0,63}$/), label: z.string().trim().min(1).max(120), type: z.string().trim().max(40).optional(), placeholder: z.string().trim().max(160).optional(), required: z.boolean().optional() })).max(12).default([]),
  imageurl: z.string().url().refine((url) => url.startsWith("https://")).optional(),
});

const smmGlobServiceSchema = z.object({
  service: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(80)),
  name: z.string().trim().min(1).max(500),
  type: z.string().trim().max(80).optional().default("default"),
  category: z.string().trim().max(180).optional().default("Social Media"),
  rate: z.union([z.string(), z.number()]).transform(String).pipe(z.string().regex(/^\d+(\.\d+)?$/)),
  min: z.union([z.string(), z.number()]).transform((value) => Number(value)).pipe(z.number().int().nonnegative().max(10_000_000)),
  max: z.union([z.string(), z.number()]).transform((value) => Number(value)).pipe(z.number().int().nonnegative().max(100_000_000)),
  dripfeed: z.union([z.boolean(), z.number(), z.string()]).optional(),
  refill: z.union([z.boolean(), z.number(), z.string()]).optional(),
  cancel: z.union([z.boolean(), z.number(), z.string()]).optional(),
});

export type ProviderGameResponse =
  | { status: "ready"; games: z.infer<typeof providerGameSchema>[] }
  | { status: "unavailable"; games: [] }
  | { status: "error"; games: [] };

export type ProviderGameDetailsResponse =
  | { status: "ready"; game: z.infer<typeof providerGameSchema>; packages: z.infer<typeof providerPackageSchema>[] }
  | { status: "unavailable"; game: null; packages: [] }
  | { status: "error"; game: null; packages: [] };

export type ProviderPackageRequest = { gameId: string; fields: Record<string, string>; idAccuracyConfirmed?: boolean };
export type ProviderPackageResponse =
  | { status: "ready"; packages: z.infer<typeof providerPackageSchema>[] }
  | { status: "verification_required"; packages: [] }
  | { status: "unavailable"; packages: [] }
  | { status: "error"; packages: [] };

export type ProviderPlayerIdentityResponse =
  | { status: "verified"; playerName: string; playerId: string | null; region: string | null }
  | { status: "invalid"; playerName: null; playerId: null; region: null }
  | { status: "not_supported"; playerName: null; playerId: null; region: null }
  | { status: "unavailable"; playerName: null; playerId: null; region: null }
  | { status: "error"; playerName: null; playerId: null; region: null };

export type SmmProviderCatalogResponse =
  | { status: "ready"; services: Array<{ providerServiceId: string; name: string; category: string; serviceType: string; rateUsdPerThousand: string; min: number; max: number; refill: boolean; cancel: boolean; dripfeed: boolean }> }
  | { status: "unavailable"; services: [] }
  | { status: "error"; services: [] };

export type ProviderAvailabilityCatalog = { games: Array<{ id: string; name: string; isActive: boolean }>; smm: Array<{ id: string; name: string; category: string; isActive: boolean }> };

const socialPlatformOrder = ["facebook", "instagram", "tiktok", "youtube", "telegram"] as const;
type ProviderAvailabilitySnapshot = { hiddenGameIds: string[]; hiddenSmmServiceIds: string[]; activeGameIds?: string[] };
let providerAvailabilitySnapshot: ProviderAvailabilitySnapshot | null = null;
let providerAvailabilityRetryAt = 0;

export function isThailandProviderProduct(text: string) {
  return /(?:\bthailand\b|\bthai\b|ไทย|ประเทศไทย|🇹🇭|(?:^|[_\s(])th(?:$|[_\s)]))/i.test(text);
}

export function balanceSocialProviderServices<T extends { name: string; category: string }>(services: T[], limit = 120) {
  const buckets = new Map<string, T[]>(socialPlatformOrder.map((platform) => [platform, []]));
  const fallback: T[] = [];
  for (const service of services) {
    const text = `${service.category} ${service.name}`.toLowerCase();
    const platform = socialPlatformOrder.find((candidate) => text.includes(candidate));
    if (platform) buckets.get(platform)?.push(service);
    else fallback.push(service);
  }
  const balanced: T[] = [];
  for (let index = 0; balanced.length < limit; index += 1) {
    let added = false;
    for (const platform of socialPlatformOrder) {
      const service = buckets.get(platform)?.[index];
      if (service && balanced.length < limit) { balanced.push(service); added = true; }
    }
    if (!added) break;
  }
  return [...balanced, ...fallback].slice(0, limit);
}

export type FzrProviderSyncSnapshot =
  | { status: "ready"; games: Array<{ providerGameId: string; name: string; logoUrl?: string; requiredFields: z.infer<typeof providerFieldSchema>[]; offers: Array<{ providerOfferId: string; name: string; priceUsd: string }> }> }
  | { status: "unavailable"; games: [] }
  | { status: "error"; games: [] };

export function getProviderCatalogStatus() {
  const endpointConfigured = Boolean(process.env.FZR_CARDS_API_BASE_URL);
  const credentialConfigured = Boolean(process.env.FZR_CARDS_API_KEY);
  const smmEndpointConfigured = Boolean(process.env.SMMGLOB_API_URL);
  const smmCredentialConfigured = Boolean(process.env.SMMGLOB_API_KEY);
  return { configured: endpointConfigured && credentialConfigured, endpointConfigured, credentialConfigured, smmConfigured: smmEndpointConfigured && smmCredentialConfigured, smmEndpointConfigured, smmCredentialConfigured };
}

class FzrRequestError extends Error {
  constructor(readonly status: number) { super(`FZR Cards request failed (${status})`); }
}

async function fzrRequest(path: string, init: RequestInit = {}) {
  const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
  const apiKey = process.env.FZR_CARDS_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { "X-API-Key": apiKey, ...init.headers }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new FzrRequestError(response.status);
  return response.json();
}

async function providerAvailability() {
  if (!isAppwriteStoreConfigured()) return { hiddenGameIds: [] as string[], hiddenSmmServiceIds: [] as string[], activeGameIds: undefined as string[] | undefined };
  const now = Date.now();
  if (providerAvailabilitySnapshot && now < providerAvailabilityRetryAt) return providerAvailabilitySnapshot;
  try {
    const availability = await getAppwriteProviderAvailability();
    providerAvailabilitySnapshot = availability;
    providerAvailabilityRetryAt = now + 60_000;
    return availability;
  } catch {
    // Keep the last known restrictions where possible and back off retrying when
    // Appwrite has exhausted its read allowance. This keeps provider catalogs browsable.
    providerAvailabilitySnapshot ??= { hiddenGameIds: [], hiddenSmmServiceIds: [], activeGameIds: undefined };
    providerAvailabilityRetryAt = now + 5 * 60_000;
    return providerAvailabilitySnapshot;
  }
}

async function smmGlobRequest(action: string, parameters: Record<string, string> = {}) {
  const configuredUrl = process.env.SMMGLOB_API_URL?.trim();
  const baseUrl = configuredUrl ? `${configuredUrl.replace(/\/+$/, "").replace(/\/api\/v2$/, "")}/api/v2` : null;
  const apiKey = process.env.SMMGLOB_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const body = new URLSearchParams({ key: apiKey, action, ...parameters });
  const response = await fetch(baseUrl, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`SMMGlob catalog request failed (${response.status})`);
  return response.json();
}

function providerFields(fields: z.infer<typeof fzrOffersSchema>["fields"]) {
  return fields.map((field) => ({ key: field.key, label: field.label, placeholder: field.placeholder, required: field.required ?? true, kind: /number|numeric|digit/i.test(field.type ?? "") ? "number" as const : "text" as const }));
}

function providerPackages(categoryId: string, offers: z.infer<typeof fzrOffersSchema>["offers"]) {
  return offers.filter((offer) => Boolean(offer.offer_id)).map((offer) => ({ id: `${categoryId}:${offer.offer_id}`, label: offer.name, amountLabel: offer.name, priceLabel: `$${Number(offer.price_usd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] }));
}

function providerGameRegion(name: string, note?: string) {
  const source = `${name}\n${note ?? ""}`;
  const notedRegion = source.match(/(?:^|\n)\s*region\s*:\s*([^\n]+)/i)?.[1]?.trim();
  if (notedRegion) return notedRegion;
  const bracketedRegion = name.match(/\(([^)]+)\)\s*$/)?.[1]?.trim();
  return bracketedRegion || "Global";
}

type FzrTopupItem = z.infer<typeof fzrTopupsSchema>["items"][number];
type FzrTopupCatalog = { status: "ready"; items: FzrTopupItem[]; legacyPublicIds: string[] } | { status: "unavailable" | "error"; items: []; legacyPublicIds: [] };

async function fetchFzrTopupCatalog(): Promise<FzrTopupCatalog> {
  try {
    const firstResponse = await fzrRequest("/api/v2/topups");
    if (!firstResponse) return { status: "unavailable", items: [], legacyPublicIds: [] };
    const firstPayload = fzrTopupsSchema.safeParse(firstResponse);
    if (!firstPayload.success) return { status: "error", items: [], legacyPublicIds: [] };

    const legacyPublicIds = firstPayload.data.items.map((item) => item.category_id);
    const items = [...firstPayload.data.items];
    const knownIds = new Set(legacyPublicIds);
    const seenCursors = new Set<string>();
    let cursor = firstPayload.data.meta?.next_cursor ?? null;

    for (let page = 0; cursor && page < 20 && !seenCursors.has(cursor); page += 1) {
      seenCursors.add(cursor);
      const query = new URLSearchParams({ limit: "100", cursor });
      const response = await fzrRequest(`/api/v2/topups?${query.toString()}`);
      if (!response) return { status: "unavailable", items: [], legacyPublicIds: [] };
      const payload = fzrTopupsSchema.safeParse(response);
      if (!payload.success) return { status: "error", items: [], legacyPublicIds: [] };
      for (const item of payload.data.items) {
        if (!knownIds.has(item.category_id)) {
          knownIds.add(item.category_id);
          items.push(item);
        }
      }
      cursor = payload.data.meta?.next_cursor ?? null;
    }

    return { status: "ready", items, legacyPublicIds };
  } catch { return { status: "error", items: [], legacyPublicIds: [] }; }
}

/** Initial storefront baseline from the owner-approved public catalog before the Admin allowlist was persisted. */
export const initialApprovedPublicGameIds = [
  "8_ball_pool",
  "blood_strike",
  "eafc_mobile_kh",
  "frag_pro_shooter",
  "free_fire_my_sg",
  "honor_of_kings",
  "magic_chess_gogo_global",
  "mobile_legends_global",
  "mobile_legends_promo",
  "mobile_legends_special",
  "pubg_mobile_auto",
  "pubg_mobile_fast",
] as const;

export const mobileLegendsFamilyGameId = "mobile_legends";
const mobileLegendsFamilyVariantIds = ["mobile_legends_global", "mobile_legends_promo", "mobile_legends_special"] as const;

function isMobileLegendsFamilyGame(gameId: string) {
  return gameId.trim().toLowerCase() === mobileLegendsFamilyGameId;
}

function publicProviderGameIds(availability: Awaited<ReturnType<typeof providerAvailability>>) {
  const approvedIds = availability.activeGameIds ?? initialApprovedPublicGameIds;
  return new Set(approvedIds.filter((id) => !availability.hiddenGameIds.includes(id)));
}

function asProviderGames(items: FzrTopupItem[]) {
  return items.filter((item) => !isThailandProviderProduct(`${item.category_id} ${item.name} ${item.note ?? ""}`)).map((item) => ({ id: item.category_id, name: item.name, region: providerGameRegion(item.name, item.note), provider: "FZR Cards", requiredFields: [] }));
}

/** During a transient FZR outage, preserve only the owner-approved public IDs from the persisted catalog. */
export function cachedPublicProviderGames(catalog: AppwriteProviderCatalog, availability: Awaited<ReturnType<typeof providerAvailability>>) {
  const activeIds = publicProviderGameIds(availability);
  const hiddenIds = new Set(availability.hiddenGameIds);
  return catalog.games.flatMap((game) => {
    const providerId = game.providerSourceId?.trim();
    const name = game.titleEn?.trim() || game.titleKh?.trim();
    if (!providerId || !name || !activeIds.has(providerId) || hiddenIds.has(providerId) || isThailandProviderProduct(`${providerId} ${name}`)) return [];
    return [{ id: providerId, name, region: providerGameRegion(name), provider: "FZR Cards" as const, requiredFields: [] }];
  });
}

async function cachedPublicProviderGamesDuringOutage(availability: Awaited<ReturnType<typeof providerAvailability>>) {
  if (!publicProviderGameIds(availability).size) return [];
  try { return cachedPublicProviderGames(await getAppwriteProviderCatalog(), availability); } catch { return []; }
}

export async function fetchProviderGames(options: { includeInactive?: boolean } = {}): Promise<ProviderGameResponse> {
  if (!process.env.FZR_CARDS_API_BASE_URL || !process.env.FZR_CARDS_API_KEY) {
    return { status: "unavailable", games: [] };
  }
  const [catalog, availability] = await Promise.all([fetchFzrTopupCatalog(), providerAvailability()]);
  if (catalog.status !== "ready") {
    if (!options.includeInactive) {
      const cachedGames = await cachedPublicProviderGamesDuringOutage(availability);
      if (cachedGames.length) return { status: "ready", games: cachedGames };
    }
    return { status: catalog.status, games: [] };
  }
  const games = asProviderGames(catalog.items);
  if (options.includeInactive) return { status: "ready", games };
  const activeIds = publicProviderGameIds(availability);
  return { status: "ready", games: games.filter((game) => activeIds.has(game.id) && !availability.hiddenGameIds.includes(game.id)) };
}

export async function fetchProviderGameDetails(gameId: string, options: { includeInactive?: boolean } = {}): Promise<ProviderGameDetailsResponse> {
  try {
    const availableGames = await fetchProviderGames({ includeInactive: options.includeInactive });
    if (availableGames.status !== "ready") return { status: availableGames.status === "error" ? "error" : "unavailable", game: null, packages: [] };
    if (isMobileLegendsFamilyGame(gameId)) {
      const activeVariants = mobileLegendsFamilyVariantIds.filter((variantId) => availableGames.games.some((game) => game.id === variantId));
      if (!activeVariants.length) return { status: "unavailable", game: null, packages: [] };
      const variantDetails = await Promise.all(activeVariants.map((variantId) => fetchProviderGameDetails(variantId, options)));
      const readyVariants = variantDetails.filter((details): details is Extract<ProviderGameDetailsResponse, { status: "ready" }> => details.status === "ready");
      if (!readyVariants.length) return { status: variantDetails.some((details) => details.status === "error") ? "error" : "unavailable", game: null, packages: [] };
      const primary = readyVariants.find((details) => details.game.id === "mobile_legends_global") ?? readyVariants[0]!;
      return {
        status: "ready",
        game: { ...primary.game, id: mobileLegendsFamilyGameId, name: "Mobile Legends" },
        packages: readyVariants.flatMap((details) => details.packages),
      };
    }
    if (!availableGames.games.some((game) => game.id === gameId)) return { status: "unavailable", game: null, packages: [] };
    const response = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(gameId)}&include_ui=1`);
    if (!response) return { status: "unavailable", game: null, packages: [] };
    const payload = fzrOffersSchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== gameId) return { status: "error", game: null, packages: [] };
    if (isThailandProviderProduct(`${gameId} ${payload.data.name}`)) return { status: "unavailable", game: null, packages: [] };
    const fields = providerFields(payload.data.fields);
    return { status: "ready", game: { id: gameId, name: payload.data.name, region: providerGameRegion(payload.data.name), logoUrl: payload.data.imageurl, provider: "FZR Cards", requiredFields: fields }, packages: providerPackages(gameId, payload.data.offers) };
  } catch { return { status: "error", game: null, packages: [] }; }
}

/** Admin-only callers use this to inspect authorized package UI without supplying a customer identity. */
export async function fetchProviderPreviewPackages(gameId: string): Promise<ProviderPackageResponse> {
  const details = await fetchProviderGameDetails(gameId, { includeInactive: true });
  if (details.status !== "ready") return { status: details.status, packages: [] };
  return { status: "ready", packages: details.packages };
}

function hasProviderIdentityField(fields: Record<string, string>) {
  return Object.keys(fields).some((key) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    return /^(?:player|user|account|game|zone|server|uid)(?:id|number)?$/.test(normalized) || normalized === "id";
  });
}

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  if (!hasProviderIdentityField(input.fields)) {
    const details = await fetchProviderGameDetails(input.gameId);
    return details.status === "ready" ? { status: "ready", packages: details.packages } : { status: details.status, packages: [] };
  }
  const identity = await validateProviderPlayerIdentity(input);
  if (identity.status === "unavailable") return { status: "unavailable", packages: [] };
  if (identity.status === "error") return { status: "error", packages: [] };
  if (identity.status !== "verified" && !(identity.status === "not_supported" && input.idAccuracyConfirmed)) return { status: "verification_required", packages: [] };
  const details = await fetchProviderGameDetails(input.gameId);
  if (details.status !== "ready") return { status: details.status, packages: [] };
  return { status: "ready", packages: details.packages };
}

const fzrPlayerIdentitySchema = z.object({
  ok: z.literal(true),
  category_id: z.string().trim().min(1).max(120),
  valid: z.boolean(),
  player_name: z.string().trim().min(1).max(180).nullable(),
  player_id: z.string().trim().min(1).max(180).nullable().optional(),
  region: z.string().trim().min(1).max(120).nullable().optional(),
});

const externalPlayerNameSchema = z.object({ success: z.literal(true), data: z.object({ username: z.string().trim().min(1).max(180) }) });
const isanPlayerNameSchema = z.object({ success: z.literal(true), name: z.string().trim().min(1).max(180), country: z.string().trim().min(1).max(120).optional() });
const eightBallPoolPlayerNameSchema = z.object({ status: z.literal(true), nickname: z.string().trim().min(1).max(180) });
const externalFailureSchema = z.object({ error: z.literal(true), msg: z.string().trim().max(300).optional() });
const vpsWorkerVerifiedIdentitySchema = z.object({
  ok: z.literal(true),
  username: z.string().trim().min(1).max(180),
  userId: z.string().trim().min(1).max(180).optional(),
  zoneId: z.string().trim().min(1).max(120).nullable().optional(),
  game: z.string().trim().min(1).max(120).optional(),
  status: z.literal("valid"),
});
const vpsWorkerInvalidIdentitySchema = z.object({ ok: z.literal(false), status: z.literal("invalid") });

function mobileLegendsIdentityFields(fields: Record<string, string>) {
  const playerId = fields.player_id ?? fields.user_id ?? fields.id ?? "";
  const serverId = fields.server_id ?? fields.zone_id ?? fields.server ?? "";
  if (!/^\d{4,20}$/.test(playerId.trim()) || !/^\d{1,12}$/.test(serverId.trim())) return null;
  return { playerId: playerId.trim(), serverId: serverId.trim() };
}

function isMobileLegendsGame(gameId: string) {
  return /^mobile_legends(?:_|$)/i.test(gameId);
}

function isHonorOfKingsGame(gameId: string) {
  return /^honor_of_kings(?:_|$)/i.test(gameId);
}

function usesVpsWorkerIdentityCheck(gameId: string) {
  return isMobileLegendsGame(gameId) || isHonorOfKingsGame(gameId);
}

type OwnerApprovedFreeIdentityRequest = { kind: "isan" | "eight_ball_pool"; url: string; playerId: string } | { kind: "invalid" };

function ownerApprovedFreeIdentityRequest(input: ProviderPackageRequest): OwnerApprovedFreeIdentityRequest | null {
  if (isMobileLegendsGame(input.gameId) || isHonorOfKingsGame(input.gameId)) return null;
  const gameId = input.gameId.trim().toLowerCase();
  const game = /^free_fire(?:_|$)/.test(gameId) ? "ff" as const
    : /^magic_chess(?:_|$)/.test(gameId) ? "mcgg" as const
      : /^call_of_duty(?:_|$)/.test(gameId) ? "cod" as const
        : /^arena_of_valor(?:_|$)/.test(gameId) ? "aov" as const
          : /^8_ball_pool(?:_|$)/.test(gameId) ? "eight_ball_pool" as const
            : null;
  if (!game) return null;
  const playerId = (input.fields.player_id ?? input.fields.user_id ?? input.fields.account_id ?? input.fields.id ?? "").trim();
  const serverId = (input.fields.server_id ?? input.fields.zone_id ?? input.fields.server ?? "").trim();
  if (!/^\d{4,20}$/.test(playerId)) return { kind: "invalid" };
  const isanUrl = (game: "ff" | "mcgg" | "cod" | "aov", requiresServer = false) => {
    if (requiresServer && !/^\d{1,12}$/.test(serverId)) return { kind: "invalid" } as const;
    const query = new URLSearchParams({ id: playerId });
    if (requiresServer) query.set("server", serverId);
    return { kind: "isan" as const, url: `https://api.isan.eu.org/nickname/${game}?${query.toString()}`, playerId };
  };
  if (game === "ff") return isanUrl("ff");
  if (game === "mcgg") return isanUrl("mcgg", true);
  if (game === "cod") return isanUrl("cod");
  if (game === "aov") return isanUrl("aov");
  if (game === "eight_ball_pool") {
    const query = new URLSearchParams({ type_name: "eight_ball_pool", userId: playerId, zoneId: "" });
    return { kind: "eight_ball_pool", url: `https://api-cek-id-game-ten.vercel.app/api/check-id-game?${query.toString()}`, playerId };
  }
  return null;
}

async function validateWithOwnerApprovedFreeApi(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse | null> {
  const request = ownerApprovedFreeIdentityRequest(input);
  if (!request) return null;
  if (request.kind === "invalid") return emptyIdentity("invalid");
  try {
    const response = await fetch(request.url, { signal: AbortSignal.timeout(8_000) });
    const payload = await response.json().catch(() => null);
    if (request.kind === "isan") {
      const success = isanPlayerNameSchema.safeParse(payload);
      if (response.ok && success.success) return { status: "verified", playerName: success.data.name, playerId: request.playerId, region: success.data.country ?? "Global" };
      if (response.ok && payload && typeof payload === "object" && "success" in payload && (payload as { success?: unknown }).success === false) return emptyIdentity("invalid");
    } else {
      const success = eightBallPoolPlayerNameSchema.safeParse(payload);
      if (response.ok && success.success) return { status: "verified", playerName: success.data.nickname, playerId: request.playerId, region: "Global" };
      if (response.ok && payload && typeof payload === "object" && "status" in payload && (payload as { status?: unknown }).status === false) return emptyIdentity("invalid");
    }
  } catch { /* A public free API is optional; the existing ID-accuracy confirmation handles unsupported checks. */ }
  return emptyIdentity("not_supported");
}

function vpsWorkerIdentityInput(input: ProviderPackageRequest): { game: string; playerId: string; serverId: string } | null {
  const playerId = (input.fields.player_id ?? input.fields.user_id ?? input.fields.id ?? "").trim();
  const serverId = (input.fields.server_id ?? input.fields.zone_id ?? input.fields.server ?? "").trim();
  if (!/^\d{4,20}$/.test(playerId)) return null;
  if (isMobileLegendsGame(input.gameId)) {
    if (!/^\d{1,12}$/.test(serverId)) return null;
    return { game: "mobilelegend", playerId, serverId };
  }
  if (isHonorOfKingsGame(input.gameId)) return { game: "honor-of-kings", playerId, serverId: /^\d{1,12}$/.test(serverId) ? serverId : "" };
  return null;
}

async function validateWithVpsWorker(input: { game: string; playerId: string; serverId: string }): Promise<ProviderPlayerIdentityResponse | null> {
  const endpoint = process.env.VPS_WORKER_URL?.trim();
  const secret = process.env.WORKER_SECRET;
  if (!endpoint || !secret) {
    console.warn("[VPS Worker] Check-ID configuration is unavailable");
    return null;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ game: input.game, id: input.playerId, serverId: input.serverId }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json().catch(() => null);
    const verified = vpsWorkerVerifiedIdentitySchema.safeParse(payload);
    if (response.ok && verified.success) {
      return { status: "verified", playerName: verified.data.username, playerId: verified.data.userId ?? input.playerId, region: "Global" };
    }
    const invalid = vpsWorkerInvalidIdentitySchema.safeParse(payload);
    if (response.ok && invalid.success) return emptyIdentity("invalid");
    console.warn(`[VPS Worker] Check-ID response was not usable (HTTP ${response.status})`);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.warn(`[VPS Worker] Check-ID request failed (${errorName})`);
  }
  return null;
}

function emptyIdentity(status: Extract<ProviderPlayerIdentityResponse, { status: "invalid" | "not_supported" | "unavailable" | "error" }> ["status"]): ProviderPlayerIdentityResponse {
  return { status, playerName: null, playerId: null, region: null };
}

const MOBILE_LEGENDS_FALLBACK_DEADLINE_MS = 18_000;
const MOBILE_LEGENDS_FALLBACK_REQUEST_MS = 7_000;

function mobileLegendsFallbackSignal(deadline: number) {
  const remaining = deadline - Date.now();
  return remaining > 0 ? AbortSignal.timeout(Math.min(MOBILE_LEGENDS_FALLBACK_REQUEST_MS, remaining)) : null;
}

async function validateMobileLegendsWithFallback(input: ProviderPackageRequest, options: { workerAlreadyTried?: boolean } = {}): Promise<ProviderPlayerIdentityResponse | null> {
  const ids = mobileLegendsIdentityFields(input.fields);
  if (!ids) return emptyIdentity("invalid");
  const deadline = Date.now() + MOBILE_LEGENDS_FALLBACK_DEADLINE_MS;
  let invalid: ProviderPlayerIdentityResponse | null = null;
  const recordResult = (result: ProviderPlayerIdentityResponse | null) => {
    if (result?.status === "verified") return result;
    if (result?.status === "invalid") invalid = result;
    return null;
  };

  if (!options.workerAlreadyTried) {
    const workerInput = vpsWorkerIdentityInput(input);
    const workerResult = workerInput ? await validateWithVpsWorker(workerInput) : null;
    if (workerResult) return workerResult;
  }

  const rapidApiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
  const neferbyteKey = process.env.NEFERBYTE_API_KEY;
  if (rapidApiKey && mobileLegendsFallbackSignal(deadline)) {
    try {
      const response = await fetch(`https://id-game-checker.p.rapidapi.com/mobile-legends/${ids.playerId}/${ids.serverId}`, { headers: { "x-rapidapi-host": "id-game-checker.p.rapidapi.com", "x-rapidapi-key": rapidApiKey }, signal: mobileLegendsFallbackSignal(deadline)! });
      const payload = await response.json();
      const success = externalPlayerNameSchema.safeParse(payload);
      const verified = success.success ? recordResult({ status: "verified", playerName: success.data.data.username, playerId: ids.playerId, region: "Global" }) : null;
      if (verified) return verified;
      const failure = externalFailureSchema.safeParse(payload);
      if (response.ok && failure.success && /can.t find|not found|invalid/i.test(failure.data.msg ?? "")) invalid = emptyIdentity("invalid");
    } catch { /* Continue once to the next approved provider within the shared deadline. */ }
  }

  if (neferbyteKey && mobileLegendsFallbackSignal(deadline)) {
    try {
      const response = await fetch(`https://api.neferbyte.com/game-id-checker/mobile-legends/${ids.playerId}/${ids.serverId}`, { headers: { "x-api-key": neferbyteKey }, signal: mobileLegendsFallbackSignal(deadline)! });
      const payload = await response.json();
      const success = externalPlayerNameSchema.safeParse(payload);
      const verified = success.success ? recordResult({ status: "verified", playerName: success.data.data.username, playerId: ids.playerId, region: "Global" }) : null;
      if (verified) return verified;
      const failure = externalFailureSchema.safeParse(payload);
      if (response.ok && failure.success && /can.t find|not found|invalid/i.test(failure.data.msg ?? "")) invalid = emptyIdentity("invalid");
    } catch { /* Continue once to the final owner-approved fallback within the shared deadline. */ }
  }

  const isanSignal = mobileLegendsFallbackSignal(deadline);
  if (isanSignal) {
    try {
      const response = await fetch(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(ids.playerId)}&server=${encodeURIComponent(ids.serverId)}`, { signal: isanSignal });
      const payload = await response.json();
      const success = isanPlayerNameSchema.safeParse(payload);
      const verified = success.success ? recordResult({ status: "verified", playerName: success.data.name, playerId: ids.playerId, region: success.data.country ?? "Global" }) : null;
      if (verified) return verified;
      if (response.ok && payload && typeof payload === "object" && "success" in payload && (payload as { success?: unknown }).success === false) invalid = emptyIdentity("invalid");
    } catch { /* The finite authorized fallback chain is unavailable. */ }
  }

  return invalid ?? emptyIdentity("unavailable");
}

export async function validateProviderPlayerIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  const workerInput = usesVpsWorkerIdentityCheck(input.gameId) ? vpsWorkerIdentityInput(input) : null;
  const workerResult = workerInput ? await validateWithVpsWorker(workerInput) : null;
  if (workerResult) return workerResult;

  try {
    const providerGameId = isMobileLegendsFamilyGame(input.gameId) ? "mobile_legends_global" : input.gameId;
    const response = await fzrRequest("/api/v2/topups/validate-id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category_id: providerGameId, fields: input.fields }) });
    if (!response) {
      if (isMobileLegendsGame(input.gameId)) return await validateMobileLegendsWithFallback(input, { workerAlreadyTried: Boolean(workerInput) }) ?? emptyIdentity("unavailable");
      const freeApiResult = await validateWithOwnerApprovedFreeApi(input);
      if (freeApiResult) return freeApiResult;
      if (isHonorOfKingsGame(input.gameId)) return emptyIdentity("unavailable");
      return emptyIdentity("unavailable");
    }
    const payload = fzrPlayerIdentitySchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== providerGameId) {
      const freeApiResult = await validateWithOwnerApprovedFreeApi(input);
      return freeApiResult ?? emptyIdentity("error");
    }
    if (!payload.data.valid || !payload.data.player_name) return { status: "invalid", playerName: null, playerId: null, region: null };
    return { status: "verified", playerName: payload.data.player_name, playerId: payload.data.player_id ?? null, region: payload.data.region ?? null };
  } catch (error) {
    if (isMobileLegendsGame(input.gameId)) return await validateMobileLegendsWithFallback(input, { workerAlreadyTried: Boolean(workerInput) }) ?? emptyIdentity("unavailable");
    const freeApiResult = await validateWithOwnerApprovedFreeApi(input);
    if (freeApiResult) return freeApiResult;
    if (isHonorOfKingsGame(input.gameId)) return emptyIdentity("unavailable");
    if (error instanceof FzrRequestError && [400, 404].includes(error.status)) return emptyIdentity("not_supported");
    if (error instanceof FzrRequestError && error.status === 422) return emptyIdentity("invalid");
    if (error instanceof FzrRequestError && [502, 503].includes(error.status)) return emptyIdentity("unavailable");
    return emptyIdentity("error");
  }
}

export async function fetchSmmProviderServices(options: { includeHidden?: boolean } = {}): Promise<SmmProviderCatalogResponse> {
  try {
    const response = await smmGlobRequest("services");
    if (!response) return { status: "unavailable", services: [] };
    const availability = options.includeHidden ? null : await providerAvailability();
    const payload = z.array(z.unknown()).max(20_000).safeParse(response);
    if (!payload.success) return { status: "error", services: [] };
    const hidden = new Set(availability?.hiddenSmmServiceIds ?? []);
    const services = balanceSocialProviderServices(payload.data.map((item) => smmGlobServiceSchema.safeParse(item)).filter((item): item is z.ZodSafeParseSuccess<z.infer<typeof smmGlobServiceSchema>> => item.success).map((item) => item.data).filter((service) => /(facebook|instagram|tiktok|youtube|telegram)/i.test(`${service.category} ${service.name}`) && !isThailandProviderProduct(`${service.category} ${service.name}`) && !hidden.has(service.service)));
    return { status: "ready", services: services.map((service) => ({ providerServiceId: service.service, name: service.name, category: service.category, serviceType: service.type, rateUsdPerThousand: Number(service.rate).toFixed(4), min: service.min, max: service.max, refill: Boolean(service.refill), cancel: Boolean(service.cancel), dripfeed: Boolean(service.dripfeed) })) };
  } catch { return { status: "error", services: [] }; }
}

export async function getProviderAvailabilityCatalog(): Promise<ProviderAvailabilityCatalog> {
  const [catalog, smmResponse, availability] = await Promise.all([fetchFzrTopupCatalog(), fetchSmmProviderServices({ includeHidden: true }), providerAvailability()]);
  const activeGames = catalog.status === "ready" ? publicProviderGameIds(availability) : new Set<string>();
  const hiddenSmm = new Set(availability.hiddenSmmServiceIds);
  return {
    games: catalog.status === "ready" ? asProviderGames(catalog.items).map((game) => ({ id: game.id, name: game.name, isActive: activeGames.has(game.id) && !availability.hiddenGameIds.includes(game.id) })) : [],
    smm: smmResponse.status === "ready" ? smmResponse.services.map((service) => ({ id: service.providerServiceId, name: service.name, category: service.category, isActive: !hiddenSmm.has(service.providerServiceId) })) : [],
  };
}

export async function setProviderAvailability(input: { kind: "game" | "smm"; providerId: string; isActive: boolean }) {
  if (!isAppwriteStoreConfigured()) throw new Error("Provider availability control is not configured");
  if (input.kind !== "game") return updateAppwriteProviderAvailability(input);
  const [catalog, availability] = await Promise.all([fetchFzrTopupCatalog(), providerAvailability()]);
  if (catalog.status !== "ready") throw new Error("FZR Cards catalog is currently unavailable");
  const validGameIds = new Set(asProviderGames(catalog.items).map((game) => game.id));
  if (!validGameIds.has(input.providerId)) throw new Error("Selected game is not available from FZR Cards");
  const legacyActiveGameIds = availability.activeGameIds ?? initialApprovedPublicGameIds.filter((id) => !availability.hiddenGameIds.includes(id));
  return updateAppwriteProviderAvailability({ ...input, legacyActiveGameIds });
}

const smmGlobOrderSchema = z.object({ order: z.union([z.string(), z.number()]).transform(String).pipe(z.string().trim().min(1).max(120)) });

export async function submitSmmProviderOrder(input: { providerServiceId: string; target: string; quantity: number }): Promise<{ status: "submitted"; providerOrderId: string } | { status: "unavailable" } | { status: "error" }> {
  try {
    if (!/^\d{1,80}$/.test(input.providerServiceId) || !input.target.trim() || !Number.isInteger(input.quantity) || input.quantity < 1) return { status: "error" };
    const response = await smmGlobRequest("add", { service: input.providerServiceId, link: input.target.trim(), quantity: String(input.quantity) });
    if (!response) return { status: "unavailable" };
    const payload = smmGlobOrderSchema.safeParse(response);
    if (!payload.success) return { status: "error" };
    return { status: "submitted", providerOrderId: payload.data.order };
  } catch { return { status: "error" }; }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const output: R[] = [];
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

export async function fetchFzrProviderSyncSnapshot(): Promise<FzrProviderSyncSnapshot> {
  try {
    const response = await fzrRequest("/api/v2/topups");
    if (!response) return { status: "unavailable", games: [] };
    const catalog = fzrTopupsSchema.safeParse(response);
    if (!catalog.success) return { status: "error", games: [] };
    const details = await mapWithConcurrency(catalog.data.items.filter((item) => !isThailandProviderProduct(`${item.category_id} ${item.name} ${item.note ?? ""}`)), 6, async (item) => {
      const offerResponse = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(item.category_id)}&include_ui=1`);
      const offers = fzrOffersSchema.safeParse(offerResponse);
      if (!offers.success || offers.data.category_id !== item.category_id) return null;
      return { providerGameId: item.category_id, name: offers.data.name, logoUrl: offers.data.imageurl, requiredFields: providerFields(offers.data.fields), offers: offers.data.offers.filter((offer) => Boolean(offer.offer_id)).map((offer) => ({ providerOfferId: offer.offer_id!, name: offer.name, priceUsd: Number(offer.price_usd).toFixed(2) })) };
    });
    return { status: "ready", games: details.filter((game): game is NonNullable<typeof game> => game !== null) };
  } catch { return { status: "error", games: [] }; }
}
