import { describe, expect, it } from "vitest";

describe.runIf(process.env.VITEST_LIVE_CREDENTIALS === "1")(
  "Appwrite record collection access",
  () => {
    it("authorizes the configured server credential to inspect the ZURS record collection", async () => {
      const endpoint = process.env.APPWRITE_ENDPOINT;
      const projectId = process.env.APPWRITE_PROJECT_ID;
      const apiKey = process.env.APPWRITE_API_KEY;

      expect(endpoint).toMatch(/^https:\/\/[^/]+\/v1$/);
      expect(projectId).toMatch(/^[A-Za-z0-9]+$/);
      expect(apiKey).toBeTruthy();

      const response = await fetch(`${endpoint}/databases/${process.env.APPWRITE_DATABASE_ID || "zurs_store"}/collections/zurs_records`, {
        headers: { "X-Appwrite-Project": projectId!, "X-Appwrite-Key": apiKey! },
        signal: AbortSignal.timeout(15_000),
      });

      expect(response.ok, `Appwrite collection discovery failed with HTTP ${response.status}`).toBe(true);
    }, 20_000);
  },
);
