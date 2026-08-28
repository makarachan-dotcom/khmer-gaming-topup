import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

describe("Appwrite Auth startup boundary", () => {
  it("does not statically load the legacy OAuth route from the shared Express app", () => {
    const appSource = readFileSync(new URL("./app.ts", import.meta.url), "utf8");
    const contextSource = readFileSync(new URL("./_core/context.ts", import.meta.url), "utf8");
    expect(appSource).not.toContain('from "./_core/oauth"');
    expect(appSource).not.toContain("registerOAuthRoutes(");
    expect(appSource).toContain('registerAppwriteAuthRoutes(app)');
    expect(contextSource).not.toContain('import("./sdk")');
    expect(contextSource).not.toContain("ENV.oAuthServerUrl");
  });
});
