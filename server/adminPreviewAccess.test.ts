import { afterEach, describe, expect, it } from "vitest";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";

const originalFzrEndpoint = process.env.FZR_CARDS_API_BASE_URL;
const originalFzrApiKey = process.env.FZR_CARDS_API_KEY;
const originalSmmEndpoint = process.env.SMMGLOB_API_URL;
const originalSmmApiKey = process.env.SMMGLOB_API_KEY;

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: `preview-${role}`,
      email: `${role}@example.test`,
      name: "Preview User",
      displayName: "Preview User",
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => {
  if (originalFzrEndpoint === undefined) delete process.env.FZR_CARDS_API_BASE_URL;
  else process.env.FZR_CARDS_API_BASE_URL = originalFzrEndpoint;
  if (originalFzrApiKey === undefined) delete process.env.FZR_CARDS_API_KEY;
  else process.env.FZR_CARDS_API_KEY = originalFzrApiKey;
  if (originalSmmEndpoint === undefined) delete process.env.SMMGLOB_API_URL;
  else process.env.SMMGLOB_API_URL = originalSmmEndpoint;
  if (originalSmmApiKey === undefined) delete process.env.SMMGLOB_API_KEY;
  else process.env.SMMGLOB_API_KEY = originalSmmApiKey;
});

describe("admin preview access", () => {
  it("rejects preview routes for ordinary members", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.previewGamePackages({ gameId: "mobile_legends_global" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.previewSmmServices()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows an administrator to access preview routes without touching customer identity validation", async () => {
    delete process.env.FZR_CARDS_API_BASE_URL;
    delete process.env.FZR_CARDS_API_KEY;
    delete process.env.SMMGLOB_API_URL;
    delete process.env.SMMGLOB_API_KEY;

    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.admin.previewGamePackages({ gameId: "mobile_legends_global" })).resolves.toEqual({ status: "unavailable", packages: [] });
    await expect(caller.admin.previewSmmServices()).resolves.toEqual({ status: "unavailable", services: [] });
  });
});
