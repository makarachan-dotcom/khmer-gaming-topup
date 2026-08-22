import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppwriteMarketplaceListing, listAppwriteMarketplaceListings } from "./appwriteStore";

const originalEnvironment = { endpoint: process.env.APPWRITE_ENDPOINT, projectId: process.env.APPWRITE_PROJECT_ID, apiKey: process.env.APPWRITE_API_KEY };

afterEach(() => {
  process.env.APPWRITE_ENDPOINT = originalEnvironment.endpoint;
  process.env.APPWRITE_PROJECT_ID = originalEnvironment.projectId;
  process.env.APPWRITE_API_KEY = originalEnvironment.apiKey;
  vi.unstubAllGlobals();
});

describe("Appwrite marketplace review queue", () => {
  it("shows a persisted seller request to the Admin pending-review query", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    const records: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") {
        const request = JSON.parse(String(init.body));
        records.push({ $id: request.documentId, ...request.data });
        return new Response(JSON.stringify({ $id: request.documentId }), { status: 201 });
      }
      if (init?.method === "GET") return new Response(JSON.stringify({ documents: records, total: records.length }), { status: 200 });
      return new Response(null, { status: 204 });
    }));

    const created = await createAppwriteMarketplaceListing({ sellerUserId: 42, listingType: "sale", game: "Mobile Legends", title: "Mythic account", rankLevel: "Mythic", priceUsd: "45.00", description: "Original owner with full account details.", contactMethod: "Telegram", telegramUsername: "zurs_seller", screenshots: [] });
    const queue = await listAppwriteMarketplaceListings("pending");

    expect(queue).toHaveLength(1);
    expect(queue[0]?.listing).toMatchObject({ id: created.id, status: "pending", sellerUserId: 42, title: "Mythic account" });
  });

  it("rejects a missing Appwrite create endpoint instead of reporting a false successful submission", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(createAppwriteMarketplaceListing({ sellerUserId: 42, listingType: "sale", game: "Mobile Legends", title: "Mythic account", rankLevel: "Mythic", priceUsd: "45.00", description: "Original owner with full account details.", contactMethod: "Telegram", telegramUsername: "zurs_seller", screenshots: [] })).rejects.toThrow("HTTP 404");
  });
});
