import { afterEach, describe, expect, it } from "vitest";
import { fetchProviderGames, fetchProviderPackages } from "./providerCatalog";

const originalEndpoint = process.env.PROVIDER_CATALOG_URL;
const originalApiKey = process.env.PROVIDER_CATALOG_API_KEY;

afterEach(() => {
  if (originalEndpoint === undefined) delete process.env.PROVIDER_CATALOG_URL;
  else process.env.PROVIDER_CATALOG_URL = originalEndpoint;
  if (originalApiKey === undefined) delete process.env.PROVIDER_CATALOG_API_KEY;
  else process.env.PROVIDER_CATALOG_API_KEY = originalApiKey;
});

describe("provider catalog", () => {
  it("keeps games and packages empty until authorized provider credentials are configured", async () => {
    delete process.env.PROVIDER_CATALOG_URL;
    delete process.env.PROVIDER_CATALOG_API_KEY;

    await expect(fetchProviderGames()).resolves.toEqual({ status: "unavailable", games: [] });
    await expect(fetchProviderPackages({ gameId: "provider-game", fields: { playerId: "123456" } })).resolves.toEqual({ status: "unavailable", packages: [] });
  });
});
