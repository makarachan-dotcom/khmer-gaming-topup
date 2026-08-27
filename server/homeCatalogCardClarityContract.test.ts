import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(__dirname, "..");

describe("Home provider product-card clarity", () => {
  it("keeps the country marker on artwork and removes duplicate flag surfaces", () => {
    const home = fs.readFileSync(path.join(projectRoot, "client/src/pages/Home.tsx"), "utf8");
    const identity = fs.readFileSync(path.join(projectRoot, "client/src/components/ProviderGameIdentity.tsx"), "utf8");
    const topup = fs.readFileSync(path.join(projectRoot, "client/src/pages/GameTopup.tsx"), "utf8");

    expect(home).toContain('className="h-11 w-11 rounded-xl"');
    expect(home).toContain('id: "free_fire", name: "Free Fire"');
    expect(home).toContain("showFlag={false}");
    expect(home).toContain("showCountryFlag={false}");
    expect(home).not.toContain("🇰🇭 Cambodia support");
    expect(identity).toContain("showCountryFlag?: boolean");
    expect(identity).toContain("showCountryFlag = true");
    expect(identity).toContain("showFlag = true");
    expect(topup).toContain("package-category-tabs");
    expect(topup).toContain("ជ្រើសរើសកញ្ចប់");
    expect(topup).toContain("ស្វែងរកគ្រប់កញ្ចប់");
  });
});
