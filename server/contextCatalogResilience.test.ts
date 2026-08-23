import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  readZursSession: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({ sdk: { authenticateRequest: mocks.authenticateRequest } }));
vi.mock("./zursSession", () => ({ readZursSession: mocks.readZursSession }));
vi.mock("./db", () => ({ getUserByOpenId: mocks.getUserByOpenId }));

import { createContext } from "./_core/context";

describe("request context catalog resilience", () => {
  it("keeps public procedures reachable when optional Appwrite session lookup exceeds the read limit", async () => {
    mocks.authenticateRequest.mockRejectedValueOnce(new Error("managed auth unavailable"));
    mocks.readZursSession.mockResolvedValueOnce("zurs-owner");
    mocks.getUserByOpenId.mockRejectedValueOnce(new Error("Appwrite user store request failed with HTTP 402 (limit_databases_reads_exceeded)"));

    const context = await createContext({ req: { headers: {}, protocol: "https" }, res: {} } as any);

    expect(context.user).toBeNull();
  });
});
