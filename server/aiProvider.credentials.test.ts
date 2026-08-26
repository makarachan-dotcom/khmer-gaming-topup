import { describe, expect, it } from "vitest";

const runLiveCredentialSmoke = process.env.RUN_AI_PROVIDER_CREDENTIAL_TEST === "1";
const runLiveOutputSmoke = process.env.RUN_AI_PROVIDER_OUTPUT_SMOKE === "1";

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

  it.runIf(runLiveOutputSmoke)("returns a minimal text completion from approved fast and complex candidates", async () => {
    const apiKey = process.env.IAMHC_API_KEY?.trim();
    expect(apiKey, "IAMHC_API_KEY must be configured").toBeTruthy();
    for (const model of ["DeepSeek-V4-Flash", "glm-5.3"]) {
      const response = await fetch("https://api.iamhc.cn/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 16,
          messages: [{ role: "user", content: "Reply with the single word: ready" }],
        }),
        signal: AbortSignal.timeout(20_000),
      });
      expect(response.status, `${model} text completion must succeed`).toBeGreaterThanOrEqual(200);
      expect(response.status, `${model} text completion must succeed`).toBeLessThan(300);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      expect(payload.choices?.[0]?.message?.content?.trim(), `${model} must return text`).toBeTruthy();
    }
  });
});
