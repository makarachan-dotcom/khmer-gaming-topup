import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public Google OAuth status privacy", () => {
  it("does not expose Gmail sender identity from the public status route", () => {
    const source = readFileSync(resolve(process.cwd(), "server/googleAuth.ts"), "utf8");
    const statusRoute = source.match(/app\.get\("\/api\/auth\/google\/status"[\s\S]*?\);\n\s*app\.get\("\/api\/auth\/google\/diagnostic"/);
    expect(statusRoute?.[0]).toContain("getPublicGoogleOAuthStatus");
    expect(statusRoute?.[0]).not.toContain("senderEmail");
    expect(statusRoute?.[0]).not.toContain("gmailSenderConnected");
  });

  it("returns a non-sensitive callback failure reference to help support diagnosis", () => {
    const source = readFileSync(resolve(process.cwd(), "server/googleAuth.ts"), "utf8");
    expect(source).toContain("Reference: ${getGoogleCallbackFailureReference(stage)}");
  });
});
