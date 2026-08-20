import { afterEach, describe, expect, it } from "vitest";
import { fetchProviderPackages } from "./providerCatalog";

const originalEndpoint = process.env.PROVIDER_CATALOG_URL;
const originalApiKey = process.env.PROVIDER_CATALOG_API_KEY;

afterEach(() => {
  if (originalEndpoint === undefined) delete process.env.PROVIDER_CATALOG_URL;
  else process.env.PROVIDER_CATALOG_URL = originalEndpoint;
  if (originalApiKey === undefined) delete process.env.PROVIDER_CATALOG_API_KEY;
  else process.env.PROVIDER_CATALOG_API_KEY = originalApiKey;
});

describe("fetchProviderPackages", () => {
  it("keeps the catalog empty until authorized provider credentials are configured", async () => {
    delete process.env.PROVIDER_CATALOG_URL;
    delete process.env.PROVIDER_CATALOG_API_KEY;

    const result = await fetchProviderPackages({ accountId: "123456", service: "game" });

    expect(result).toEqual({ status: "unavailable", packages: [] });
  });
});
