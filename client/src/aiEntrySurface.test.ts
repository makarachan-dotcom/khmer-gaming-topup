import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("compact banner and AI-free public storefront", () => {
  it("uses both supplied deployment-safe banner assets with gentle automatic rotation", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(home).toContain("https://files.manuscdn.com/user_upload_by_module/");
    expect(home).toContain("xftKPqLVBztUvpUZ.png");
    expect(home).toContain("mMwkxBRkmMXfalck.png");
    expect(home).not.toContain("storage.manus.com/manus-storage");
    expect(home).toContain("zurs-banner-slide--pan");
    expect(home).toContain("/zurs-banner.png");
    expect(home).toContain("prefers-reduced-motion: reduce");
    expect(home).not.toContain("startLogin");
    expect(home).not.toContain("Sign in");
    expect(home).not.toContain("Sign up");
  });

  it("removes public AI entry points while leaving ordinary top-up and account pages free of chat controls", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const topup = readFileSync(resolve(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const account = readFileSync(resolve(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    expect(home).not.toContain("openZursAiChat");
    expect(topup).not.toContain("openZursAiChat");
    expect(account).not.toContain("openZursAiChat");
    expect(shell).not.toContain("ZursAiChat");
    expect(shell).not.toContain('href: "/ai"');
    expect(shell).not.toContain("aria-label=\"បើក ZURS AI\"");
    expect(app).not.toContain("ZursAiChat");
  });
});
