import type { RotatableProvider } from "./providerCredentialStore";

export type CredentialValidationResult = "validated" | "rejected" | "unavailable";

function apiUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

export async function validateProviderCredentialCandidate(provider: RotatableProvider, candidate: string): Promise<CredentialValidationResult> {
  if (provider === "fazercards") {
    const baseUrl = process.env.FZR_CARDS_API_BASE_URL?.trim();
    if (!baseUrl) return "unavailable";
    try {
      const response = await fetch(apiUrl(baseUrl, "/api/v2/me"), { headers: { "X-API-Key": candidate }, signal: AbortSignal.timeout(8_000) });
      return response.ok ? "validated" : "rejected";
    } catch {
      return "unavailable";
    }
  }

  const accountId = process.env.BAKONG_ACCOUNT_ID?.trim();
  if (!accountId) return "unavailable";
  try {
    const response = await fetch("https://api-bakong.nbc.gov.kh/v1/check_bakong_account", {
      method: "POST",
      headers: { Authorization: `Bearer ${candidate}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json().catch(() => null) as { responseCode?: number } | null;
    return response.ok && payload?.responseCode === 0 ? "validated" : "rejected";
  } catch {
    return "unavailable";
  }
}
