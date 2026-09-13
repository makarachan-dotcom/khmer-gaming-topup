import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("storefront image loading performance", () => {
  it("preloads the critical banner and connects to its CDN before app rendering", () => {
    const documentSource = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    expect(documentSource).toContain('rel="preconnect" href="https://files.manuscdn.com"');
    expect(documentSource).toContain('rel="preload"');
    expect(documentSource).toContain('as="image"');
    expect(documentSource).toContain('fetchpriority="high"');
  });

  it("uses explicit aspect frames, async decode, and native lazy loading for noncritical media", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain("aspect-[16/5.5]");
    expect(homeSource).toContain('fetchPriority="high"');
    expect(homeSource).toContain("zurs-banner-slide--pan");
    expect(homeSource).toContain('loading="lazy"');
    expect(homeSource).toContain('decoding="async"');
    expect(homeSource).toContain('sizes="(max-width: 639px) 50vw');
    expect(homeSource).toContain("aspect-square");
    expect(homeSource).not.toContain("aspect-[16/10]");
  });

  it("keeps the Weekly Loyalty Giveaway card out of the public Home page", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).not.toContain("LiveSpinPromo");
    expect(homeSource).not.toContain("Weekly Loyalty Giveaway");
  });

  it("uses an address-free Accept Payment strip with a right-aligned KHQR logo", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain("ACCEPT PAYMENT");
    expect(homeSource).toContain("zurs-pay-badge");
    expect(homeSource).toContain("zurs-pay-badge__bakong");
    expect(homeSource).toContain('src={khqrLogoUrl}');
    expect(homeSource).toContain('alt="KHQR"');
    expect(homeSource).not.toContain("zurs-game-count");
    expect(homeSource).not.toContain("payment-location");
    expect(homeSource).not.toContain("zurs-status-notice");
  });

  it("slides the boot curtain away immediately and reuses a cached game list", () => {
    const documentSource = readFileSync(resolve(process.cwd(), "client/index.html"), "utf8");
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const uiSource = readFileSync(resolve(process.cwd(), "client/src/lib/storefrontUi.ts"), "utf8");
    const packSource = readFileSync(resolve(process.cwd(), "client/src/components/PackEmoji.tsx"), "utf8");
    const polish = readFileSync(resolve(process.cwd(), "client/src/styles/zurs-global-polish.css"), "utf8");
    expect(documentSource).toContain('id="zurs-boot"');
    expect(documentSource).toContain("zurs-ready");
    expect(documentSource).toContain('localStorage.getItem("zurs-ui")');
    expect(uiSource).toContain("dismissStorefrontBoot");
    expect(homeSource).toContain("zurs-games-v1");
    expect(homeSource).toContain("placeholderData: readCachedGames");
    expect(homeSource).toContain("staleTime: 60_000");
    expect(packSource).toContain("progressiveLoad: true");
    expect(packSource).toContain("IntersectionObserver");
    expect(polish).toContain("content-visibility: auto");
    expect(polish).toContain("blur(16px)");
    expect(polish).toContain(".zurs-dotted-shell > footer.zurs-footer");
    expect(polish).toContain("#topup-games");
    expect(polish).toContain('html[data-pkg-ui="trio"]');
    expect(polish).toContain('html[data-pkg-ui="premium"]');
    expect(polish).toContain("account-history-panel article");
    expect(polish).toContain('html[data-admin="1"]');
    expect(polish).toContain(".zurs-admin");
    expect(polish).toContain(".latin-label");
    expect(polish).toContain(".zurs-game-card-fallback");
    expect(polish).toContain("min-height: 48px");
    expect(polish).toContain(".zurs-search-sticky");
    expect(polish).toContain(".zurs-pay-badge");
    expect(polish).toContain("grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)");
  });

  it("keeps the home hero CTA, square tiles, and labelled search in Khmer", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain("បញ្ចូលពេជ្យ ឥឡូវនេះ");
    expect(homeSource).toContain("សេវាឌីជីថល");
    expect(homeSource).toContain("latin-label");
    expect(homeSource).toContain("zurs-search-sticky");
    expect(homeSource).toContain("ស្វែងរកហ្គេម");
    expect(homeSource).toContain("zurs-game-skel");
    expect(homeSource).toContain("grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6");
    expect(homeSource).toContain("zurs-game-card-fallback");
  });
});

describe("public user pages stay Khmer and themed", () => {
  it("uses storefront chrome and Khmer copy on 404, account, and wallet", () => {
    const notFound = readFileSync(resolve(process.cwd(), "client/src/pages/NotFound.tsx"), "utf8");
    const account = readFileSync(resolve(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    const wallet = readFileSync(resolve(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
    expect(notFound).toContain("StorefrontLayout");
    expect(notFound).toContain("រកមិនឃើញទំព័រនេះ");
    expect(notFound).not.toContain("Page Not Found");
    expect(account).toContain("ចូលតាមអ៊ីមែល");
    expect(account).not.toContain("Connect with Email</a>");
    expect(wallet).toContain("bg-panel");
    expect(wallet).toContain("text-ink");
  });

  it("localizes the header greeting and keeps a single ZURS.me wordmark", () => {
    const mascot = readFileSync(resolve(process.cwd(), "client/src/components/SupportMascot.tsx"), "utf8");
    const header = readFileSync(resolve(process.cwd(), "client/src/components/HeaderMascot.tsx"), "utf8");
    const layout = readFileSync(resolve(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const ticker = readFileSync(resolve(process.cwd(), "client/src/components/GameLogoTicker.tsx"), "utf8");
    expect(mascot).toContain("សួស្តីរសៀល");
    expect(mascot).not.toContain("Good afternoon");
    expect(header).toContain("greeting.kh");
    expect(layout).toContain('storefront-header-title__player sr-only');
    expect(ticker).toContain('aria-hidden="true"');
    expect(ticker).not.toContain("            {logo.name}");
  });
});
