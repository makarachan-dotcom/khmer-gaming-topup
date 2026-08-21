import { describe, expect, it } from "vitest";

describe("authorized provider credentials", () => {
  it("accepts the server-only FZR Cards key on the account endpoint", async () => {
    const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
    const apiKey = process.env.FZR_CARDS_API_KEY;
    expect(baseUrl).toBe("https://api.fzr.cards");
    expect(apiKey).toMatch(/^fc_[a-z0-9]+$/);

    const response = await fetch(`${baseUrl}/api/v2/me`, { headers: { "X-API-Key": apiKey! }, signal: AbortSignal.timeout(12_000) });
    const body = await response.json() as { ok?: boolean; error?: string };
    expect(response.status).not.toBe(401);
    expect(body.ok).toBe(true);
  }, 15_000);

  it("accepts the server-only SMMGlob key on the balance endpoint", async () => {
    const endpoint = process.env.SMMGLOB_API_URL;
    const apiKey = process.env.SMMGLOB_API_KEY;
    expect(endpoint).toBe("https://smmglob.com/api/v2");
    expect(apiKey).toMatch(/^[A-Za-z0-9]+$/);

    const response = await fetch(endpoint!, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ key: apiKey!, action: "balance" }), signal: AbortSignal.timeout(12_000) });
    const body = await response.json() as { balance?: string; currency?: string; error?: string };
    expect(response.ok).toBe(true);
    expect(body.balance).toMatch(/^\d+(\.\d+)?$/);
    expect(body.currency).toBeTruthy();
  }, 15_000);
});
