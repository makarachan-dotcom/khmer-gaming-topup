import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("streamdown", () => ({ Streamdown: () => null }));
import { isProtectedMediaTarget, mobileTabHrefForPath } from "./StorefrontLayout";

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

  it("uses the animated Font Emoji ZURS.me wordmark rather than the former Topographic brand", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('<FontEmojiBrand text="ZURS.me"');
    expect(componentSource).toContain('aria-label="ZURS.me"');
    expect(componentSource).not.toContain("fx-topographic");
    expect(styleSource).toContain(".font-emoji-brand");
    expect(styleSource).toContain(".font-emoji-brand__letter");
    expect(styleSource).not.toContain(".fx-topographic");
  });

  it("keeps AnimatedGlyph hooks unconditional before the activity-only fast path", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/AnimatedGlyph.tsx"), "utf8");
    expect(componentSource.indexOf("useState")).toBeLessThan(componentSource.indexOf('name === "activity"'));
    expect(componentSource.indexOf("useEffect")).toBeLessThan(componentSource.indexOf('name === "activity"'));
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

  it("keeps a clean two-tab mobile bar after the Live Spin giveaway was retired", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).not.toContain("zurs-mobile-tab-indicator");
    expect(componentSource).not.toContain('"--mobile-tab-index": activeMobileTabIndex');
    expect(styleSource).toContain(".zurs-mobile-tab--active");
    expect(componentSource).not.toContain('href: "/live-spin"');
    expect(componentSource).toContain("zurs-mobile-tab-label");
    expect(componentSource).toContain("zurs-tab-glyph");
    expect(componentSource).not.toContain("zurs-tab-live-ping");
    expect(componentSource).toContain('const tabKind = href === "/" ? "home" : "account";');
    expect(componentSource).toContain("zurs-mobile-tab--${tabKind}");
    expect(componentSource).not.toContain("zurs-mobile-tabbar--live");
    expect(styleSource).not.toContain("zurs-mobile-tab-indicator-enter");
    expect(styleSource).toContain("tab-icon-active");
    expect(styleSource).toContain("zurs-tab-glyph-pop");
    expect(styleSource).toContain("zurs-tab-glyph-bob");
    expect(styleSource).toContain("@media (prefers-reduced-motion: no-preference)");
  });

  it("keeps Home active across Top-up paths and assigns account-owned routes to Account", () => {
    expect(mobileTabHrefForPath("/")).toBe("/");
    expect(mobileTabHrefForPath("/topup/mobile_legends")).toBe("/");
    expect(mobileTabHrefForPath("/topup/blood_strike?from_webdev=1")).toBe("/");
    expect(mobileTabHrefForPath("/live-spin?from=tabbar")).toBe("/");
    expect(mobileTabHrefForPath("/live-spin/archive")).toBe("/");
    expect(mobileTabHrefForPath("/account")).toBe("/account");
    expect(mobileTabHrefForPath("/wallet")).toBe("/account");
  });

  it("lets a long-press on the tab bar scrub left and right to another page", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    expect(componentSource).toContain("TAB_LONG_PRESS_MS");
    expect(componentSource).toContain("TAB_SCRUB_PX");
    expect(componentSource).toContain("onBarPointerDown");
    expect(componentSource).toContain("is-scrubbing");
    expect(componentSource).toContain("goToTabAtX");
    expect(componentSource).toContain("followFinger");
    expect(componentSource).toContain("tabProgressFromClientX");
    expect(componentSource).toContain("setHoverIndex");
    expect(componentSource).not.toContain("TAB_ORDER_STORAGE_KEY");
    expect(componentSource).not.toContain("is-editing");
    expect(componentSource).not.toContain('href: "/live-spin"');
    expect(componentSource).not.toContain('href: "/ai"');
  });

  it("uses a shop bag for Store and a person mark for Account", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const packSource = readFileSync(join(process.cwd(), "client/src/components/PackEmoji.tsx"), "utf8");
    expect(componentSource).toContain('pack: "gift"');
    expect(componentSource).toContain('pack: "account-face"');
    expect(componentSource).not.toContain("TabPackEmoji");
    expect(packSource).toContain('"account-face": { emoji: "😊"');
    expect(packSource).not.toContain('"shopping-bag": { emoji: "🛒"');
    expect(packSource).not.toContain('"user-laptop": { emoji: "👋"');
  });

  it("uses a compact two-item rounded mobile tab bar and no public AI entry", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("storefront-scroll-top fixed z-[270] grid h-11 w-11");
    expect(componentSource).toContain("grid h-14 w-full -translate-x-1/2 grid-cols-2");
    expect(styleSource).toContain("width: min(calc(100vw - 1.5rem), 21rem)");
    expect(componentSource).toContain("gap-0.5");
    expect(componentSource).not.toContain('href: "/ai"');
    expect(componentSource).toContain("rounded-full");
    expect(styleSource).toContain("border-radius: 999px");
    expect(styleSource).toContain("safe-area-inset-bottom");
    expect(styleSource).toContain("right: auto");
    expect(styleSource).toContain("left: 50%");
    expect(styleSource).toContain("bottom: max(0.5rem, env(safe-area-inset-bottom))");
    expect(styleSource).toContain("@media (min-width: 640px) { .zurs-mobile-tabbar { display: none !important; } }");
    expect(styleSource).toContain("transform 300ms cubic-bezier(0.23, 1, 0.32, 1)");
  });

  it("renders the owner brand mark as a circle in the header and footer", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain('alt="ZURS logo" className="h-8 w-8 shrink-0 rounded-full');
    expect(componentSource).toContain('alt="ZURS STORE logo" className="h-10 w-10 shrink-0 rounded-full');
    expect(styleSource).toContain('.zurs-compact-header img[alt="ZURS logo"], .zurs-footer img[alt="ZURS STORE logo"] { border-radius: 999px; }');
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

  it("layers a lightweight Christmas garland and snowfall above the public storefront without blocking interactions", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("{new Date().getMonth() === 11 ? <ChristmasOverlay /> : null}");
    expect(componentSource).toContain("ChristmasOverlay");
    expect(componentSource).toContain("christmasSnowSlots");
    expect(componentSource).toContain("zurs-christmas-garland");
    expect(styleSource).toContain(".zurs-christmas-snow-layer");
    expect(styleSource).toContain("pointer-events: none");
    expect(styleSource).toContain("zurs-christmas-snowfall");
    expect(styleSource).toContain("prefers-reduced-motion: no-preference");
  });

  it("uses Kantumruy Pro for the storefront and Hanuman for long Khmer copy", () => {
    const documentSource = readFileSync(join(process.cwd(), "client/index.html"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(documentSource).toContain("family=Hanuman");
    expect(documentSource).toContain("family=Kantumruy+Pro");
    expect(styleSource).toContain('font-family: "Hanuman", "Kantumruy Pro"');
    expect(styleSource).toContain("prefers-reduced-motion: no-preference");
  });

  it("keeps the footer credits inside the dark card and uses the requested Facebook destination", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(componentSource).toContain("រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ zurs.me");
    expect(componentSource).toContain("បង្កើតឡើងដោយ CHAN MEKARA");
    expect(componentSource).toContain("border-t border-white/12 pt-3 text-center");
    expect(componentSource).not.toContain("zurs-footer-meta");
    expect(componentSource).toContain("https://www.facebook.com/share/19QooXtndH/?mibextid=wwXIfr");
    expect(componentSource).toContain('aria-label="បើកទំព័រ Facebook របស់ ZURS"');
    expect(componentSource).toContain("bg-[#1877F2]");
    expect(componentSource).toContain("mt-3 flex items-center justify-center gap-2 text-center");
    expect(componentSource).toContain("mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2");
    expect(componentSource).toContain("group mx-auto mt-3 flex h-10 w-fit items-center");
    expect(styleSource).toContain("oklch(0.82 0.15 84)");
  });

  it("retires the storefront Contact Admin dock and locks the mobile viewport scale", () => {
    const componentSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const contactSource = readFileSync(join(process.cwd(), "client/src/components/ContactAdminControl.tsx"), "utf8");
    const documentSource = readFileSync(join(process.cwd(), "client/index.html"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    // Round 6: the bottom Telegram help dock was removed from the storefront.
    // Support is reached from the header mascot, which links to /chat, and
    // Telegram is offered inside the chat once the daily allowance is spent.
    expect(componentSource).not.toContain("<ContactAdminControl");
    expect(componentSource).toContain("<SupportMascot />");
    expect(contactSource).toContain("contact-admin-fab--hide-mobile");
    expect(contactSource).toContain("ទំនាក់ទំនង Admin");
    expect(contactSource).toContain("Asia/Phnom_Penh");
    expect(contactSource).toContain("https://t.me/");
    expect(documentSource).toContain("user-scalable=no");
    expect(documentSource).toContain("maximum-scale=1.0");
    expect(styleSource).toContain(".contact-admin-layer");
    expect(styleSource).toContain(".contact-admin-fab--payment");
    expect(styleSource).toContain(".contact-admin-fab--hide-mobile");
    expect(styleSource).toContain("touch-action: pan-x pan-y");
    expect(componentSource).toContain("storefront-scroll-top fixed z-[270] grid");
    expect(componentSource).not.toContain("fixed right-4 z-[45] hidden");
    expect(styleSource).toContain("Storefront utility controls: explicit right-side anchors keep them clear of the footer and mobile action bar.");
    expect(styleSource).toContain(".storefront-scroll-top {");
    expect(styleSource).toContain(".contact-admin-fab__label { display: inline; }");
    expect(styleSource).toContain("bottom: calc(max(1.5rem, env(safe-area-inset-bottom)) + 4.1rem) !important;");
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
    expect(checkoutSource).toContain('fetch("/api/pay/security/check/key"');
    expect(checkoutSource).toContain("setLocation(`/pay/${encodeURIComponent(link.token)}`)");
    expect(styleSource).toContain(".checkout-preview-hero");
    expect(styleSource).toContain(".checkout-preview-confirm");
  });
});
