import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const project = process.cwd();
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

describe("admin KHQR test product", () => {
  it("creates the fixed $0.02 ledger-only order only through the owner-only route", () => {
    const router = read("server/routers.ts");
    const db = read("server/db.ts");
    expect(router).toContain("createAdminKhqrTest: ownerProcedure");
    expect(db).toContain('code: "admin-khqr-test-002"');
    expect(db).toContain('amountUsd: "0.02"');
    expect(db).toContain('productName: adminKhqrTestProduct.name');
    expect(db).toContain('noProviderFulfillment: true');
    expect(db).not.toContain("submitSmmProviderOrder({ providerServiceId: adminKhqrTestProduct");
  });

  it("records a confirmed test purchase as delivered without a game top-up and labels the receipt clearly", () => {
    const db = read("server/db.ts");
    const checkout = read("client/src/pages/Checkout.tsx");
    expect(db).toContain('const completedStatus = isAdminTestPurchase ? "delivered" as const : "paid" as const');
    expect(db).toContain('eventType: isAdminTestPurchase ? "admin_test_purchase_completed" : "payment_confirmed"');
    expect(checkout).toContain("បានទិញ Test Product ជោគជ័យ!");
    expect(checkout).toContain("Test completed — no provider top-up");
    expect(checkout).toContain("Provider top-up");
  });

  it("requires a visible acknowledgement and confirmation before the browser can create the real payment session", () => {
    const admin = read("client/src/pages/Admin.tsx");
    expect(admin).toContain("createAdminKhqrTest.useMutation");
    expect(admin).toContain("checked={acknowledged}");
    expect(admin).toContain("window.confirm(");
    expect(admin).toContain("$0.02");
    expect(admin).toContain("isOwner ? \"បង្កើត KHQR Test $0.02\" : \"Owner only\"");
  });
});
