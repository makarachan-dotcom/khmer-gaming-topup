type ProviderCredentialState = "configured" | "missing";

function state(requiredValues: Array<string | undefined>): ProviderCredentialState {
  return requiredValues.every((value) => Boolean(value?.trim())) ? "configured" : "missing";
}

/** Owner-facing configuration readiness only. Never return values, prefixes,
 * fingerprints, URLs, merchant fields, or any data that can help reconstruct a secret. */
export function getProviderCredentialStatus() {
  return {
    fazercards: { state: state([process.env.FZR_CARDS_API_BASE_URL, process.env.FZR_CARDS_API_KEY]) },
    bakong: { state: state([process.env.BAKONG_API_TOKEN, process.env.BAKONG_ACCOUNT_ID, process.env.BAKONG_MERCHANT_NAME, process.env.BAKONG_MERCHANT_CITY, process.env.BAKONG_MERCHANT_PHONE, process.env.BAKONG_STORE_LABEL]) },
    rotationMode: "deployment_secret_only" as const,
  };
}
