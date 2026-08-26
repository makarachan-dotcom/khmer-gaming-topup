import type { RotatableProvider } from "./providerCredentialStore";

/** Resolves a validated runtime override first; deployment configuration remains the safe fallback. */
export async function resolveProviderCredential(provider: RotatableProvider, deploymentCredential: string | undefined) {
  try {
    const { getActiveEncryptedProviderCredential } = await import("./providerCredentialStore");
    return (await getActiveEncryptedProviderCredential(provider)) ?? deploymentCredential?.trim() ?? null;
  } catch {
    return deploymentCredential?.trim() ?? null;
  }
}
