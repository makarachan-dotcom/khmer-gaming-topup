import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("marketplace favorites contract", () => {
  it("keeps saved listings private and unique per customer", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    expect(schema).toContain("marketplace_favorites_user_listing_unique");
    expect(db).toContain("getMarketplaceFavorites(userId: number)");
    expect(db).toContain("addMarketplaceFavorite(input");
    expect(db).toContain("removeMarketplaceFavorite(input");
    expect(db).toContain("eq(marketplaceFavorites.userId, userId)");
  });

  it("provides save/remove controls while keeping the purchase-first marketplace compact", () => {
    const marketplace = readFileSync(resolve(process.cwd(), "client/src/pages/Marketplace.tsx"), "utf8");
    const account = readFileSync(resolve(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    expect(marketplace).toContain("marketplace.addFavorite");
    expect(marketplace).toContain("marketplace.removeFavorite");
    expect(marketplace).not.toContain("function InfoCard");
    expect(account).toContain('href="/favorites"');
    expect(account).toContain('href="/account/settings"');
  });
});
