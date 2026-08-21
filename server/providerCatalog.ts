import { z } from "zod";

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
  | { status: "unavailable"; packages: [] }
  | { status: "error"; packages: [] };

export type SmmProviderCatalogResponse =
  | { status: "ready"; services: Array<{ providerServiceId: string; name: string; category: string; serviceType: string; rateUsdPerThousand: string; min: number; max: number; refill: boolean; cancel: boolean; dripfeed: boolean }> }
  | { status: "unavailable"; services: [] }
  | { status: "error"; services: [] };

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

async function fzrRequest(path: string) {
  const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
  const apiKey = process.env.FZR_CARDS_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}${path}`, { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`FZR Cards catalog request failed (${response.status})`);
  return response.json();
}

async function smmGlobRequest(action: string, parameters: Record<string, string> = {}) {
  const baseUrl = process.env.SMMGLOB_API_URL;
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

export async function fetchProviderGames(): Promise<ProviderGameResponse> {
  try {
    const response = await fzrRequest("/api/v2/topups");
    if (!response) return { status: "unavailable", games: [] };
    const payload = fzrTopupsSchema.safeParse(response);
    if (!payload.success) return { status: "error", games: [] };
    return { status: "ready", games: payload.data.items.map((item) => ({ id: item.category_id, name: item.name, provider: "FZR Cards", requiredFields: [] })) };
  } catch { return { status: "error", games: [] }; }
}

export async function fetchProviderGameDetails(gameId: string): Promise<ProviderGameDetailsResponse> {
  try {
    const response = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(gameId)}&include_ui=1`);
    if (!response) return { status: "unavailable", game: null, packages: [] };
    const payload = fzrOffersSchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== gameId) return { status: "error", game: null, packages: [] };
    const fields = providerFields(payload.data.fields);
    return { status: "ready", game: { id: gameId, name: payload.data.name, logoUrl: payload.data.imageurl, provider: "FZR Cards", requiredFields: fields }, packages: providerPackages(gameId, payload.data.offers) };
  } catch { return { status: "error", game: null, packages: [] }; }
}

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  const details = await fetchProviderGameDetails(input.gameId);
  if (details.status !== "ready") return { status: details.status, packages: [] };
  return { status: "ready", packages: details.packages };
}

export async function fetchSmmProviderServices(): Promise<SmmProviderCatalogResponse> {
  try {
    const response = await smmGlobRequest("services");
    if (!response) return { status: "unavailable", services: [] };
    const payload = z.array(smmGlobServiceSchema).max(20_000).safeParse(response);
    if (!payload.success) return { status: "error", services: [] };
    return { status: "ready", services: payload.data.map((service) => ({ providerServiceId: service.service, name: service.name, category: service.category, serviceType: service.type, rateUsdPerThousand: Number(service.rate).toFixed(4), min: service.min, max: service.max, refill: Boolean(service.refill), cancel: Boolean(service.cancel), dripfeed: Boolean(service.dripfeed) })) };
  } catch { return { status: "error", services: [] }; }
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
    const details = await mapWithConcurrency(catalog.data.items, 6, async (item) => {
      const offerResponse = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(item.category_id)}&include_ui=1`);
      const offers = fzrOffersSchema.safeParse(offerResponse);
      if (!offers.success || offers.data.category_id !== item.category_id) return null;
      return { providerGameId: item.category_id, name: offers.data.name, logoUrl: offers.data.imageurl, requiredFields: providerFields(offers.data.fields), offers: offers.data.offers.filter((offer) => Boolean(offer.offer_id)).map((offer) => ({ providerOfferId: offer.offer_id!, name: offer.name, priceUsd: Number(offer.price_usd).toFixed(2) })) };
    });
    return { status: "ready", games: details.filter((game): game is NonNullable<typeof game> => game !== null) };
  } catch { return { status: "error", games: [] }; }
}
