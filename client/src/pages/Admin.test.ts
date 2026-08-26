import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin-only MLBB test offer", () => {
  it("keeps the $0.01 offer inside the restricted admin catalog as a non-purchasable preview", () => {
    const adminPage = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");

    expect(adminPage).toContain("function AdminOnlyMlbbTestOffer()");
    expect(adminPage).toContain("Mobile Legends — KHQR Test Package");
    expect(adminPage).toContain("$0.01 USD");
    expect(adminPage).toContain("PREVIEW • មិនអាចទិញបាន");
    expect(adminPage).toContain("មិនអាចបង្កើត order, KHQR ឬការកាត់ប្រាក់បានឡើយ");
    expect(adminPage).toContain("if (!isAdmin) return <AdminDenied />");
    expect(adminPage).not.toContain("createTopup");
    expect(router).not.toContain("adminCreateMlbbTestOrder");
  });
});
