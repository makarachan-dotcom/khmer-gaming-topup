import { z } from "zod";
import { getAppwriteProviderAvailability, isAppwriteStoreConfigured, updateAppwriteProviderAvailability } from "./appwriteStore";

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
  if (!isAppwriteStoreConfigured()) return { hiddenGameIds: [] as string[], hiddenSmmServiceIds: [] as string[] };
  try { return await getAppwriteProviderAvailability(); } catch { return { hiddenGameIds: [] as string[], hiddenSmmServiceIds: [] as string[] }; }
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

export async function fetchProviderGames(options: { includeHidden?: boolean } = {}): Promise<ProviderGameResponse> {
  try {
    const response = await fzrRequest("/api/v2/topups");
    if (!response) return { status: "unavailable", games: [] };
    const availability = options.includeHidden ? null : await providerAvailability();
    const payload = fzrTopupsSchema.safeParse(response);
    if (!payload.success) return { status: "error", games: [] };
    const hidden = new Set(availability?.hiddenGameIds ?? []);
    return { status: "ready", games: payload.data.items.filter((item) => !hidden.has(item.category_id) && !isThailandProviderProduct(`${item.category_id} ${item.name} ${item.note ?? ""}`)).map((item) => ({ id: item.category_id, name: item.name, provider: "FZR Cards", requiredFields: [] })) };
  } catch { return { status: "error", games: [] }; }
}

export async function fetchProviderGameDetails(gameId: string): Promise<ProviderGameDetailsResponse> {
  try {
    const response = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(gameId)}&include_ui=1`);
    if (!response) return { status: "unavailable", game: null, packages: [] };
    const availability = await providerAvailability();
    if (availability.hiddenGameIds.includes(gameId)) return { status: "unavailable", game: null, packages: [] };
    const payload = fzrOffersSchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== gameId) return { status: "error", game: null, packages: [] };
    if (isThailandProviderProduct(`${gameId} ${payload.data.name}`)) return { status: "unavailable", game: null, packages: [] };
    const fields = providerFields(payload.data.fields);
    return { status: "ready", game: { id: gameId, name: payload.data.name, logoUrl: payload.data.imageurl, provider: "FZR Cards", requiredFields: fields }, packages: providerPackages(gameId, payload.data.offers) };
  } catch { return { status: "error", game: null, packages: [] }; }
}

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  const identity = await validateProviderPlayerIdentity(input);
  if (identity.status !== "verified") {
    if (identity.status === "unavailable") return { status: "unavailable", packages: [] };
    return { status: "verification_required", packages: [] };
  }
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

export async function validateProviderPlayerIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  try {
    const response = await fzrRequest("/api/v2/topups/validate-id", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ category_id: input.gameId, fields: input.fields }) });
    if (!response) return { status: "unavailable", playerName: null, playerId: null, region: null };
    const payload = fzrPlayerIdentitySchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== input.gameId) return { status: "error", playerName: null, playerId: null, region: null };
    if (!payload.data.valid || !payload.data.player_name) return { status: "invalid", playerName: null, playerId: null, region: null };
    return { status: "verified", playerName: payload.data.player_name, playerId: payload.data.player_id ?? null, region: payload.data.region ?? null };
  } catch (error) {
    if (error instanceof FzrRequestError && [400, 404].includes(error.status)) return { status: "not_supported", playerName: null, playerId: null, region: null };
    if (error instanceof FzrRequestError && error.status === 422) return { status: "invalid", playerName: null, playerId: null, region: null };
    if (error instanceof FzrRequestError && [502, 503].includes(error.status)) return { status: "unavailable", playerName: null, playerId: null, region: null };
    return { status: "error", playerName: null, playerId: null, region: null };
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
  const [gamesResponse, smmResponse, availability] = await Promise.all([fetchProviderGames({ includeHidden: true }), fetchSmmProviderServices({ includeHidden: true }), providerAvailability()]);
  const hiddenGames = new Set(availability.hiddenGameIds);
  const hiddenSmm = new Set(availability.hiddenSmmServiceIds);
  return {
    games: gamesResponse.status === "ready" ? gamesResponse.games.map((game) => ({ id: game.id, name: game.name, isActive: !hiddenGames.has(game.id) })) : [],
    smm: smmResponse.status === "ready" ? smmResponse.services.map((service) => ({ id: service.providerServiceId, name: service.name, category: service.category, isActive: !hiddenSmm.has(service.providerServiceId) })) : [],
  };
}

export async function setProviderAvailability(input: { kind: "game" | "smm"; providerId: string; isActive: boolean }) {
  if (!isAppwriteStoreConfigured()) throw new Error("Provider availability control is not configured");
  return updateAppwriteProviderAvailability(input);
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
