import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("partner product pay sheet", () => {
  it("portals the pay card above the mobile tab bar instead of rendering under it", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/PartnerServicesShelf.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('from "react-dom"');
    expect(componentSource).toContain("createPortal");
    expect(componentSource).toContain("product-sheet-open");
    expect(componentSource).toContain("zurs-product-sheet__cta");
    expect(componentSource).toContain("ទិញឥឡូវ");
    expect(styleSource).toContain("bottom: calc(4.75rem + env(safe-area-inset-bottom))");
    expect(styleSource).toContain(".zurs-product-sheet__cta");
    expect(styleSource).toContain("body.product-sheet-open .storefront-scroll-top");
    expect(styleSource).toContain("z-index: 320");
  });
});
