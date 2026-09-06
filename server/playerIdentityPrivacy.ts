import type { ProviderPlayerIdentityResponse } from "./providerCatalog";

export type PublicPlayerIdentityResponse =
  | { status: "verified"; playerName: string; region: string | null; photoUrl?: string | null }
  | { status: "invalid" | "not_supported" | "unavailable" | "error"; playerName: null; region: null; photoUrl?: null };

/**
 * The browser already owns its editable ID fields. It only needs the verified
 * display name, region, and outcome to render the game form, never a raw ID,
 * upstream payload, bridge URL, or bridge credential.
 */
export function toPublicPlayerIdentityResponse(identity: ProviderPlayerIdentityResponse): PublicPlayerIdentityResponse {
  if (identity.status === "verified") {
    // Round 9: a verified Telegram handle also returns its PUBLIC profile picture
    // so the buyer can recognise the account before paying. The key is omitted
    // entirely when there is no picture, which keeps the payload shape identical
    // to every pre-Round-9 response.
    return {
      status: "verified",
      playerName: identity.playerName,
      region: identity.region,
      ...(identity.photoUrl ? { photoUrl: identity.photoUrl } : {}),
    };
  }

  return { status: identity.status, playerName: null, region: null };
}
