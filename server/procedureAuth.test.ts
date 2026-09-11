import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function anonCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {}, originalUrl: "/api/trpc", url: "/api/trpc" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function memberCtx(): TrpcContext {
  return {
    user: {
      id: 42,
      openId: "member-open-id",
      email: "member@example.test",
      name: "Member",
      displayName: "Member",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {}, originalUrl: "/api/trpc", url: "/api/trpc" } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("server procedure auth", () => {
  it("rejects unauthenticated admin calls with UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.admin.orders()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects logged-in non-admin admin calls with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(memberCtx());
    await expect(caller.admin.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.admin.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects unauthenticated order creation and payment start", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.orders.createTopup({ packageId: "pkg-ml-86", playerId: "123456", quantity: 1 })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.orders.beginPayment({ orderId: "order-not-yours" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.orders.mine()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(caller.wallet.summary()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("keeps public auth.me available without a session", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(caller.auth.me()).resolves.toBeNull();
  });
});
