import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("streamdown", () => ({ Streamdown: () => null }));
import { isProtectedMediaTarget } from "./StorefrontLayout";

class MediaElement {
  constructor(private readonly media: boolean) {}
  closest(selector: string) { return this.media && selector === "img, video" ? this : null; }
}

describe("storefront media protection", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("recognizes only image and video targets for unobtrusive interaction safeguards", () => {
    vi.stubGlobal("Element", MediaElement);
    expect(isProtectedMediaTarget(new MediaElement(true))).toBe(true);
    expect(isProtectedMediaTarget(new MediaElement(false))).toBe(false);
    expect(isProtectedMediaTarget(null)).toBe(false);
  });

  it("removes the unwanted Wireframe OUTLINE decoration from the header", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).not.toContain("fx-contour");
    expect(componentSource).not.toContain("OUTLINE");
    expect(styleSource).not.toContain(".fx-contour");
  });

  it("uses a compact animated ZURS.me wordmark rather than the former Topographic brand", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('className="fx-zurs-me"');
    expect(componentSource).toContain('aria-label="ZURS.me"');
    expect(componentSource).not.toContain("fx-topographic");
    expect(styleSource).toContain(".fx-zurs-me");
    expect(styleSource).toContain("zurs-letter-settle");
    expect(styleSource).not.toContain(".fx-topographic");
  });

  it("removes the Gaming & Digital subtitle and retains a clean AI-free mobile tab bar", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).not.toContain("GAMING &amp; DIGITAL");
    expect(componentSource).toContain("zurs-mobile-tabbar");
    expect(componentSource).toContain("zurs-mobile-tab--active");
    expect(componentSource).not.toContain('label: "AI"');
    expect(styleSource).toContain("zurs-particle-field");
  });

  it("moves a pill indicator between the three mobile tabs including Live", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("zurs-mobile-tab-indicator");
    expect(componentSource).toContain('"--mobile-tab-index": activeMobileTabIndex');
    expect(styleSource).toContain("--mobile-tab-index");
    expect(styleSource).toContain("width: calc((100% - 1rem) / 3)");
    expect(componentSource).toContain('href: "/live-spin"');
    expect(componentSource).toContain("zurs-mobile-tab-label");
    expect(styleSource).toContain("zurs-mobile-tabbar--live");
    expect(styleSource).toContain("zurs-mobile-tab-indicator-enter");
    expect(styleSource).toContain("tab-icon-active");
  });

  it("uses a compact three-item rounded mobile tab bar with a Live entry and no public AI entry", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("hidden h-11 w-11");
    expect(componentSource).toContain("grid h-14 w-[min(calc(100vw-1.5rem),21rem)] -translate-x-1/2 grid-cols-3");
    expect(componentSource).toContain("gap-0.5");
    expect(componentSource).not.toContain('href: "/ai"');
    expect(componentSource).toContain("rounded-full");
    expect(styleSource).toContain("border-radius: 999px");
  });

  it("uses a matching rounded top header without changing desktop controls", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("zurs-compact-header sticky top-2");
    expect(componentSource).toContain("rounded-[1.25rem]");
    expect(styleSource).toContain("position: sticky !important");
    expect(styleSource).toContain("z-index: 70 !important");
  });

  it("uses a banner-aligned particle field with staggered reduced-motion-safe twinkles", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("zurs-particle-field");
    expect(componentSource).toContain("particleSlots");
    expect(styleSource).toContain("zurs-particle-twinkle");
    expect(styleSource).toContain("prefers-reduced-motion: no-preference");
    expect(styleSource).toContain("oklch(0.19 0.08 261)");
  });

  it("uses Kantumruy Pro for the storefront and Hanuman for long Khmer copy", () => {
    const documentSource = readFileSync(join(process.cwd(), "client/index.html"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(documentSource).toContain("family=Hanuman");
    expect(documentSource).toContain("family=Kantumruy+Pro");
    expect(styleSource).toContain('font-family: "Hanuman", "Kantumruy Pro"');
    expect(styleSource).toContain("prefers-reduced-motion: no-preference");
  });

  it("docks the Contact Admin control above storefront actions and locks the mobile viewport scale", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const contactSource = readFileSync(join(process.cwd(), "client/src/components/ContactAdminControl.tsx"), "utf8");
    const documentSource = readFileSync(join(process.cwd(), "client/index.html"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("<ContactAdminControl paymentBarVisible={isTopupRoute} />");
    expect(contactSource).toContain("ទំនាក់ទំនង Admin");
    expect(contactSource).toContain("Asia/Phnom_Penh");
    expect(contactSource).toContain("https://t.me/");
    expect(documentSource).toContain("user-scalable=no");
    expect(documentSource).toContain("maximum-scale=1.0");
    expect(styleSource).toContain(".contact-admin-layer");
    expect(styleSource).toContain(".contact-admin-fab--payment");
    expect(styleSource).toContain("touch-action: pan-x pan-y");
  });

  it("routes selected packages directly to the payment preview page and keeps KHQR creation behind final confirmation", () => {
    const layoutSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const checkoutSource = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(layoutSource).toContain('onContinue={() => setLocation("/checkout/preview")}');
    expect(layoutSource).toContain("paymentMethodName={selectedPaymentMethod?.name ?? null}");
    expect(layoutSource).toContain("សូមជ្រើសវិធីបង់ប្រាក់");
    expect(layoutSource).toContain("title=\"សូមជ្រើសវិធីបង់ប្រាក់នៅខាងលើកញ្ចប់\"");
    expect(checkoutSource).toContain('const preview = orderId === "preview"');
    expect(checkoutSource).toContain("<PaymentPreview product={selectedProduct}");
    expect(checkoutSource).toContain("បញ្ជាក់ និងបង្កើត KHQR");
    expect(checkoutSource).toContain("trpc.orders.createTopup.useMutation()");
    expect(checkoutSource).toContain("trpc.orders.beginPayment.useMutation()");
    expect(checkoutSource).toContain("setLocation(`/checkout/${session.order.id}`)");
    expect(styleSource).toContain(".checkout-preview-hero");
    expect(styleSource).toContain(".checkout-preview-confirm");
  });
});
