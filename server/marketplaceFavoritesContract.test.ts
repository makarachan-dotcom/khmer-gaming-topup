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

  it("preserves private favorites data while the retired customer route redirects users to AI", () => {
    const marketplace = readFileSync(resolve(process.cwd(), "client/src/pages/Marketplace.tsx"), "utf8");
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(marketplace).toContain("marketplace.addFavorite");
    expect(marketplace).toContain("marketplace.removeFavorite");
    expect(marketplace).not.toContain("function InfoCard");
    expect(app).toContain('<Route path={"/favorites"}><Redirect to="/ai" /></Route>');
    expect(app).toContain('path="/admin/marketplace-safety" component={AdminMarketplaceSafety}');
  });
});
