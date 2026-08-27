import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("streamdown", () => ({ Streamdown: () => null }));
import { canBrowseTopupPackages, canBrowseVerifiedPackages, gameIdFromTopupPath, gameThemedArtworkForPackage, gameTopupPath, groupProviderPackagesByMeaning, initialDiamondPackageLimit, partitionProviderPackagesForFullTicketEvent, readVerifiedPlayerEntries, requiresPlayerIdentityCheck, requiresVerifiedUsername, saveVerifiedPlayerEntry, sortProviderPackagesByPrice, usesLegacyMobileLegendsArtwork, usesMobileLegendsDiamondChestArtwork, visibleDiamondPackageItems } from "./GameTopup";

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
    expect(source).toContain('className="package-category-grid grid grid-cols-2 gap-2 sm:grid-cols-3"');
    expect(source).toContain('<PackageCard key={item.id} item={item}');
    expect(source).toContain('OverflowMarquee text={item.label}');
    expect(source).not.toContain("function CategoryPackageCard(");
    expect(source).not.toContain("package-category-choice__icon");
  });

  it("applies only responsive package-grid geometry while preserving package-card presentation", () => {
    const pageSource = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const css = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(pageSource).toContain('className="container game-topup-container py-5 sm:py-9"');
    expect(css).toContain("Game top-up package layout: sizing and grid geometry only; existing package-card presentation is preserved.");
    expect(css).toContain(".package-category-grid { gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }");
    expect(css).toContain("@media (min-width: 992px) {\n  .package-category-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }");
    expect(css).toContain("@media (min-width: 1200px) {\n  .game-topup-container { max-width: 1180px; }\n  .package-category-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }");
    expect(css).toContain(".package-category-grid > article { height: 10.55rem; }");
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
  });

  it("keeps the official game-logo overlay on any newly supplied MLBB pass artwork", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("supplied-package-art__logo");
    expect(source).toContain("package-choice--mlbb-${mobileLegendsTone}");
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

  it("allows package UI without player fields only when the protected Admin preview mode is active", () => {
    expect(canBrowseTopupPackages(false, "invalid", false)).toBe(false);
    expect(canBrowseTopupPackages(true, "not_supported", false)).toBe(false);
    expect(canBrowseTopupPackages(true, "not_supported", false, true, true)).toBe(true);
    expect(canBrowseTopupPackages(true, "unavailable", false, true, true)).toBe(false);
    expect(canBrowseTopupPackages(false, undefined, true)).toBe(true);
    expect(canBrowseTopupPackages(true, undefined, false, false)).toBe(true);
  });

  it("requires a verified Check-ID result for Player ID, Zone ID, and account-ID game forms only", () => {
    expect(requiresPlayerIdentityCheck([{ key: "player_id", label: "Player ID", required: true, kind: "text" }])).toBe(true);
    expect(requiresPlayerIdentityCheck([{ key: "zone_id", label: "Zone ID", required: true, kind: "text" }])).toBe(true);
    expect(requiresPlayerIdentityCheck([{ key: "account_id", label: "Account ID", required: true, kind: "text" }])).toBe(true);
    expect(requiresPlayerIdentityCheck([{ key: "email", label: "Email", required: true, kind: "email" }])).toBe(false);
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
    ["mobile_legends", "mobile_legends_global", "free_fire_my_sg", "pubg_mobile", "pubg_mobile_auto", "blood_strike", "honor_of_kings", "magic_chess_gogo_global"].forEach((gameId) => {
      expect(requiresVerifiedUsername(gameId)).toBe(true);
    });
    expect(requiresVerifiedUsername("call_of_duty_mobile")).toBe(false);
  });

  it("keeps the selected package during the route handoff to checkout preview", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("Keep the selected package while navigating to /checkout/preview");
    expect(source).toContain("useEffect(() => () => { setPlayerTitle(null); }, [setPlayerTitle]);");
    expect(source).not.toContain("useEffect(() => () => { clearSelectedProduct(); setPlayerTitle(null); }");
  });

  it("places payment-method preselection after an accepted identity and before the package list without blocking public preview", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const preselectPosition = source.indexOf("{canBrowsePackages && !adminPreviewActive ? <PaymentMethodPreselect /> : null}");
    const packagePosition = source.indexOf("<DiamondPackages packages={packages}");
    expect(source).toContain('import { PaymentMethodPreselect } from "@/components/PaymentMethodGate"');
    expect(preselectPosition).toBeGreaterThan(-1);
    expect(packagePosition).toBeGreaterThan(preselectPosition);
    expect(source).toContain("setSelectedPaymentMethodId(null)");
  });
});
