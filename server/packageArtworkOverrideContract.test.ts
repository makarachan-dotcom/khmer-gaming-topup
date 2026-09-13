import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const db = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const gameTopup = readFileSync(new URL("../client/src/pages/GameTopup.tsx", import.meta.url), "utf8");

describe("provider package artwork override contract", () => {
  it("uses dedicated non-secret metadata and audit tables rather than site content", () => {
    expect(schema).toContain('mysqlTable("provider_package_artwork_overrides"');
    expect(schema).toContain('mysqlTable("provider_package_artwork_audits"');
    expect(schema).toContain('uniqueIndex("provider_package_artwork_unique").on(table.gameId, table.offerId)');
    expect(db).toContain("saveProviderPackageArtworkOverride");
    expect(db).toContain("resetProviderPackageArtworkOverride");
    expect(db).not.toContain("package-artwork:");
  });

  it("accepts only managed-storage or HTTPS art references and audits reset/default restoration", () => {
    expect(db).toContain('mediaUrl.startsWith("/manus-storage/")');
    expect(db).toContain('new URL(mediaUrl).protocol === "https:"');
    expect(db).toContain('action: "set"');
    expect(db).toContain('action: "reset"');
    expect(db).toContain("providerPackageArtworkAudits");
  });

  it("keeps write and audit routes behind the Owner-approved Media scope while letting public game pages resolve per-game overrides", () => {
    expect(routers).toContain("packageArtwork: publicProcedure");
    expect(routers).toContain('savePackageArtwork: scopedAdminProcedure("media")');
    expect(routers).toContain('resetPackageArtwork: scopedAdminProcedure("media")');
    expect(routers).toContain('packageArtworkAudits: scopedAdminProcedure("media")');
    expect(gameTopup).toContain("trpc.provider.packageArtwork.useQuery");
    expect(gameTopup).toContain("refetchInterval: 1_000");
    expect(gameTopup).toContain("refetchIntervalInBackground: true");
    expect(gameTopup).toContain("subscribeToPackageArtworkChanges");
    expect(gameTopup).toContain("artworkUrlWithRevision(toWebsiteMediaUrl(item.mediaUrl), item.updatedAt)");
    expect(gameTopup).toContain("artworkOverrides[offerId]");
    expect((gameTopup.match(/trpc\.provider\.packageArtwork\.useQuery/g) ?? []).length).toBe(1);
    expect(gameTopup).toContain("PackageArtworkOverridesContext.Provider");
    expect(gameTopup).toContain("refetchInterval: 1_000");
    expect(readFileSync(new URL("../client/src/pages/AdminPackageArtwork.tsx", import.meta.url), "utf8")).toContain("previewGamePackages.useQuery");
  });
});
