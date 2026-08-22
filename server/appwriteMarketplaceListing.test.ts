import { afterEach, describe, expect, it, vi } from "vitest";
import { createAppwriteMarketplaceListing } from "./appwriteStore";

const savedEnvironment = {
  endpoint: process.env.APPWRITE_ENDPOINT,
  projectId: process.env.APPWRITE_PROJECT_ID,
  apiKey: process.env.APPWRITE_API_KEY,
};

afterEach(() => {
  process.env.APPWRITE_ENDPOINT = savedEnvironment.endpoint;
  process.env.APPWRITE_PROJECT_ID = savedEnvironment.projectId;
  process.env.APPWRITE_API_KEY = savedEnvironment.apiKey;
  vi.unstubAllGlobals();
});

describe("Appwrite marketplace listing fallback", () => {
  it("keeps a new seller listing pending until the administrator reviews it", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toContain("/databases/zurs_store/collections/zurs_records/documents");
      expect(init?.method).toBe("POST");
      const request = JSON.parse(String(init?.body));
      const listing = JSON.parse(request.data.payload);
      expect(request.data.sourceTable).toBe("marketplaceListings");
      expect(listing).toMatchObject({ sellerUserId: 42, title: "Mythic account", status: "pending" });
      return new Response(JSON.stringify({ $id: request.documentId }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createAppwriteMarketplaceListing({
      sellerUserId: 42,
      listingType: "sale",
      game: "Mobile Legends",
      title: "Mythic account",
      rankLevel: "Mythic",
      priceUsd: "45.00",
      description: "Original owner",
      contactMethod: "Telegram",
      telegramUsername: "zurs_seller",
      screenshots: ["appwrite/zurs_media/marketplace-listings-private/42/proof.webp/file-1"],
    });

    expect(result.status).toBe("pending");
    expect(result.id).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
