import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("authorized Check-ID bridge timeout contract", () => {
  const source = readFileSync(join(process.cwd(), "server/providerCatalog.ts"), "utf8");

  it("allows delayed bridge responses up to 25 seconds while keeping the credential server-only", () => {
    expect(source).toContain("signal: AbortSignal.timeout(25_000)");
    expect(source).toContain('"x-bridge-key": bridge.bridgeKey');
    expect(source).toContain("process.env.HEROKU_BRIDGE_KEY?.trim()");
    expect(source).not.toContain("VITE_HEROKU_BRIDGE_API_KEY");
    expect(source).not.toContain("VITE_HEROKU_BRIDGE_KEY");
  });

  it("records only privacy-safe bridge failure classes for production diagnostics", () => {
    expect(source).toContain("function logAuthorizedBridgeOutcome");
    expect(source).toContain('logAuthorizedBridgeOutcome("unconfigured")');
    expect(source).toContain('logAuthorizedBridgeOutcome("unavailable_response", response.status)');
    expect(source).toContain('logAuthorizedBridgeOutcome(error instanceof DOMException && error.name === "TimeoutError" ? "timeout" : "request_failed")');
  });

  it("normalizes bridge game slugs and preserves the documented Free Fire free-check mapping", () => {
    expect(source).toContain('bridgeGame: "pubg-mobile"');
    expect(source).toContain('bridgeGame: "honor-of-kings"');
    expect(source).toContain('bridgeGame: "mobile-legends"');
    expect(source).toContain('game === "ff"');
    expect(source).toContain('isanUrl("ff")');
  });
});
