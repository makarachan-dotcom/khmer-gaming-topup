import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  readZursSession: vi.fn(),
  readZursSessionFallbackProfile: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./zursSession", () => ({ readZursSession: mocks.readZursSession, readZursSessionFallbackProfile: mocks.readZursSessionFallbackProfile }));
vi.mock("./db", () => ({ getUserByOpenId: mocks.getUserByOpenId }));

import { createContext, isPublicProviderCatalogRequest } from "./_core/context";

describe("request context catalog resilience", () => {
  it("bypasses account-store resolution for public provider catalog procedures", async () => {
    expect(isPublicProviderCatalogRequest({ originalUrl: "/api/trpc/provider.gameDetails?batch=1", url: "/api/trpc/provider.gameDetails?batch=1" } as any)).toBe(true);
    expect(isPublicProviderCatalogRequest({ originalUrl: "/api/trpc/admin.fullCatalog?batch=1", url: "/api/trpc/admin.fullCatalog?batch=1" } as any)).toBe(false);

    const context = await createContext({ req: { headers: {}, protocol: "https", originalUrl: "/api/trpc/provider.games?batch=1", url: "/api/trpc/provider.games?batch=1" }, res: {} } as any);

    expect(context.user).toBeNull();
    expect(mocks.authenticateRequest).not.toHaveBeenCalled();
  });

  it("keeps public procedures reachable when optional Appwrite session lookup exceeds the read limit", async () => {
    mocks.authenticateRequest.mockRejectedValueOnce(new Error("managed auth unavailable"));
    mocks.readZursSessionFallbackProfile.mockResolvedValueOnce(null);
    mocks.readZursSession.mockResolvedValueOnce("zurs-owner");
    mocks.getUserByOpenId.mockRejectedValueOnce(new Error("Appwrite user store request failed with HTTP 402 (limit_databases_reads_exceeded)"));

    const context = await createContext({ req: { headers: {}, protocol: "https" }, res: {} } as any);

    expect(context.user).toBeNull();
  });
});
