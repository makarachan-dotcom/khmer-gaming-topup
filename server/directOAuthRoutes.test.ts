import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const clientFile = (relativePath: string) => readFileSync(resolve(process.cwd(), "client/src", relativePath), "utf8");

describe("direct Google OAuth entry points", () => {
  it("keeps public sign-in controls on the direct callback-safe OAuth endpoint", () => {
    const files = [
      "components/StorefrontLayout.tsx",
      "pages/Marketplace.tsx",
      "pages/SellAccount.tsx",
      "pages/MarketplaceVerify.tsx",
      "pages/MyMarketplaceListings.tsx",
      "App.tsx",
    ].map(clientFile);

    expect(files.join("\n")).toContain("/api/auth/google");
    expect(files.join("\n")).not.toContain("/google-sign-in");
  });
});
