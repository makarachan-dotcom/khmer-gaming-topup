import { describe, expect, it } from "vitest";
import { canBrowseTopupPackages, canBrowseVerifiedPackages, gameIdFromTopupPath, gameTopupPath, readVerifiedPlayerEntries, saveVerifiedPlayerEntry, sortProviderPackagesByPrice } from "./GameTopup";

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

  it("locks package browsing for invalid, unavailable, and unsupported username checks", () => {
    expect(canBrowseVerifiedPackages(false, "verified")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "invalid")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "not_supported")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "unavailable")).toBe(false);
    expect(canBrowseVerifiedPackages(true, "verified")).toBe(true);
  });

  it("allows package UI without player fields only when the protected Admin preview mode is active", () => {
    expect(canBrowseTopupPackages(false, "invalid", false)).toBe(false);
    expect(canBrowseTopupPackages(true, "not_supported", false)).toBe(false);
    expect(canBrowseTopupPackages(false, undefined, true)).toBe(true);
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
