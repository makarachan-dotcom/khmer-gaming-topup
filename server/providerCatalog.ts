import { z } from "zod";

export const providerPackageSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(160),
  amountLabel: z.string().trim().min(1).max(160),
  priceLabel: z.string().trim().min(1).max(80),
  provider: z.string().trim().min(1).max(120),
});

const providerPayloadSchema = z.object({
  packages: z.array(providerPackageSchema).max(200),
});

export type ProviderPackageRequest = {
  accountId: string;
  accountName?: string;
  zoneId?: string;
  service: "game" | "diamond" | "other";
};

export type ProviderPackageResponse =
  | { status: "ready"; packages: z.infer<typeof providerPackageSchema>[] }
  | { status: "unavailable"; packages: [] }
  | { status: "error"; packages: [] };

export async function fetchProviderPackages(input: ProviderPackageRequest): Promise<ProviderPackageResponse> {
  const endpoint = process.env.PROVIDER_CATALOG_URL;
  const apiKey = process.env.PROVIDER_CATALOG_API_KEY;

  if (!endpoint || !apiKey) return { status: "unavailable", packages: [] };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { status: "error", packages: [] };

    const payload = providerPayloadSchema.safeParse(await response.json());
    if (!payload.success) return { status: "error", packages: [] };

    return { status: "ready", packages: payload.data.packages };
  } catch {
    return { status: "error", packages: [] };
  }
}
