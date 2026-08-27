import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("public asset refresh signal", () => {
  it("uses a dedicated same-origin channel with only approved public asset areas", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/lib/publicAssetBroadcast.ts"), "utf8");
    expect(source).toContain('const channelName = "zurs-public-asset-refresh"');
    expect(source).toContain('area === "game-images" || area === "contact-admins"');
    expect(source).toContain("channel.close()");
  });

  it("refreshes game-image consumers after an owner save or reset", () => {
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminGameImages.tsx"), "utf8");
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const topup = readFileSync(resolve(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    expect(admin).toContain('notifyPublicAssetChanged("game-images")');
    expect(home).toContain('area === "game-images"');
    expect(topup).toContain('area === "game-images"');
    expect(home).toContain("refetchInterval: 5_000");
    expect(topup).toContain("refetchInterval: 5_000");
  });
});
