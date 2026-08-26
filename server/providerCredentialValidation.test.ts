import { afterEach, describe, expect, it, vi } from "vitest";
import { validateProviderCredentialCandidate } from "./providerCredentialValidation";

const originalFetch = global.fetch;
const originalFzrUrl = process.env.FZR_CARDS_API_BASE_URL;
const originalBakongAccount = process.env.BAKONG_ACCOUNT_ID;

afterEach(() => {
  global.fetch = originalFetch;
  process.env.FZR_CARDS_API_BASE_URL = originalFzrUrl;
  process.env.BAKONG_ACCOUNT_ID = originalBakongAccount;
});

describe("provider credential validation", () => {
  it("validates a Fazercards candidate through a lightweight authenticated endpoint", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example";
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    global.fetch = fetchMock as typeof fetch;
    await expect(validateProviderCredentialCandidate("fazercards", "candidate-token")).resolves.toBe("validated");
    expect(fetchMock).toHaveBeenCalledWith("https://provider.example/api/v2/me", expect.objectContaining({ headers: { "X-API-Key": "candidate-token" } }));
  });

  it("rejects a non-working Fazercards candidate without persisting it", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example";
    global.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 401 })) as typeof fetch;
    await expect(validateProviderCredentialCandidate("fazercards", "candidate-token")).resolves.toBe("rejected");
  });

  it("uses only the lightweight Bakong account check and treats transport failure as unavailable", async () => {
    process.env.BAKONG_ACCOUNT_ID = "merchant-safe-test";
    global.fetch = vi.fn().mockRejectedValue(new Error("offline")) as typeof fetch;
    await expect(validateProviderCredentialCandidate("bakong", "candidate-token")).resolves.toBe("unavailable");
  });
});
