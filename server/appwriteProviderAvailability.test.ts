import { afterEach, describe, expect, it, vi } from "vitest";
import { updateAppwriteProviderAvailability } from "./appwriteStore";

const savedEnvironment = { endpoint: process.env.APPWRITE_ENDPOINT, projectId: process.env.APPWRITE_PROJECT_ID, apiKey: process.env.APPWRITE_API_KEY };

afterEach(() => {
  process.env.APPWRITE_ENDPOINT = savedEnvironment.endpoint;
  process.env.APPWRITE_PROJECT_ID = savedEnvironment.projectId;
  process.env.APPWRITE_API_KEY = savedEnvironment.apiKey;
  vi.unstubAllGlobals();
});

describe("Appwrite provider availability", () => {
  it("persists a hidden provider game as availability policy rather than product data", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    const requests: Array<{ method?: string; body?: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      requests.push({ method: init?.method, body: String(init?.body ?? "") });
      if (init?.method === "GET") return new Response("", { status: 404 });
      return new Response(JSON.stringify({ $id: "availability" }), { status: 201 });
    }));

    await expect(updateAppwriteProviderAvailability({ kind: "game", providerId: "arena_of_valor_id", isActive: false })).resolves.toMatchObject({ hiddenGameIds: ["arena_of_valor_id"], hiddenSmmServiceIds: [] });
    const payload = requests.find((request) => request.method === "POST")?.body ?? "";
    expect(payload).toContain("provider_availability");
    expect(payload).toContain("arena_of_valor_id");
    expect(payload).not.toContain("server-only-test-key");
  });
});
