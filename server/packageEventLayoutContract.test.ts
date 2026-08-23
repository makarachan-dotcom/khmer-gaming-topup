import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

describe("provider package event layout", () => {
  it("keeps Full Ticket visibility controlled by Admin content and leaves package media provider-backed", async () => {
    const [adminPricing, gameTopup, layout] = await Promise.all([
      readFile(new URL("../client/src/pages/AdminPricing.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/pages/GameTopup.tsx", import.meta.url), "utf8"),
      readFile(new URL("../client/src/components/StorefrontLayout.tsx", import.meta.url), "utf8"),
    ]);

    expect(adminPricing).toContain('contentKey: "topup-event-full-ticket"');
    expect(adminPricing).toContain("បើក Event");
    expect(gameTopup).toContain("partitionProviderPackagesForFullTicketEvent");
    expect(gameTopup).toContain("ProviderGameArtwork");
    expect(gameTopup).toContain("suppliedProductArtworkForPackage");
    expect(layout).toContain("selected-product-action-bar");
    expect(layout).toContain("OverflowMarquee");
    expect(layout).not.toContain("ប្ដូរ");
  });
});
