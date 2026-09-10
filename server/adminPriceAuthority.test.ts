import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertPackagePriceIntegrity } from "./paymentSecurity";

const project = process.cwd();
const read = (path: string) => readFileSync(resolve(project, path), "utf8");

/**
 * One rule, one number.
 *
 * `gamePackages.priceUsd` is the price the owner sets in Admin Pricing. It is
 * what the storefront prints on the package card, what `createTopupOrder` writes
 * as the order subtotal, and what `beginStagedPayment` hands to Bakong when the
 * KHQR is minted. These tests pin that chain so no surface can drift into
 * showing or charging a different amount.
 */
describe("admin price authority", () => {
  it("stores the admin's set price and drops the cached storefront projection", () => {
    const db = read("server/db.ts");
    const catalog = read("server/providerCatalog.ts");

    // Admin Pricing edits base price + margin; the stored sale price is derived
    // from them, and that stored column is the one every reader uses.
    expect(db).toContain("export async function updateGamePackage(input: { packageId: string; basePriceUsd: string; profitMarginPercent: string; isActive: boolean; featured: boolean })");
    expect(db).toContain("priceUsd: salePriceFromMargin(input.basePriceUsd, input.profitMarginPercent)");
    expect(db).toContain("await invalidateStorefrontPriceCaches();");
    expect(db).toContain("export async function updateSmmTier");
    // The server-side projection cache must have a purge hook, otherwise a saved
    // price could stay invisible for the whole cache window.
    expect(catalog).toContain("export function invalidateProviderStorefrontCaches()");
    expect(catalog).toContain("adminCatalogCache = null;");
  });

  it("serves the storefront label from priceUsd with no other price source", () => {
    const db = read("server/db.ts");
    const catalog = read("server/providerCatalog.ts");

    const storefrontProjection = "priceLabel: `$${Number(item.priceUsd).toFixed(2)}`";
    expect(db).toContain(storefrontProjection);
    expect(catalog).toContain(storefrontProjection);
    // The live provider offer price is only ever a fallback label for rows that
    // have not been synced yet; it is never mixed into a synced row's label.
    expect(catalog).toContain("priceLabel: `$${Number(catalogItem.priceUsd).toFixed(2)}`");
    expect(catalog).toContain("const row = rows.get(item.id);");
  });

  it("builds the order total from the catalogue row the buyer was shown", () => {
    const db = read("server/db.ts");
    const create = db.slice(db.indexOf("export async function createTopupOrder"), db.indexOf("const adminKhqrTestProduct"));
    expect(create).toContain("const item = await resolvePurchasableTopupPackage(input.packageId);");
    expect(create).toContain("const priceCheck = assertPackagePriceIntegrity({");
    expect(create).toContain("priceUsd: item.package.priceUsd,");
    expect(create).toContain("shopLadderUnitPriceForPackage");
    expect(create).toContain("const subtotal = ((unitMinor * input.quantity) / 100).toFixed(2);");
    expect(create).toContain("subtotal,");
    // The client can never post its own price.
    expect(read("server/routers.ts")).toContain("createTopup: protectedProcedure.input(z.object({ packageId: z.string().min(4).max(64), playerId: z.string().trim().min(2).max(128)");
    expect(read("server/routers.ts")).not.toContain("priceLabel: z.string()");
  });

  it("mints the KHQR for exactly the stored order subtotal", () => {
    const db = read("server/db.ts");
    const staged = db.slice(db.indexOf("export async function beginStagedPayment"), db.indexOf("export async function getCustomerPaymentSession"));
    expect(staged).toContain("assertOrderAmountIntegrity({ amount: String(order[0].subtotal), currency });");
    expect(staged).toContain("await createBakongKhqrPayment({ trackingCode: order[0].trackingCode, amount: String(order[0].subtotal), currency });");
    // A cached QR may only be reused while it still encodes the current amount.
    expect(staged).toContain("const amountStillCurrent = existing[0] ? Number(existing[0].amount) === Number(order[0].subtotal) && existing[0].currency === currency : false;");
    expect(read("server/bakongKhqr.ts")).toContain("amount");
  });

  it("keeps the admin-set price intact through the order validator", () => {
    // base 0.99 + 15% => 1.14, which is what the card said and what the QR encodes.
    expect(assertPackagePriceIntegrity({ priceUsd: "1.14", basePriceUsd: "0.99", profitMarginPercent: "15", quantity: 1 })).toEqual({ subtotal: "1.14", subtotalMinor: 114 });
    expect(assertPackagePriceIntegrity({ priceUsd: "1.14", basePriceUsd: "0.99", profitMarginPercent: "15", quantity: 3 }).subtotal).toBe("3.42");
    // A margin edit that was never saved to priceUsd is refused before any money moves.
    expect(() => assertPackagePriceIntegrity({ priceUsd: "1.00", basePriceUsd: "0.99", profitMarginPercent: "15", quantity: 1 })).toThrowError();
  });

  it("broadcasts an admin price save so open storefronts drop their cached price", () => {
    const admin = read("client/src/pages/AdminPricing.tsx");
    const topup = read("client/src/pages/GameTopup.tsx");
    expect(admin).toContain('import { notifyPackagePricingChanged } from "@/lib/packagePricingBroadcast";');
    expect(admin).toContain("utils.provider.packagePreview.invalidate();");
    expect(admin).toContain("notifyPackagePricingChanged();");
    expect(topup).toContain('import { subscribeToPackagePricingChanges } from "@/lib/packagePricingBroadcast";');
    expect(topup).toContain("void utils.provider.packagePreview.invalidate();");
  });
});
