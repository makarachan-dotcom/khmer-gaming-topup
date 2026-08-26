import { describe, expect, it } from "vitest";

const bridgeUrl = process.env.HEROKU_BRIDGE_URL;
const bridgeHealthTest = /^https:\/\//.test(bridgeUrl ?? "") ? it : it.skip;

describe("authorized Heroku bridge health", () => {
  bridgeHealthTest("responds from the configured HTTPS bridge without a player lookup", async () => {
    expect(bridgeUrl).toMatch(/^https:\/\//);

    const response = await fetch(new URL("/health", bridgeUrl).toString(), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    expect(response.ok).toBe(true);

    const payload = await response.json() as { ok?: boolean; configured?: boolean };
    expect(payload.ok).toBe(true);
    expect(payload.configured).toBe(true);
  }, 12_000);
});
