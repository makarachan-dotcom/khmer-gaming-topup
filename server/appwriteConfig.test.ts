import { describe, expect, it } from "vitest";

describe.runIf(process.env.VITEST_LIVE_CREDENTIALS === "1")(
  "Appwrite Cloud configuration",
  () => {
    it("authenticates the supplied server credential for database discovery", async () => {
      const endpoint = process.env.APPWRITE_ENDPOINT;
      const projectId = process.env.APPWRITE_PROJECT_ID;
      const apiKey = process.env.APPWRITE_API_KEY;

      expect(endpoint).toMatch(/^https:\/\/[^/]+\/v1$/);
      expect(projectId).toMatch(/^[A-Za-z0-9]+$/);
      expect(apiKey).toMatch(/^standard_/);

      const response = await fetch(`${endpoint}/databases`, {
        headers: {
          "X-Appwrite-Project": projectId!,
          "X-Appwrite-Key": apiKey!,
        },
        signal: AbortSignal.timeout(15_000),
      });

      expect(
        response.ok,
        `Appwrite database discovery failed with HTTP ${response.status}`
      ).toBe(true);
    }, 20_000);
  }
);
