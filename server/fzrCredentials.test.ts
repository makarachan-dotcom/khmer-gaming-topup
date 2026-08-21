import { describe, expect, it } from "vitest";

describe("FZR Cards provider credentials", () => {
  it("authenticates server-side against the lightweight account endpoint", async () => {
    const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
    const apiKey = process.env.FZR_CARDS_API_KEY;
    expect(baseUrl).toBe("https://api.fzr.cards");
    expect(apiKey).toMatch(/^fc_[a-z0-9]+$/);

    const response = await fetch(`${baseUrl}/api/v2/me`, {
      headers: { "X-API-Key": apiKey! },
      signal: AbortSignal.timeout(12_000),
    });
    const body = await response.json() as { ok?: boolean; error?: string };
    expect(response.status).not.toBe(401);
    expect(body.ok).toBe(true);
  }, 15_000);
});
