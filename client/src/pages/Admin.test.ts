import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("owner-only KHQR test offer", () => {
  it("keeps the real $0.02 test product restricted to the Owner and clearly guarded before payment is started", () => {
    const adminPage = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(adminPage).toContain("function AdminOnlyMlbbTestOffer({ isOwner }");
    expect(adminPage).toContain("Mobile Legends — KHQR Test Package");
    expect(adminPage).toContain("TEST • KHQR $0.02");
    expect(adminPage).toContain("$0.02 USD");
    expect(adminPage).toContain("trpc.orders.createAdminKhqrTest.useMutation");
    expect(adminPage).toContain("trpc.orders.beginPayment.useMutation");
    expect(adminPage).toContain('if (!isOwner || !acknowledged || busy) return;');
    expect(adminPage).toContain('isOwner ? "បង្កើត KHQR Test $0.02" : "Owner only"');
    expect(router).toContain("createAdminKhqrTest: ownerProcedure");
    expect(db).toContain("noProviderFulfillment");
  });

  it("keeps the homepage payment location editable only through the Owner operations view", () => {
    const adminPage = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    expect(adminPage).toContain("function PaymentLocationSettings()");
    expect(adminPage).toContain('contentKey: "payment-location"');
    expect(adminPage).toContain("HOMEPAGE PAYMENT LOCATION");
    expect(adminPage).toContain("utils.content.active.invalidate()");
    expect(adminPage).toContain("isOwner ? <PaymentLocationSettings /> : null");
  });
});
