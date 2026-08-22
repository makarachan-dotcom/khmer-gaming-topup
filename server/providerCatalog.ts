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

export type ProviderPackageRequest = { gameId: string; fields: Record<string, string> };
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
  try { return await getAppwriteProviderAvailability(); } catch { return { hiddenGameIds: [] as string[], hiddenSmmServiceIds: [] as string[], activeGameIds: undefined as string[] | undefined }; }
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

function publicProviderGameIds(availability: Awaited<ReturnType<typeof providerAvailability>>, legacyPublicIds: string[]) {
  return new Set(availability.activeGameIds ?? legacyPublicIds.filter((id) => !availability.hiddenGameIds.includes(id)));
}

function asProviderGames(items: FzrTopupItem[]) {
  return items.filter((item) => !isThailandProviderProduct(`${item.category_id} ${item.name} ${item.note ?? ""}`)).map((item) => ({ id: item.category_id, name: item.name, region: providerGameRegion(item.name, item.note), provider: "FZR Cards", requiredFields: [] }));
}

/** During a transient FZR outage, preserve only the owner-approved public IDs from the persisted catalog. */
export function cachedPublicProviderGames(catalog: AppwriteProviderCatalog, availability: Awaited<ReturnType<typeof providerAvailability>>) {
  if (!availability.activeGameIds) return [];
  const activeIds = new Set(availability.activeGameIds);
  const hiddenIds = new Set(availability.hiddenGameIds);
  return catalog.games.flatMap((game) => {
    const providerId = game.providerSourceId?.trim();
    const name = game.titleEn?.trim() || game.titleKh?.trim();
    if (!providerId || !name || !activeIds.has(providerId) || hiddenIds.has(providerId) || isThailandProviderProduct(`${providerId} ${name}`)) return [];
    return [{ id: providerId, name, region: providerGameRegion(name), provider: "FZR Cards" as const, requiredFields: [] }];
  });
}

async function cachedPublicProviderGamesDuringOutage(availability: Awaited<ReturnType<typeof providerAvailability>>) {
  if (!availability.activeGameIds?.length) return [];
  try { return cachedPublicProviderGames(await getAppwriteProviderCatalog(), availability); } catch { return []; }
}

export async function fetchProviderGames(options: { includeInactive?: boolean } = {}): Promise<ProviderGameResponse> {
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
  const activeIds = publicProviderGameIds(availability, catalog.legacyPublicIds);
  return { status: "ready", games: games.filter((game) => activeIds.has(game.id) && !availability.hiddenGameIds.includes(game.id)) };
}

export async function fetchProviderGameDetails(gameId: string, options: { includeInactive?: boolean } = {}): Promise<ProviderGameDetailsResponse> {
  try {
    const availableGames = await fetchProviderGames({ includeInactive: options.includeInactive });
    if (availableGames.status !== "ready" || !availableGames.games.some((game) => game.id === gameId)) return { status: availableGames.status === "error" ? "error" : "unavailable", game: null, packages: [] };
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

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  const identity = await validateProviderPlayerIdentity(input);
  if (identity.status === "unavailable") return { status: "unavailable", packages: [] };
  if (identity.status === "error") return { status: "error", packages: [] };
  if (identity.status !== "verified") return { status: "verification_required", packages: [] };
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
const externalFailureSchema = z.object({ error: z.literal(true), msg: z.string().trim().max(300).optional() });

function mobileLegendsIdentityFields(fields: Record<string, string>) {
  const playerId = fields.player_id ?? fields.user_id ?? fields.id ?? "";
  const serverId = fields.server_id ?? fields.zone_id ?? fields.server ?? "";
  if (!/^\d{4,20}$/.test(playerId.trim()) || !/^\d{1,12}$/.test(serverId.trim())) return null;
  return { playerId: playerId.trim(), serverId: serverId.trim() };
}

function isMobileLegendsGame(gameId: string) {
  return /^mobile_legends(?:_|$)/i.test(gameId);
}

function emptyIdentity(status: Extract<ProviderPlayerIdentityResponse, { status: "invalid" | "not_supported" | "unavailable" | "error" }> ["status"]): ProviderPlayerIdentityResponse {
  return { status, playerName: null, playerId: null, region: null };
}

async function validateMobileLegendsWithFallback(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse | null> {
  const ids = mobileLegendsIdentityFields(input.fields);
  if (!ids) return emptyIdentity("invalid");
  let invalid: ProviderPlayerIdentityResponse | null = null;
  const recordResult = (result: ProviderPlayerIdentityResponse | null) => {
    if (result?.status === "verified") return result;
    if (result?.status === "invalid") invalid = result;
    return null;
  };

  const rapidApiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
  const neferbyteKey = process.env.NEFERBYTE_API_KEY;
  if (neferbyteKey && !rapidApiKey) {
    try {
      const response = await fetch(`https://api.neferbyte.com/game-id-checker/mobile-legends/${ids.playerId}/${ids.serverId}`, { headers: { "x-api-key": neferbyteKey }, signal: AbortSignal.timeout(12_000) });
      const payload = await response.json();
      const success = externalPlayerNameSchema.safeParse(payload);
      const verified = success.success ? recordResult({ status: "verified", playerName: success.data.data.username, playerId: ids.playerId, region: "Global" }) : null;
      if (verified) return verified;
      const failure = externalFailureSchema.safeParse(payload);
      if (response.ok && failure.success && /can.t find|not found|invalid/i.test(failure.data.msg ?? "")) invalid = emptyIdentity("invalid");
    } catch { /* Continue to the next approved provider. */ }
  }

  if (rapidApiKey) {
    try {
      const response = await fetch(`https://id-game-checker.p.rapidapi.com/mobile-legends/${ids.playerId}/${ids.serverId}`, { headers: { "x-rapidapi-host": "id-game-checker.p.rapidapi.com", "x-rapidapi-key": rapidApiKey }, signal: AbortSignal.timeout(12_000) });
      const payload = await response.json();
      const success = externalPlayerNameSchema.safeParse(payload);
      const verified = success.success ? recordResult({ status: "verified", playerName: success.data.data.username, playerId: ids.playerId, region: "Global" }) : null;
      if (verified) return verified;
      const failure = externalFailureSchema.safeParse(payload);
      if (response.ok && failure.success && /can.t find|not found|invalid/i.test(failure.data.msg ?? "")) invalid = emptyIdentity("invalid");
    } catch { /* Continue to the final owner-approved fallback. */ }
  }

  try {
    const response = await fetch(`https://api.isan.eu.org/nickname/ml?id=${encodeURIComponent(ids.playerId)}&server=${encodeURIComponent(ids.serverId)}`, { signal: AbortSignal.timeout(8_000) });
    const payload = await response.json();
    const success = isanPlayerNameSchema.safeParse(payload);
    const verified = success.success ? recordResult({ status: "verified", playerName: success.data.name, playerId: ids.playerId, region: success.data.country ?? "Global" }) : null;
    if (verified) return verified;
    if (response.ok && payload && typeof payload === "object" && "success" in payload && (payload as { success?: unknown }).success === false) invalid = emptyIdentity("invalid");
  } catch { /* All approved providers are currently unavailable. */ }

  return invalid ?? emptyIdentity("unavailable");
}

export async function validateProviderPlayerIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  try {
    const response = await fzrRequest("/api/v2/topups/validate-id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category_id: input.gameId, fields: input.fields }) });
    if (!response) return isMobileLegendsGame(input.gameId) ? (await validateMobileLegendsWithFallback(input) ?? emptyIdentity("unavailable")) : emptyIdentity("unavailable");
    const payload = fzrPlayerIdentitySchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== input.gameId) return { status: "error", playerName: null, playerId: null, region: null };
    if (!payload.data.valid || !payload.data.player_name) return { status: "invalid", playerName: null, playerId: null, region: null };
    return { status: "verified", playerName: payload.data.player_name, playerId: payload.data.player_id ?? null, region: payload.data.region ?? null };
  } catch (error) {
    if (isMobileLegendsGame(input.gameId)) return await validateMobileLegendsWithFallback(input) ?? emptyIdentity("unavailable");
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
  const activeGames = catalog.status === "ready" ? publicProviderGameIds(availability, catalog.legacyPublicIds) : new Set<string>();
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
  const legacyActiveGameIds = availability.activeGameIds ?? catalog.legacyPublicIds.filter((id) => !availability.hiddenGameIds.includes(id));
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
