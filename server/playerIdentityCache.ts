import { createHash } from "node:crypto";
import { validateProviderPlayerIdentity, type ProviderPackageRequest, type ProviderPlayerIdentityResponse } from "./providerCatalog";

const CACHE_MS = 3 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; value: ProviderPlayerIdentityResponse }>();

export function playerIdentityCacheKey(input: ProviderPackageRequest): string {
  const fields = Object.keys(input.fields)
    .sort()
    .map((key) => `${key}=${input.fields[key] ?? ""}`)
    .join("&");
  return createHash("sha256").update(`${input.gameId}|${fields}`).digest("hex");
}

export async function cachedValidateProviderPlayerIdentity(input: ProviderPackageRequest): Promise<ProviderPlayerIdentityResponse> {
  const key = playerIdentityCacheKey(input);
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await validateProviderPlayerIdentity(input);
  cache.set(key, { expiresAt: Date.now() + CACHE_MS, value });
  if (cache.size > 2_000) {
    const now = Date.now();
    for (const [cachedKey, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(cachedKey);
    }
    if (cache.size > 2_000) cache.clear();
  }
  return value;
}

export function resetPlayerIdentityCacheForTests() {
  cache.clear();
}
