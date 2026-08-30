import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("selected checkout context recovery", () => {
  it("persists only the selected package and KHQR method within the current browser tab for preview recovery", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/contexts/SelectedProductContext.tsx"), "utf8");

    expect(source).toContain('const checkoutContextStorageKey = "zurs.checkout.preview.v1"');
    expect(source).toContain("window.sessionStorage.getItem(checkoutContextStorageKey)");
    expect(source).toContain("window.sessionStorage.setItem(checkoutContextStorageKey, JSON.stringify(value))");
    expect(source).toContain("selectedProduct: isSelectedProduct(parsed?.selectedProduct) ? parsed.selectedProduct : null");
    expect(source).toContain('selectedPaymentMethodId: typeof parsed?.selectedPaymentMethodId === "string" ? parsed.selectedPaymentMethodId : null');
    expect(source).toContain("window.sessionStorage.removeItem(checkoutContextStorageKey)");
  });

  it("clears the recovery context on package reset and keeps QR/order creation behind final confirmation", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/contexts/SelectedProductContext.tsx"), "utf8");
    const checkout = readFileSync(resolve(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");

    expect(source).toContain("const next = { selectedProduct: null, selectedPaymentMethodId: null }");
    expect(checkout).toContain("if (!product?.playerId)");
    expect(checkout).toContain("await createTopup.mutateAsync");
    expect(checkout).toContain("បញ្ជាក់ និងបង្កើត KHQR");
  });
});
