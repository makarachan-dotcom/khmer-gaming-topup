import type { ProviderPlayerIdentityResponse } from "./providerCatalog";

export type PublicPlayerIdentityResponse =
  | { status: "verified"; playerName: string; region: string | null }
  | { status: "invalid" | "not_supported" | "unavailable" | "error"; playerName: null; region: null };

/**
 * The browser already owns its editable ID fields. It only needs the verified
 * display name, region, and outcome to render the game form, never a raw ID,
 * upstream payload, bridge URL, or bridge credential.
 */
export function toPublicPlayerIdentityResponse(identity: ProviderPlayerIdentityResponse): PublicPlayerIdentityResponse {
  if (identity.status === "verified") {
    return { status: "verified", playerName: identity.playerName, region: identity.region };
  }

  return { status: identity.status, playerName: null, region: null };
}
