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
  requiredFields: z.array(providerFieldSchema).min(1).max(12),
});

export const providerPackageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  amountLabel: z.string().trim().min(1).max(160),
  priceLabel: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(120),
  paymentMethods: z.array(z.enum(["khqr", "bank"])) .min(1).max(2),
});

const gamesPayloadSchema = z.object({ games: z.array(providerGameSchema).max(100) });
const packagesPayloadSchema = z.object({ packages: z.array(providerPackageSchema).max(200) });

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
  const endpointConfigured = Boolean(process.env.PROVIDER_CATALOG_URL);
  const credentialConfigured = Boolean(process.env.PROVIDER_CATALOG_API_KEY);
  return { configured: endpointConfigured && credentialConfigured, endpointConfigured, credentialConfigured };
}

async function providerRequest(action: "games" | "packages", data: Record<string, unknown>) {
  const endpoint = process.env.PROVIDER_CATALOG_URL;
  const apiKey = process.env.PROVIDER_CATALOG_API_KEY;
  if (!endpoint || !apiKey) return null;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ action, ...data }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("Provider request failed");
  return response.json();
}

export async function fetchProviderGames(): Promise<ProviderGameResponse> {
  try {
    const response = await providerRequest("games", {});
    if (!response) return { status: "unavailable", games: [] };
    const payload = gamesPayloadSchema.safeParse(response);
    return payload.success ? { status: "ready", games: payload.data.games } : { status: "error", games: [] };
  } catch {
    return { status: "error", games: [] };
  }
}

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  try {
    const response = await providerRequest("packages", input);
    if (!response) return { status: "unavailable", packages: [] };
    const payload = packagesPayloadSchema.safeParse(response);
    return payload.success ? { status: "ready", packages: payload.data.packages } : { status: "error", packages: [] };
  } catch {
    return { status: "error", packages: [] };
  }
}
