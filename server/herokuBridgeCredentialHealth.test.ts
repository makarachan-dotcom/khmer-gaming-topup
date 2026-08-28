import { describe, expect, it } from "vitest";

const bridgeUrl = process.env.HEROKU_BRIDGE_URL?.trim();
const bridgeKey = process.env.HEROKU_BRIDGE_API_KEY?.trim();
// Network health is intentionally opt-in so an intermittent third-party
// service cannot make the deterministic product regression suite fail.
const bridgeCredentialHealthTest = process.env.RUN_LIVE_BRIDGE_HEALTH === "true" && /^https:\/\//.test(bridgeUrl ?? "") && Boolean(bridgeKey) ? it : it.skip;

describe("authorized Heroku bridge credential health", () => {
  bridgeCredentialHealthTest("accepts the server-only bridge credential on a no-player-data health request", async () => {
    expect(bridgeUrl).toMatch(/^https:\/\//);
    expect(bridgeKey).toBeTruthy();

    const response = await fetch(new URL("/health", bridgeUrl).toString(), {
      headers: { accept: "application/json", "x-bridge-key": bridgeKey! },
      signal: AbortSignal.timeout(8_000),
    });

    expect(response.ok).toBe(true);
  });
});
