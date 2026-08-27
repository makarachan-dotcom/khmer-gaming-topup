import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const categoryMocks = vi.hoisted(() => ({
  get: vi.fn(async () => [{ gameId: "mobile_legends_global", offerId: "fzr-offer-1", categoryLabel: "Weekly Card" }]),
  save: vi.fn(async (input: { gameId: string; offerId: string; categoryLabel: string; updatedByUserId: number }) => ({ success: true, categoryLabel: input.categoryLabel })),
  reset: vi.fn(async () => ({ success: true, reset: true })),
}));

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    getDelegatedAdminPermissions: vi.fn(async () => ["catalog"]),
    getProviderPackageCategoryOverrides: categoryMocks.get,
    saveProviderPackageCategoryOverride: categoryMocks.save,
    resetProviderPackageCategoryOverride: categoryMocks.reset,
  };
});

import { appRouter } from "./routers";

function createContext(role: "admin" | "user"): TrpcContext {
  return {
    user: {
      id: 42,
      openId: `category-${role}`,
      email: `${role}@example.test`,
      name: "Category User",
      displayName: "Category User",
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

describe("package category routes", () => {
  it("returns only display category mappings through the public query", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.provider.packageCategories({ gameId: "mobile_legends_global" })).resolves.toEqual([
      { gameId: "mobile_legends_global", offerId: "fzr-offer-1", categoryLabel: "Weekly Card" },
    ]);
  });

  it("rejects category assignment for ordinary members", async () => {
    const caller = appRouter.createCaller(createContext("user"));
    await expect(caller.admin.savePackageCategory({ gameId: "mobile_legends_global", offerId: "fzr-offer-1", categoryLabel: "Weekly Card" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.resetPackageCategory({ gameId: "mobile_legends_global", offerId: "fzr-offer-1" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows Catalog Admins to assign and reset a display-only category", async () => {
    const caller = appRouter.createCaller(createContext("admin"));
    await expect(caller.admin.savePackageCategory({ gameId: "mobile_legends_global", offerId: "fzr-offer-1", categoryLabel: "Weekly Card" })).resolves.toEqual({ success: true, categoryLabel: "Weekly Card" });
    await expect(caller.admin.resetPackageCategory({ gameId: "mobile_legends_global", offerId: "fzr-offer-1" })).resolves.toEqual({ success: true, reset: true });
    expect(categoryMocks.save).toHaveBeenCalledWith({ gameId: "mobile_legends_global", offerId: "fzr-offer-1", categoryLabel: "Weekly Card", updatedByUserId: 42 });
  });
});
