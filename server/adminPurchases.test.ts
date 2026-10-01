import { describe, expect, it, vi } from "vitest";
import { adminPurchaseAudits, orders, orderStatusEvents } from "../drizzle/schema";
import { ADMIN_PURCHASE_PRICE_USD } from "@shared/adminPurchase";
import type { TrpcContext } from "./_core/context";

// Dummy code for tests only — never the real secret, which lives solely in
// Vercel's encrypted env storage.
const TEST_CODE = "test-secret-code";
process.env.ADMIN_TEST_PURCHASE_CODE = TEST_CODE;

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  fulfill: vi.fn(async () => ({ delivered: true })),
  packageRows: [] as any[],
  auditRows: [] as any[],
  inserts: [] as Array<{ table: string; values: any }>,
}));

function makeFakeDb() {
  return {
    select: (..._args: any[]) => ({
      from: (..._from: any[]) => ({
        innerJoin: (..._join: any[]) => ({
          where: (..._where: any[]) => ({
            limit: async (..._limit: any[]) => mocks.packageRows,
          }),
        }),
        where: async (..._where: any[]) => mocks.auditRows,
        orderBy: (..._order: any[]) => ({
          limit: async (..._limit: any[]) => mocks.auditRows,
        }),
      }),
    }),
    insert: (table: any) => ({
      values: async (values: any) => {
        const name =
          table === orders
            ? "orders"
            : table === orderStatusEvents
              ? "orderStatusEvents"
              : table === adminPurchaseAudits
                ? "adminPurchaseAudits"
                : "unknown";
        mocks.inserts.push({ table: name, values });
      },
    }),
  };
}

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return { ...actual, getDb: mocks.getDb, fulfillTopupOrder: mocks.fulfill };
});

vi.mock("./providerCatalog", async () => {
  const actual = await vi.importActual<typeof import("./providerCatalog")>("./providerCatalog");
  return { ...actual, resolveLiveProviderOffer: async () => null };
});

import { appRouter } from "./routers";
import { __resetPurchaseCodeAttempts, createAdminPurchase } from "./adminPurchases";

const testPackage = {
  game: {
    id: "game-ml",
    titleEn: "Mobile Legends",
    titleKh: "Mobile Legends",
    currencyLabel: "Diamonds",
    requiresZone: true,
  },
  package: {
    id: "pkg-86",
    amountLabel: "86 Diamonds",
    priceUsd: "5.00",
    basePriceUsd: "4.20",
    providerSource: "fzr_cards:mobile_legends:offer-86",
    isActive: true,
  },
};

function resetMocks(packageRows: any[] = [testPackage], auditRows: any[] = []) {
  mocks.packageRows = packageRows;
  mocks.auditRows = auditRows;
  mocks.inserts = [];
  mocks.fulfill.mockClear();
  mocks.getDb.mockReset();
  mocks.getDb.mockImplementation(async () => makeFakeDb());
  __resetPurchaseCodeAttempts();
  process.env.ADMIN_TEST_PURCHASE_CODE = TEST_CODE;
}

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
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("admin.createAdminPurchase auth", () => {
  it("(b) rejects unauthenticated callers with UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(anonCtx());
    await expect(
      caller.admin.createAdminPurchase({ packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: "x" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("(a) rejects logged-in non-admin callers with FORBIDDEN", async () => {
    const caller = appRouter.createCaller(memberCtx());
    await expect(
      caller.admin.createAdminPurchase({ packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: "x" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("createAdminPurchase", () => {
  it("(c) always charges exactly $0.01 regardless of the package real price", async () => {
    resetMocks();
    const result = await createAdminPurchase({
      adminUserId: 7,
      packageId: "pkg-86",
      playerId: "123456",
      zoneId: "1234",
      purchaseCode: TEST_CODE,
    });
    expect(result.amount).toBe("0.01");
    expect(result.amount).toBe(ADMIN_PURCHASE_PRICE_USD);
    const orderInsert = mocks.inserts.find(entry => entry.table === "orders");
    expect(orderInsert).toBeDefined();
    // The package's real catalog price is $5.00 — the order must not use it.
    expect(testPackage.package.priceUsd).toBe("5.00");
    expect(orderInsert!.values.subtotal).toBe("0.01");
    expect(orderInsert!.values.status).toBe("paid");
  });

  it("(d) flags the order as an admin purchase without blocking fulfillment", async () => {
    resetMocks();
    await createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: TEST_CODE });
    const orderInsert = mocks.inserts.find(entry => entry.table === "orders");
    const details = orderInsert!.values.details as Record<string, unknown>;
    expect(details.adminPurchase).toBe(true);
    expect(details.adminPriceUsd).toBe("0.01");
    expect(details.noPayment).toBe(true);
    // fulfillTopupOrder skips orders with details.testPurchase === true — the
    // admin purchase flag must be a different key so the top-up really executes.
    expect(details.testPurchase).not.toBe(true);
    expect(mocks.fulfill).toHaveBeenCalledTimes(1);
    expect(mocks.fulfill).toHaveBeenCalledWith(orderInsert!.values.id);
  });

  it("(e) writes an audit log row with admin, package, player and price", async () => {
    resetMocks();
    const result = await createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: TEST_CODE });
    const auditInsert = mocks.inserts.find(entry => entry.table === "adminPurchaseAudits");
    expect(auditInsert).toBeDefined();
    expect(auditInsert!.values.orderId).toBe(result.id);
    expect(auditInsert!.values.adminUserId).toBe(7);
    expect(auditInsert!.values.packageId).toBe("pkg-86");
    expect(auditInsert!.values.playerId).toBe("123456");
    expect(auditInsert!.values.priceUsd).toBe("0.01");
  });

  it("(g) the audit row stores the package's real catalog price for display", async () => {
    resetMocks();
    await createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: TEST_CODE });
    const auditInsert = mocks.inserts.find(entry => entry.table === "adminPurchaseAudits");
    expect(auditInsert).toBeDefined();
    // The panel shows "real price → $0.01" in history from this column.
    expect(testPackage.package.priceUsd).toBe("5.00");
    expect(auditInsert!.values.realPriceUsd).toBe("5.00");
    expect(auditInsert!.values.priceUsd).toBe("0.01");
  });

  it("(f) rejects the 21st admin purchase within 24h (rate limit)", async () => {
    resetMocks([testPackage], Array.from({ length: 20 }, (_, i) => ({ id: `audit-${i}` })));
    await expect(
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: TEST_CODE }),
    ).rejects.toMatchObject({ code: "ADMIN_PURCHASE_LIMIT" });
    // Nothing was created once the limit is hit.
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it("allows the 20th admin purchase within 24h", async () => {
    resetMocks([testPackage], Array.from({ length: 19 }, (_, i) => ({ id: `audit-${i}` })));
    const result = await createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: TEST_CODE });
    expect(result.amount).toBe("0.01");
    expect(mocks.inserts.some(entry => entry.table === "orders")).toBe(true);
  });

  it("rejects unknown packages and missing zone ids", async () => {
    resetMocks([], []);
    await expect(
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-missing", playerId: "123456", purchaseCode: TEST_CODE }),
    ).rejects.toThrow("unavailable");

    resetMocks();
    await expect(
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", purchaseCode: TEST_CODE }),
    ).rejects.toThrow("zone");
  });

  it("rejects a wrong purchase code and creates nothing", async () => {
    resetMocks();
    await expect(
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: "wrong-code" }),
    ).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_INVALID" });
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.fulfill).not.toHaveBeenCalled();
  });

  it("fails closed when the purchase code env var is not configured", async () => {
    resetMocks();
    delete process.env.ADMIN_TEST_PURCHASE_CODE;
    await expect(
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: TEST_CODE }),
    ).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_UNCONFIGURED" });
    expect(mocks.inserts).toHaveLength(0);
  });

  it("locks out after 5 wrong codes per 15 minutes, even for the right code", async () => {
    resetMocks();
    const attempt = (code: string) =>
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: code });
    for (let i = 0; i < 5; i++) {
      await expect(attempt("wrong-code")).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_INVALID" });
    }
    // 6th attempt with the CORRECT code is still rejected until the window passes.
    await expect(attempt(TEST_CODE)).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_LOCKED" });
    expect(mocks.inserts).toHaveLength(0);
  });

  it("a correct code resets the wrong-attempt counter", async () => {
    resetMocks();
    const attempt = (code: string) =>
      createAdminPurchase({ adminUserId: 7, packageId: "pkg-86", playerId: "123456", zoneId: "1234", purchaseCode: code });
    for (let i = 0; i < 4; i++) {
      await expect(attempt("wrong-code")).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_INVALID" });
    }
    const result = await attempt(TEST_CODE);
    expect(result.amount).toBe("0.01");
    // Counter was cleared by the success: 5 more wrong codes needed to lock.
    for (let i = 0; i < 5; i++) {
      await expect(attempt("wrong-code")).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_INVALID" });
    }
    await expect(attempt(TEST_CODE)).rejects.toMatchObject({ code: "ADMIN_PURCHASE_CODE_LOCKED" });
  });
});
