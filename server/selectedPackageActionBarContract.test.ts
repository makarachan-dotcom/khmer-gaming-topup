import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

describe("selected package mobile action bar", () => {
  it("uses the supplied Checkbox 08 Lottie asset, provider game artwork, a liquid-glass shell, and direct payment-preview launcher", () => {
    const layout = fs.readFileSync(path.join(projectRoot, "client/src/components/StorefrontLayout.tsx"), "utf8");
    const check = fs.readFileSync(path.join(projectRoot, "client/src/components/SelectedPackageCheck.tsx"), "utf8");
    expect(layout).toContain("isTopupRoute ? <SelectedProductActionBar");
    expect(layout).toContain("selected-product-action-bar--expanded");
    expect(layout).toContain("selected-product-action-bar--compact");
    expect(layout).toContain('onContinue={() => setLocation("/checkout/preview")}');
    expect(layout).toContain("onClick={onContinue}");
    expect(layout).toContain("បន្ត");
    expect(layout).toContain("disabled aria-disabled=\"true\"");
    expect(layout).toContain("ProviderGameArtwork");
    expect(layout).toContain("selected-product-action-bar");
    expect(layout).toContain("OverflowMarquee");
    expect(layout).not.toContain("onClear={clearSelectedProduct}");
    expect(check).toContain("lottieflow-checkbox-08_3f50ebb9.json");
    expect(check).toContain("text-slate-950");
    expect(check).toContain("prefers-reduced-motion");
  });
});
