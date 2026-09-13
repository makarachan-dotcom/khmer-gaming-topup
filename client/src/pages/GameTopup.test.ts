import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("streamdown", () => ({ Streamdown: () => null }));
import { canBrowseTopupPackages, canBrowseVerifiedPackages, canCreateTopupPurchaseContext, gameIdFromTopupPath, gameThemedArtworkForPackage, gameTopupPath, groupProviderPackagesByMeaning, identityFieldsForGame, identityLayoutForFields, initialDiamondPackageLimit, keepCheapestUniqueProviderPackages, packageSortOptions, partitionProviderPackagesForFullTicketEvent, readVerifiedPlayerEntries, recommendedProviderPackage, requiresPlayerIdentityCheck, requiresVerifiedUsername, saveVerifiedPlayerEntry, sortProviderPackagesByPrice, sortProviderPackagesForDisplay, usesLegacyMobileLegendsArtwork, usesMobileLegendsDiamondChestArtwork, visibleDiamondPackageItems } from "./GameTopup";

describe("dedicated game top-up routes", () => {
  it("creates and reads an encoded provider game route", () => {
    const path = gameTopupPath("mobile legends/global");
    expect(path).toBe("/topup/mobile%20legends%2Fglobal");
    expect(gameIdFromTopupPath(path)).toBe("mobile legends/global");
  });

  it("rejects paths that do not contain a game identifier", () => {
    expect(gameIdFromTopupPath("/topup")).toBe("");
    expect(gameIdFromTopupPath("/smm")).toBe("");
  });

  it("sorts package presentation from the lowest price to the highest without changing package records", () => {
    const packages = [
      { id: "mid", label: "Mid", amountLabel: "Mid", priceLabel: "$7.35" },
      { id: "low", label: "Low", amountLabel: "Low", priceLabel: "$0.23" },
      { id: "high", label: "High", amountLabel: "High", priceLabel: "$17.41" },
    ];
    expect(sortProviderPackagesByPrice(packages).map((item) => item.id)).toEqual(["low", "mid", "high"]);
    expect(packages.map((item) => item.id)).toEqual(["mid", "low", "high"]);
  });

  it("keeps one package per amount and prefers the cheapest price", () => {
    const packages = [
      { id: "stars-500-high", label: "500 Stars", amountLabel: "500 Stars", priceLabel: "$9.90" },
      { id: "stars-500-low", label: "500 Stars", amountLabel: "500 Stars", priceLabel: "$7.70" },
      { id: "stars-750", label: "750 Stars", amountLabel: "750 Stars", priceLabel: "$11.54" },
      { id: "premium-month-high", label: "Premium 1 Month", amountLabel: "1 Month", priceLabel: "$6.99" },
      { id: "premium-month-low", label: "Premium 1 Month", amountLabel: "1 Month", priceLabel: "$4.99" },
    ];
    expect(keepCheapestUniqueProviderPackages(packages).map((item) => item.id)).toEqual(["premium-month-low", "stars-500-low", "stars-750"]);
  });

  it("groups provider packages by their genuine meaning, including Elite Pass", () => {
    const packages = [
      { id: "ff-weekly", label: "Weekly Membership", amountLabel: "Weekly Membership", priceLabel: "$2.20" },
      { id: "pubg-uc-bonus", label: "60 UC + 5 UC", amountLabel: "65 UC", priceLabel: "$0.80" },
      { id: "pubg-uc", label: "60 UC", amountLabel: "60 UC", priceLabel: "$0.75" },
      { id: "ff-special", label: "Promo Crate", amountLabel: "1 Crate", priceLabel: "$1.10" },
      { id: "ff-diamonds", label: "100 Diamonds", amountLabel: "100 Diamonds", priceLabel: "$0.95" },
      { id: "pubg-monthly", label: "Monthly Pass", amountLabel: "Monthly Pass", priceLabel: "$4.50" },
      { id: "ml-elite", label: "Elite Pass", amountLabel: "Elite Pass", priceLabel: "$5.00" },
    ];

    const grouped = groupProviderPackagesByMeaning(packages);
    expect(grouped.standard.map(item => item.id)).toEqual(["pubg-uc", "ff-diamonds"]);
    expect(grouped.bonus.map(item => item.id)).toEqual(["pubg-uc-bonus"]);
    expect(grouped.passes.map(item => item.id)).toEqual(["ff-weekly", "pubg-monthly", "ml-elite"]);
    expect(grouped.special.map(item => item.id)).toEqual(["ff-special"]);
  });

  it("uses original game-themed artwork for Blood Strike Pass packages and keeps other games on their official-game fallback", () => {
    expect(gameThemedArtworkForPackage("blood_strike", "Season Pass", "Season Pass")).toContain("bloodstrike-season-pass-art");
    expect(gameThemedArtworkForPackage("blood_strike", "Level Up Pass", "Level Up Pass")).toContain("bloodstrike-level-up-art");
    expect(gameThemedArtworkForPackage("blood_strike", "Strike Pass Elite", "Strike Pass Elite")).toContain("bloodstrike-elite-pass-art");
    expect(gameThemedArtworkForPackage("blood_strike", "Strike Pass Premium", "Strike Pass Premium")).toContain("bloodstrike-premium-pass-art");
    expect(gameThemedArtworkForPackage("blood_strike", "51 BC", "51 BC")).toContain("bloodstrike-level-up-art");
    expect(gameThemedArtworkForPackage("blood_strike", "Lucky Bag Week", "Lucky Bag Week")).toContain("bloodstrike-elite-pass-art");
    expect(gameThemedArtworkForPackage("blood_strike", "Bloodstrike Pre-order Item", "Bloodstrike Pre-order Item")).toContain("bloodstrike-premium-pass-art");
    expect(gameThemedArtworkForPackage("mobile_legends", "Weekly Pass", "Weekly Pass")).toBeNull();
  });

  it("keeps the original package cards and grid while the category browser only filters them", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("package-choice package-choice--clean package-choice--gold");
    expect(source).toContain('className="package-choice-surface block rounded-[0.7rem] p-2.5"');
    expect(source).toContain('className="package-category-grid grid grid-cols-2 gap-2.5 sm:grid-cols-3"');
    expect(source).toContain('<PackageCard key={item.id} item={item}');
    expect(source).toContain('OverflowMarquee text={item.label}');
    expect(source).not.toContain("function CategoryPackageCard(");
    expect(source).not.toContain("package-category-choice__icon");
  });

  it("applies only responsive package-grid geometry while preserving package-card presentation", () => {
    const pageSource = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(pageSource).toContain("game-topup-container py-5 sm:py-9");
    expect(pageSource).toContain("zp-page");
    expect(css).toContain("Game top-up package layout: sizing and grid geometry only; existing package-card presentation is preserved.");
    expect(css).toContain(".package-category-grid { gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }");
    expect(css).toContain("@media (min-width: 992px) {\n  .package-category-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }");
    expect(css).toContain("@media (min-width: 1200px) {\n  .game-topup-container { max-width: 1240px; }\n  .package-category-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }");
    expect(css).toContain(".package-category-grid > article { height: auto; min-height: 12.6rem; }");
    expect(css).toContain(".package-category-grid > article > .package-choice,");
    expect(css).toContain(".package-choice-surface { min-height: 0; }");
  });

  it("restores the previous generated artwork renderer for MLBB only when no provider package image exists", () => {
    expect(usesLegacyMobileLegendsArtwork("mobile_legends_global", false)).toBe(true);
    expect(usesLegacyMobileLegendsArtwork("mobile_legends_global", true)).toBe(false);
    expect(usesLegacyMobileLegendsArtwork("blood_strike", false)).toBe(false);
  });

  it("restores the exact old diamond chest artwork only for MLBB currency packages", () => {
    expect(usesMobileLegendsDiamondChestArtwork("mobile_legends_global", "86 Diamonds", "86 Diamonds")).toBe(true);
    expect(usesMobileLegendsDiamondChestArtwork("mobile_legends_global", "Weekly Pass", "Weekly Pass")).toBe(false);
    expect(usesMobileLegendsDiamondChestArtwork("blood_strike", "86 Diamonds", "86 Diamonds")).toBe(false);
    expect(usesMobileLegendsDiamondChestArtwork("mobile_legends_global", "86 Diamonds", "86 Diamonds", true)).toBe(false);
  });

  it("keeps a circular Mobile Legends logo on every MLBB artwork variant", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(source).toContain("supplied-package-art__logo h-8 w-8 rounded-full");
    expect(source).toContain("generated-package-art__logo h-8 w-8 rounded-full");
    expect(css).toContain(".mobile-legends-diamond-art__logo, .supplied-package-art__logo, .generated-package-art__logo { border-radius: 999px !important; }");
  });

  it("adds a reduced-motion-safe rotating color light around every package card", () => {
    const css = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(css).toContain(".package-choice::before");
    expect(css).toContain("@keyframes package-light-orbit");
    expect(css).toContain("@media (prefers-reduced-motion: reduce) { .package-choice::before");
    expect(css).toContain("@property --package-light-angle");
  });

  it("keeps the official game-logo overlay on any newly supplied MLBB pass artwork", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("supplied-package-art__logo");
    expect(source).toContain("package-choice--mlbb-${mobileLegendsTone}");
  });

  it("normalizes managed package artwork URLs before exposing them to public cards", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain('import { toWebsiteMediaUrl } from "@/lib/mediaUrl"');
    expect(source).toContain("artworkUrlWithRevision(toWebsiteMediaUrl(item.mediaUrl), item.updatedAt)");
  });

  it("fills missing or broken package pictures without replacing admin artwork", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("function SafePackageArt");
    expect(source).toContain("isMissingStaticArtwork");
    expect(source).toContain("suppliedProductArtworkForPackage(gameId, item.amountLabel, item.label)");
    expect(source).toContain("officialPackageArtFor");
  });

  it("does not block the identity form behind a full-page package overlay", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain('LoadingOverlay open={gameQuery.isLoading}');
    expect(source).toContain("packagesLoading");
    expect(source).not.toContain("providerPackages.isPending || adminPreview.isLoading || (showPackages && publicPackagePreview.isLoading)");
  });

  it("collapses to a verified username card and restores ID editing with an observer-driven title handoff", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("identityCollapsed");
    expect(source).toContain("IntersectionObserver");
    expect(source).toContain("setPlayerTitle(entry?.isIntersecting ? null : identity.playerName)");
    expect(source).toContain('querySelector<HTMLInputElement>("input[required], input")');
    expect(source).toContain("identity-flow--collapsed");
    expect(source).toContain("anchorRef={verifiedCardRef}");
    expect(source).not.toContain('window.addEventListener("scroll", updateCompactState');
  });

  it("renders a customer-friendly category tab browser with an all-package search", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("package-category-tabs");
    expect(source).toContain("packageCategories.useQuery");
    expect(source).toContain("buildPackageCategories(gamePackages, categoryOverrides)");
    expect(source).toContain("filterPackagesByCategory(gamePackages, selectedCategoryId, categoryOverrides)");
    expect(source).toContain("searchValue ? gamePackages.filter");
    expect(source).toContain("scrollIntoView");
    expect(source).toContain("ស្វែងរកគ្រប់កញ្ចប់");
  });

  it("locks package browsing for invalid and unavailable username checks", () => {
    expect(canBrowseVerifiedPackages(false, "verified")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "invalid")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "not_supported")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "unavailable")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "verified")).toBe(true);
  });

  it("shows Full Ticket offers only while the administrator has an active event", () => {
    const packages = [
      { id: "ticket", label: "Full Ticket", amountLabel: "Full Ticket x1", priceLabel: "$4.00" },
      { id: "diamonds", label: "100 Diamonds", amountLabel: "100 Diamonds", priceLabel: "$0.90" },
    ];

    const inactive = partitionProviderPackagesForFullTicketEvent(packages, false);
    expect(inactive.eventPackages).toEqual([]);
    expect(inactive.storefrontPackages.map((item) => item.id)).toEqual(["diamonds"]);

    const active = partitionProviderPackagesForFullTicketEvent(packages, true);
    expect(active.eventPackages.map((item) => item.id)).toEqual(["ticket"]);
    expect(active.storefrontPackages.map((item) => item.id)).toEqual(["diamonds"]);
  });

  it("keeps identity-required browsing gated while allowing the public package preview to be selected", () => {
    expect(canBrowseTopupPackages(false, "invalid", false)).toBe(false);
    expect(canBrowseTopupPackages(true, "not_supported", false)).toBe(false);
    expect(canBrowseTopupPackages(true, "not_supported", false, true, true)).toBe(true);
    expect(canBrowseTopupPackages(true, "unavailable", false, true, true)).toBe(false);
    expect(canBrowseTopupPackages(false, undefined, true)).toBe(true);
    expect(canBrowseTopupPackages(true, undefined, false, false)).toBe(true);
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("setSelectedPackageIdState(id)");
    expect(source).toContain("clearSelectedProduct();");
    expect(source).toContain("មើល និងជ្រើសកញ្ចប់បាន");
    expect(source).toContain("zurs-step-note");
  });

  it("creates purchase context only after valid identity gates, never for admin preview", () => {
    expect(canCreateTopupPurchaseContext(true, undefined, false, true, false, false, null, "123")).toBe(false);
    expect(canCreateTopupPurchaseContext(true, "invalid", false, true, false, false, null, "123")).toBe(false);
    expect(canCreateTopupPurchaseContext(true, "unavailable", false, true, false, false, null, "123")).toBe(false);
    expect(canCreateTopupPurchaseContext(true, "verified", true, true, false, false, "Verified", "123")).toBe(false);
    expect(canCreateTopupPurchaseContext(true, "verified", false, true, false, true, "Verified", "123")).toBe(true);
    expect(canCreateTopupPurchaseContext(true, "verified", false, true, false, true, null, "123")).toBe(false);
  });

  it("requires a verified Check-ID result for Player ID, Zone ID, and account-ID game forms only", () => {
    expect(requiresPlayerIdentityCheck([{ key: "player_id", label: "Player ID", required: true, kind: "text" }])).toBe(true);
    expect(requiresPlayerIdentityCheck([{ key: "zone_id", label: "Zone ID", required: true, kind: "text" }])).toBe(true);
    expect(requiresPlayerIdentityCheck([{ key: "account_id", label: "Account ID", required: true, kind: "text" }])).toBe(true);
    expect(requiresPlayerIdentityCheck([{ key: "email", label: "Email", required: true, kind: "email" }])).toBe(false);
    expect(requiresPlayerIdentityCheck([
      { key: "username", label: "Roblox Username", required: true, kind: "text" },
      { key: "password", label: "Roblox Password", required: true, kind: "password" },
    ])).toBe(true);
    expect(requiresVerifiedUsername("roblox_robux")).toBe(true);
  });

  it("keeps only private verified ID fields in a small per-game browser history", () => {
    const storage = new Map<string, string>();
    Object.defineProperty(globalThis, "window", { value: { localStorage: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } }, configurable: true });
    const entries = saveVerifiedPlayerEntry("mobile_legends_global", { player_id: "596323155", server_id: "10085" });
    expect(entries[0]?.fields).toEqual({ player_id: "596323155", server_id: "10085" });
    expect(JSON.stringify(entries)).not.toContain("playerName");
    expect(readVerifiedPlayerEntries("mobile_legends_global")).toHaveLength(1);
  });

  it("requires a verified username for the supported game families before payment preview", () => {
    ["mobile_legends", "mobile_legends_global", "free_fire", "free_fire_my_sg", "pubg_mobile", "pubg_mobile_auto", "blood_strike", "honor_of_kings", "magic_chess_gogo_global"].forEach((gameId) => {
      expect(requiresVerifiedUsername(gameId)).toBe(true);
    });
    expect(requiresVerifiedUsername("call_of_duty_mobile")).toBe(false);
  });

  it("always shows a text Player ID field for Free Fire Check ID", () => {
    expect(identityFieldsForGame("free_fire", [])).toEqual([{ key: "player_id", label: "Player ID", placeholder: "UID Free Fire", required: true, kind: "text" }]);
    expect(identityFieldsForGame("free_fire_my_sg", [{ key: "user_id", label: "User ID", required: true, kind: "number" }, { key: "server_id", label: "Server ID", required: true, kind: "text" }])).toEqual([{ key: "user_id", label: "User ID", required: true, kind: "text", placeholder: "UID Free Fire" }]);
  });

  it("asks Roblox shoppers for username and password so the provider can log in", () => {
    expect(identityFieldsForGame("roblox_robux", [])).toEqual([
      { key: "username", label: "Roblox Username", placeholder: "e.g. builderman", required: true, kind: "text" },
      { key: "password", label: "Roblox Password", placeholder: "Account password", required: true, kind: "password" },
    ]);
    expect(identityLayoutForFields(identityFieldsForGame("roblox_robux", []))).toBe("stack");
    expect(identityLayoutForFields(identityFieldsForGame("mobile_legends", []))).toBe("pair");
    const page = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "client/src/styles/zurs-checkout.css"), "utf8");
    expect(page).toContain("game-topup-workspace");
    expect(page).toContain("game-topup-id");
    expect(page).toContain("game-topup-packs");
    expect(page).toContain("IdentityFieldsGrid");
    expect(page).toContain("identity-secret__toggle");
    expect(page).toContain("មើលពាក្យសម្ងាត់");
    expect(page).toContain("zurs-id-hint");
    expect(css).toContain(".identity-fields--stack");
    expect(css).toContain(".identity-secret__toggle.is-open");
  });

  it("always asks Mobile Legends shoppers for Player ID and Server ID", () => {
    expect(identityFieldsForGame("mobile_legends", [])).toEqual([
      { key: "player_id", label: "Player ID", placeholder: "User ID", required: true, kind: "text" },
      { key: "server_id", label: "Server ID", placeholder: "Zone ID", required: true, kind: "text" },
    ]);
    expect(identityFieldsForGame("mobile_legends_global", [{ key: "user_id", label: "User ID", required: true, kind: "number" }])).toEqual([
      { key: "user_id", label: "User ID", placeholder: "User ID", required: true, kind: "text" },
      { key: "server_id", label: "Server ID", placeholder: "Zone ID", required: true, kind: "text" },
    ]);
  });

  it("keeps the selected package during the route handoff to checkout preview", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("Keep the selected package while navigating to /checkout/preview");
    expect(source).toContain("useEffect(() => () => { setPlayerTitle(null); }, [setPlayerTitle]);");
    expect(source).not.toContain("useEffect(() => () => { clearSelectedProduct(); setPlayerTitle(null); }");
  });

  it("sorts the package grid by the buyer's choice and never invents a price", () => {
    const packages = [
      { id: "mid", label: "Mid", amountLabel: "Mid", priceLabel: "$7.35" },
      { id: "low", label: "Low", amountLabel: "Low", priceLabel: "$0.23" },
      { id: "high", label: "High", amountLabel: "High", priceLabel: "$17.41" },
    ];
    expect(sortProviderPackagesForDisplay(packages, "price-asc").map((item) => item.id)).toEqual(["low", "mid", "high"]);
    expect(sortProviderPackagesForDisplay(packages, "price-desc").map((item) => item.id)).toEqual(["high", "mid", "low"]);
    expect(sortProviderPackagesForDisplay(packages, "recommended", "high").map((item) => item.id)).toEqual(["high", "low", "mid"]);
    // An id that is not in the filtered list must not reorder anything.
    expect(sortProviderPackagesForDisplay(packages, "recommended", "missing").map((item) => item.id)).toEqual(["low", "mid", "high"]);
    expect(packageSortOptions.map((option) => option.key)).toEqual(["recommended", "price-asc", "price-desc"]);
    expect(recommendedProviderPackage(packages)?.id).toBe("mid");
    // A promo crate or pass is never the headline suggestion while a plain
    // currency package exists.
    const mixed = [
      { id: "crate", label: "Promo Crate", amountLabel: "1 Crate", priceLabel: "$1.10" },
      { id: "weekly", label: "Weekly Membership", amountLabel: "Weekly Membership", priceLabel: "$2.99" },
      { id: "diamonds", label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.10" },
      { id: "diamonds-big", label: "172 Diamonds", amountLabel: "172 Diamonds", priceLabel: "$2.10" },
    ];
    expect(recommendedProviderPackage(mixed)?.id).toBe("diamonds");
  });

  it("shows every price straight from the admin catalogue label", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("{item.priceLabel}");
    expect(source).toContain("{selectedPackage.priceLabel}");
    // No client-side markup maths: the price string is rendered verbatim.
    expect(source).not.toContain("priceUsd *");
    expect(source).not.toContain("providerPackagePrice(item) *");
  });

  it("renders the new package-picking experience with a lazy price refresh", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("package-category-browser__note");
    expect(source).toContain("តម្លៃផ្លូវការពី Admin");
    expect(source).toContain('className="package-toolbar mt-3"');
    expect(source).toContain("package-sort__option");
    expect(source).toContain("sortProviderPackagesForDisplay(");
    expect(source).toContain("package-choice--recommended");
    expect(source).toContain("package-choice-recommendation");
    expect(source).toContain("package-selection-summary");
    expect(source).toContain("package-grid-skeleton");
    expect(source).toContain("<PackageGridSkeleton />");
    expect(source).toContain("refetchInterval: 15_000");
    expect(source).toContain("subscribeToPackagePricingChanges");
  });

  it("always prefers the freshest auto-refreshing package source so admin prices win", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const publicQuery = source.indexOf("publicPackagePreview.data?.packages?.length ? publicPackagePreview.data.packages : verified?.packages");
    expect(publicQuery).toBeGreaterThan(-1);
    // The identity gate still locks browsing on a negative check.
    expect(source).toContain('if (verified && verified.status !== "ready") return verified.packages;');
  });

  it("structures top-up as account, package, then KHQR payment", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const account = source.indexOf("zurs-step-head__kicker\">{/telegram/i.test(game.name) ? \"TELEGRAM SERVICE\" : \"ACCOUNT\"}");
    const packs = source.indexOf("SELECT PACKAGE");
    const pay = source.indexOf("បង់តាម KHQR");
    const preselect = source.lastIndexOf("<PaymentMethodPreselect />");
    const packages = source.indexOf("<DiamondPackages packages={packages}");
    expect(source).toContain('import { PaymentMethodPreselect } from "@/components/PaymentMethodGate"');
    expect(account).toBeGreaterThan(-1);
    expect(packs).toBeGreaterThan(account);
    expect(pay).toBeGreaterThan(packs);
    expect(packages).toBeGreaterThan(-1);
    expect(preselect).toBeGreaterThan(packages);
    expect(source).toContain("zurs-id-hint");
    expect(source).toContain("setSelectedPaymentMethodId(null)");
    const gamer = readFileSync(join(process.cwd(), "client/src/styles/zurs-gamer.css"), "utf8");
    expect(gamer).toContain('html[data-ui-family="dark"][data-theme="dark"]');
    expect(gamer).toContain("--z-canvas: #101736");
    expect(gamer).toContain("--z-cream: #f7f6f2");
    expect(gamer).toContain("--z-neon: #c99712");
    expect(gamer).toContain("min-height: 48px");
    expect(gamer).toContain(".zurs-dotted-shell .text-slate-950");
    expect(gamer).toContain(".checkout-qr-card { background: #fff !important;");
    expect(gamer).toContain(".package-category-browser");
    expect(gamer).toContain("background: #162040 !important");
    expect(gamer).toContain(".zurs-lang-copy p");
    expect(gamer).toContain(".zurs-product-sheet__panel");
  });
});
