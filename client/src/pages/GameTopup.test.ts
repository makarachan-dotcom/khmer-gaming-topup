import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
vi.mock("streamdown", () => ({ Streamdown: () => null }));
import { canBrowseTopupPackages, canBrowseVerifiedPackages, gameIdFromTopupPath, gameThemedArtworkForPackage, gameTopupPath, groupProviderPackagesByMeaning, initialDiamondPackageLimit, partitionProviderPackagesForFullTicketEvent, readVerifiedPlayerEntries, requiresPlayerIdentityCheck, saveVerifiedPlayerEntry, sortProviderPackagesByPrice, usesLegacyMobileLegendsArtwork, usesMobileLegendsDiamondChestArtwork, visibleDiamondPackageItems } from "./GameTopup";

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

  it("renders category-specific fallback artwork rather than a repeated game cover", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain("<img src={themedArtwork ?? artworkUrl}");
    expect(source).toContain("artworkUrl={generatedArtwork.url}");
    expect(source).not.toContain('className="generated-package-art__game-cover"');
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

  it("changes to the verified username bar as the fields leave the mobile viewport and restores ID editing safely", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(source).toContain('window.matchMedia("(max-width: 767px)").matches');
    expect(source).toContain("anchor.getBoundingClientRect().top <= 92");
    expect(source).toContain('window.addEventListener("scroll", updateCompactState');
    expect(source).toContain('querySelector<HTMLInputElement>("input[required], input")');
    expect(source).toContain("setCompact(false);");
    expect(source).toContain("fields={providerFields ?? {}}");
  });

  it("shows ten diamond packages first and reveals the provider-authorized remainder only after expansion", () => {
    const packages = Array.from({ length: 12 }, (_, index) => ({ id: `diamond-${index + 1}`, label: `${index + 1} Diamonds`, amountLabel: `${index + 1} Diamonds`, priceLabel: `$${index + 1}` }));
    expect(initialDiamondPackageLimit).toBe(10);
    expect(visibleDiamondPackageItems(packages, false).map((item) => item.id)).toEqual(packages.slice(0, 10).map((item) => item.id));
    expect(visibleDiamondPackageItems(packages, true)).toEqual(packages);
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
});
