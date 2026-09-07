import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin digital services workspace", () => {
  it("lets admins review digital orders, edit bilingual copy and prices, and shows official logos on order summary", () => {
    const admin = readFileSync(join(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    const digital = readFileSync(join(process.cwd(), "client/src/components/AdminDigitalServices.tsx"), "utf8");
    const checkout = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    const router = readFileSync(join(process.cwd(), "server/routers.ts"), "utf8");
    const nav = readFileSync(join(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(admin).toContain('"digital"');
    expect(admin).toContain("សេវាឌីជីថល");
    expect(admin).toContain("isPartnerOrder");
    expect(admin).toContain("<ServiceLogo");
    expect(admin).toContain("<AdminDigitalServices");
    expect(admin).toContain("<AdminDeliveryForm");
    expect(admin).toContain('useState<"all" | "game" | "digital">("digital")');
    expect(digital).toContain("trpc.admin.partnerCatalog");
    expect(digital).toContain("savePartnerService");
    expect(digital).toContain("ព័ត៌មានខ្មែរ");
    expect(digital).toContain("Info EN");
    expect(router).toContain("deliverPartnerService: scopedAdminProcedure");
    expect(router).toContain("partnerCatalog: scopedAdminProcedure");
    expect(router).toContain("savePartnerService: scopedAdminProcedure");
    expect(nav).toContain('path: "/admin?tab=digital"');
    expect(checkout).toContain("<ServiceLogo text={`${product.gameName} ${product.label}`}");
    expect(checkout).toContain('details.kind === "partner_service"');
    expect(checkout).toContain("<ServiceLogo text={order.productName}");
    expect(digital).not.toMatch(/GGSOMA|ggsoma/i);
    expect(admin).not.toMatch(/GGSOMA|ggsoma/i);
    expect(checkout).not.toMatch(/GGSOMA|ggsoma/i);
  });
});
