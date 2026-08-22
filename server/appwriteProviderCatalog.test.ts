import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppwriteProviderCatalog, syncAppwriteFzrCatalog, updateAppwriteProviderOffer } from "./appwriteStore";

const savedEnvironment = { endpoint: process.env.APPWRITE_ENDPOINT, projectId: process.env.APPWRITE_PROJECT_ID, apiKey: process.env.APPWRITE_API_KEY };

afterEach(() => {
  process.env.APPWRITE_ENDPOINT = savedEnvironment.endpoint;
  process.env.APPWRITE_PROJECT_ID = savedEnvironment.projectId;
  process.env.APPWRITE_API_KEY = savedEnvironment.apiKey;
  vi.unstubAllGlobals();
});

describe("Appwrite provider catalog fallback", () => {
  it("syncs provider-authorized offers and persists a per-offer margin without exposing the server credential", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    const records = new Map<string, Record<string, unknown>>();
    const requests: Array<{ url: string; method?: string; body?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      requests.push({ url, method: init?.method, body: String(init?.body ?? "") });
      if (init?.method === "GET" && url.includes("queries%5B%5D=")) return new Response(JSON.stringify({ type: "general_query_invalid" }), { status: 400 });
      if (init?.method === "GET" && url.includes("/documents?")) return new Response(JSON.stringify({ documents: Array.from(records.values()), total: records.size }), { status: 200 });
      const id = url.split("/").at(-1) ?? "";
      if (init?.method === "GET") return records.has(id) ? new Response(JSON.stringify(records.get(id)), { status: 200 }) : new Response("", { status: 404 });
      const parsed = JSON.parse(String(init?.body ?? "{}")) as { documentId?: string; data?: Record<string, unknown> };
      const documentId = init?.method === "POST" ? parsed.documentId! : id;
      records.set(documentId, { $id: documentId, ...parsed.data });
      return new Response(JSON.stringify(records.get(documentId)), { status: init?.method === "POST" ? 201 : 200 });
    }));

    await expect(getAppwriteProviderCatalog()).resolves.toEqual({ games: [], smm: [] });

    const result = await syncAppwriteFzrCatalog({
      status: "ready",
      games: [{ providerGameId: "mobile_legends_global", name: "Mobile Legends", requiredFields: [{ key: "player_id", label: "Player ID", required: true }], offers: [{ providerOfferId: "86", name: "86 Diamonds", priceUsd: "1.00" }] }],
    } as never);

    expect(result).toMatchObject({ gamesImported: 1, offersImported: 1, provider: "FZR Cards" });
    const catalog = await getAppwriteProviderCatalog();
    const offer = catalog.games[0]?.packages[0];
    expect(offer).toMatchObject({ basePriceUsd: "1.00", profitMarginPercent: "0.00", priceUsd: "1.00", providerAuthorized: true, isActive: false });

    await expect(updateAppwriteProviderOffer({ kind: "game", offerId: offer!.id, basePriceUsd: "1.00", profitMarginPercent: "20", isActive: true, featured: true })).resolves.toEqual({ success: true });
    const updated = (await getAppwriteProviderCatalog()).games[0]?.packages[0];
    expect(updated).toMatchObject({ basePriceUsd: "1.00", profitMarginPercent: "20", priceUsd: "1.20", isActive: true, featured: true });
    expect(requests.map((request) => request.body).join(" ")).not.toContain("server-only-test-key");
    expect(requests.some((request) => request.url.includes("queries%5B%5D=limit%28100%29") && request.url.includes("queries%5B%5D=offset%280%29"))).toBe(true);
    expect(requests.some((request) => request.url.includes("?limit=25&offset=0"))).toBe(true);
    expect(requests.some((request) => request.body.includes("provider_catalog_index"))).toBe(true);
    expect(requests.some((request) => request.body.includes("provider_catalog_game_offer"))).toBe(true);
  });
});
