import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasDelegatedAdminPermission, normalizeDelegatedAdminPermissions } from "./adminPermissions";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("delegated Admin permissions", () => {
  it("accepts only known scopes and removes duplicates", () => {
    expect(normalizeDelegatedAdminPermissions(["orders", "media", "orders", "payment-control", 5])).toEqual(["orders", "media"]);
    expect(hasDelegatedAdminPermission(["orders"], "orders")).toBe(true);
    expect(hasDelegatedAdminPermission(["orders"], "catalog")).toBe(false);
  });

  it("preserves an Owner-approved delegated Admin role during ordinary sign-in updates", () => {
    const db = source("server/db.ts");
    expect(db).toContain("A sign-in refresh must never demote an Owner-approved delegated Admin");
    expect(db).not.toContain('const role = isSingleAdminEmail(email) ? "admin" : "user";');
    expect(db).toContain('if (isSingleAdminEmail(email)) {');
  });

  it("enforces scopes in server procedures and keeps owner-only controls unavailable to delegated Admins", () => {
    const router = source("server/routers.ts");
    const db = source("server/db.ts");
    const guard = source("server/_core/trpc.ts");
    expect(guard).toContain("getDelegatedAdminPermissions(ctx.user.id)");
    expect(guard).toContain("The owner has not granted access to this Admin section.");
    expect(router).toContain('orders: scopedAdminProcedure("orders")');
    expect(router).toContain('catalog: scopedAdminProcedure("catalog")');
    expect(router).toContain('gameImages: scopedAdminProcedure("media")');
    expect(router).toContain('operationUsers: scopedAdminProcedure("operations")');
    expect(router).toContain('payments: scopedAdminProcedure("operations")');
    expect(router).toContain("paymentControl: ownerProcedure");
    expect(router).toContain("setUserRole: ownerProcedure");
    expect(router).toContain("setUserPermissions: ownerProcedure");
    expect(router).toContain("grantUserAdminAccess: ownerProcedure");
    expect(db).toContain("grantDelegatedAdminAccess");
    expect(db).toContain("await db.transaction(async (tx) => {");
  });

  it("filters the client navigation using the same self-permission contract", () => {
    const dashboard = source("client/src/components/DashboardLayout.tsx");
    const adminAccess = source("client/src/pages/AdminAccess.tsx");
    expect(dashboard).toContain("trpc.admin.myPermissions.useQuery");
    expect(dashboard).toContain("visibleMenuItems");
    expect(dashboard).toContain('path: "/admin?tab=operations", permission: "operations"');
    expect(dashboard).toContain("ownerOnly: true");
    expect(adminAccess).toContain('setNextRole("admin")');
    expect(adminAccess).toContain("trpc.admin.grantUserAdminAccess.useMutation");
  });
});
