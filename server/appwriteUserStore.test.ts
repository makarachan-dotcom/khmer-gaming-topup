import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppwriteCustomerOrders, getAppwriteCustomerPaymentHistory, getAppwriteUserByOpenId, isAppwriteStoreConfigured, shouldRetryAppwriteCreateAsUpdate, updateAppwriteUserDisplayName } from "./appwriteStore";
import { isSingleAdminEmail } from "./storefrontDomain";

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

describe("Appwrite user store", () => {
  it("recognizes a complete set of server-only Appwrite credentials", () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    expect(isAppwriteStoreConfigured()).toBe(true);
  });

  it("exports account-history readers for Appwrite-backed Vercel sessions", () => {
    expect(typeof getAppwriteCustomerOrders).toBe("function");
    expect(typeof getAppwriteCustomerPaymentHistory).toBe("function");
  });

  it("resolves a signed-in user directly from its deterministic Appwrite document", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    const openId = "google:new-member";
    const user = {
      id: 1_000_000_123,
      openId,
      name: "New Member",
      displayName: null,
      email: "member@example.com",
      loginMethod: "google",
      role: "user",
      createdAt: new Date("2026-08-21T00:00:00.000Z").toISOString(),
      updatedAt: new Date("2026-08-21T00:00:00.000Z").toISOString(),
      lastSignedIn: new Date("2026-08-21T00:00:00.000Z").toISOString(),
    };
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      expect(url).toContain("/databases/zurs_store/collections/zurs_records/documents/");
      expect(url).not.toContain("?limit=100");
      return new Response(JSON.stringify({ $id: "user-document", sourceTable: "users", sourceId: openId, payload: JSON.stringify(user) }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const resolved = await getAppwriteUserByOpenId(openId);

    expect(resolved).toMatchObject({ openId, email: "member@example.com", role: "user" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("updates a member profile without consuming an Appwrite read", async () => {
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "server-only-test-key";
    const openId = "google:new-member";
    const currentUser = {
      id: 1_000_000_123,
      openId,
      name: "New Member",
      displayName: null,
      email: "member@example.com",
      loginMethod: "google",
      role: "user",
      createdAt: new Date("2026-08-21T00:00:00.000Z"),
      updatedAt: new Date("2026-08-21T00:00:00.000Z"),
      lastSignedIn: new Date("2026-08-21T00:00:00.000Z"),
    };
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      expect(url).toContain("/databases/zurs_store/collections/zurs_records/documents");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toMatchObject({ data: { sourceTable: "users", sourceId: openId } });
      return new Response(JSON.stringify({}), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateAppwriteUserDisplayName({ user: currentUser, displayName: "Makara ZURS Member" })).resolves.toEqual({ displayName: "Makara ZURS Member" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("recognizes the owner email as the single ZURS STORE administrator", () => {
    expect(isSingleAdminEmail("ChanMakara672@gmail.com")).toBe(true);
  });

  it("retries an Appwrite duplicate-document create as an idempotent update", () => {
    expect(shouldRetryAppwriteCreateAsUpdate(new Error("Appwrite user store request failed with HTTP 409"))).toBe(true);
    expect(shouldRetryAppwriteCreateAsUpdate(new Error("Appwrite user store request failed with HTTP 500"))).toBe(false);
  });
});
