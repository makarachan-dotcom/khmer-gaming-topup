import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "", forgeApiKey: "" } }));
import { isAppwriteMediaKey, storageGet, storagePut } from "./storage";

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

describe("marketplace storage", () => {
  it("uses the server-only Appwrite project when Forge storage is unavailable", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";

    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/storage/buckets/zurs_media") && (init?.method ?? "GET") === "GET") {
        return new Response("", { status: 404 });
      }
      if (url.endsWith("/storage/buckets") && init?.method === "POST") {
        expect(JSON.parse(String(init.body))).toMatchObject({ bucketId: "zurs_media", maximumFileSize: 5 * 1024 * 1024 });
        return new Response(JSON.stringify({ $id: "zurs_media" }), { status: 201 });
      }
      if (url.endsWith("/storage/buckets/zurs_media/files") && init?.method === "POST") {
        expect(init.body).toBeInstanceOf(FormData);
        return new Response(JSON.stringify({ $id: "stored-image" }), { status: 201 });
      }
      throw new Error(`Unexpected request ${init?.method ?? "GET"} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const uploaded = await storagePut("marketplace-listings-private/100/screenshot.png", new Uint8Array([1, 2, 3]), "image/png");

    expect(uploaded.key).toMatch(/^appwrite\/zurs_media\//);
    expect(uploaded.url).toBe(`/manus-storage/${uploaded.key}`);
    expect(isAppwriteMediaKey(uploaded.key)).toBe(true);
    await expect(storageGet(uploaded.key)).resolves.toEqual({ key: uploaded.key, url: uploaded.url });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
