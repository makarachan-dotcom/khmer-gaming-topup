import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

describe("admin catalog workspace", () => {
  it("provides a unified searchable inventory with visibility controls and an event-only Full Ticket switch", () => {
    const pricing = fs.readFileSync(path.join(projectRoot, "client/src/pages/AdminPricing.tsx"), "utf8");
    const topup = fs.readFileSync(path.join(projectRoot, "client/src/pages/GameTopup.tsx"), "utf8");

    expect(pricing).toContain("CatalogInventoryControls");
    expect(pricing).toContain("catalogAvailabilityErrorMessage");
    expect(pricing).toContain("បញ្ជី FazerCards ដែលបាន Sync");
    expect(pricing).toContain("បញ្ជីហ្គេម FazerCards");
    expect(pricing).toContain("បន្ថែមចូលហាង");
    expect(pricing).toContain("onSetSelectedVisibility");
    expect(pricing).toContain("utils.admin.providerAvailability.setData");
    expect(pricing).toContain('useState<"all" | "active" | "hidden">("active")');
    expect(pricing).toContain("មិនទាន់ Add");
    expect(pricing).toContain("topup-event-full-ticket");
    expect(pricing).toContain("តម្លៃ និង Margin តាមហ្គេម");
    expect(pricing).not.toContain("slice(0, 60)");
    expect(topup).toContain("isFullTicketPackage");
    expect(topup).toContain("OverflowMarquee");
    expect(topup).toContain("ProviderGameArtwork");
  });
});
