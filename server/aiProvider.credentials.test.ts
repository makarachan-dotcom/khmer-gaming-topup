import { describe, expect, it } from "vitest";

const runLiveCredentialSmoke = process.env.RUN_AI_PROVIDER_CREDENTIAL_TEST === "1";

describe.runIf(runLiveCredentialSmoke)("AI provider credentials (live smoke)", () => {
  it("accepts the server-only iamhc API key on a lightweight models request", async () => {
    const apiKey = process.env.IAMHC_API_KEY?.trim();
    expect(apiKey, "IAMHC_API_KEY must be configured").toBeTruthy();

    const response = await fetch("https://api.iamhc.cn/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.status, "iamhc credential smoke request must succeed").toBeGreaterThanOrEqual(200);
    expect(response.status, "iamhc credential smoke request must succeed").toBeLessThan(300);
  });

  it("accepts the server-only You.com API key on a lightweight search request", async () => {
    const apiKey = process.env.YOU_API_KEY?.trim();
    expect(apiKey, "YOU_API_KEY must be configured").toBeTruthy();

    const response = await fetch("https://api.you.com/v1/search?query=zurs", {
      headers: { "X-API-Key": apiKey },
      signal: AbortSignal.timeout(12_000),
    });

    expect(response.status, "You.com credential smoke request must succeed").toBeGreaterThanOrEqual(200);
    expect(response.status, "You.com credential smoke request must succeed").toBeLessThan(300);
  });
});
