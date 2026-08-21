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
  paymentMethods: z.array(z.enum(["khqr", "bank"])) .min(1).max(2),
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
});

export type ProviderGameResponse =
  | { status: "ready"; games: z.infer<typeof providerGameSchema>[] }
  | { status: "unavailable"; games: [] }
  | { status: "error"; games: [] };

export type ProviderPackageRequest = {
  gameId: string;
  fields: Record<string, string>;
};

export type ProviderPackageResponse =
  | { status: "ready"; packages: z.infer<typeof providerPackageSchema>[] }
  | { status: "unavailable"; packages: [] }
  | { status: "error"; packages: [] };

export function getProviderCatalogStatus() {
  const endpointConfigured = Boolean(process.env.FZR_CARDS_API_BASE_URL);
  const credentialConfigured = Boolean(process.env.FZR_CARDS_API_KEY);
  return { configured: endpointConfigured && credentialConfigured, endpointConfigured, credentialConfigured };
}

async function fzrRequest(path: string) {
  const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
  const apiKey = process.env.FZR_CARDS_API_KEY;
  if (!baseUrl || !apiKey) return null;
  const response = await fetch(`${baseUrl}${path}`, { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`FZR Cards catalog request failed (${response.status})`);
  return response.json();
}

export async function fetchProviderGames(): Promise<ProviderGameResponse> {
  try {
    const response = await fzrRequest("/api/v2/topups");
    if (!response) return { status: "unavailable", games: [] };
    const payload = fzrTopupsSchema.safeParse(response);
    if (!payload.success) return { status: "error", games: [] };
    const games = payload.data.items.map((item) => ({ id: item.category_id, name: item.name, provider: "FZR Cards", requiredFields: [] }));
    return { status: "ready", games };
  } catch {
    return { status: "error", games: [] };
  }
}

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  try {
    const response = await fzrRequest(`/api/v2/topups/offers?category_id=${encodeURIComponent(input.gameId)}&include_ui=1`);
    if (!response) return { status: "unavailable", packages: [] };
    const payload = fzrOffersSchema.safeParse(response);
    if (!payload.success || payload.data.category_id !== input.gameId) return { status: "error", packages: [] };
    const packages = payload.data.offers.filter((offer) => Boolean(offer.offer_id)).map((offer) => ({ id: `${input.gameId}:${offer.offer_id}`, label: offer.name, amountLabel: offer.name, priceLabel: `$${Number(offer.price_usd).toFixed(2)}`, provider: "FZR Cards", paymentMethods: ["khqr", "bank"] as ("khqr" | "bank")[] }));
    return { status: "ready", packages };
  } catch {
    return { status: "error", packages: [] };
  }
}
