import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

describe("admin catalog workspace", () => {
  it("provides a unified searchable inventory with visibility controls and an event-only Full Ticket switch", () => {
    const pricing = fs.readFileSync(path.join(projectRoot, "client/src/pages/AdminPricing.tsx"), "utf8");
    const topup = fs.readFileSync(path.join(projectRoot, "client/src/pages/GameTopup.tsx"), "utf8");

    expect(pricing).toContain("CatalogInventoryControls");
    expect(pricing).toContain("បញ្ជីហ្គេម FazerCards ទាំងអស់");
    expect(pricing).toContain("បន្ថែមចូលហាង");
    expect(pricing).toContain("onSetSelectedVisibility");
    expect(pricing).toContain("updateAvailabilityCache");
    expect(pricing).toContain('useState<"all" | "active" | "hidden">("all")');
    expect(pricing).toContain("មិនទាន់ Add");
    expect(pricing).toContain("topup-event-full-ticket");
    expect(pricing).toContain("កំណត់តម្លៃ និង Margin លម្អិត");
    expect(pricing).not.toContain("slice(0, 60)");
    expect(topup).toContain("isFullTicketPackage");
    expect(topup).toContain("OverflowMarquee");
    expect(topup).toContain("ProviderGameArtwork");
  });
});
