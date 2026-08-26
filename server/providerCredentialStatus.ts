type ProviderCredentialState = "configured" | "missing";

import { resolveProviderCredential } from "./providerCredentialResolver";

function state(requiredValues: Array<string | undefined>): ProviderCredentialState {
  return requiredValues.every((value) => Boolean(value?.trim())) ? "configured" : "missing";
}

/** Owner-facing configuration readiness only. Never return values, prefixes,
 * fingerprints, URLs, merchant fields, or any data that can help reconstruct a secret. */
export async function getProviderCredentialStatus() {
  const [fazercardsKey, bakongToken] = await Promise.all([
    resolveProviderCredential("fazercards", process.env.FZR_CARDS_API_KEY),
    resolveProviderCredential("bakong", process.env.BAKONG_API_TOKEN),
  ]);
  return {
    fazercards: { state: state([process.env.FZR_CARDS_API_BASE_URL, fazercardsKey ?? undefined]) },
    bakong: { state: state([bakongToken ?? undefined, process.env.BAKONG_ACCOUNT_ID, process.env.BAKONG_MERCHANT_NAME, process.env.BAKONG_MERCHANT_CITY, process.env.BAKONG_MERCHANT_PHONE, process.env.BAKONG_STORE_LABEL]) },
    rotationMode: "encrypted_owner_rotation_with_env_fallback" as const,
  };
}
