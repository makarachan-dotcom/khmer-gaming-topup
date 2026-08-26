import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("compact banner and tab-only AI entry", () => {
  it("uses both supplied deployment-safe banner assets with gentle automatic rotation", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(home).toContain("https://files.manuscdn.com/user_upload_by_module/");
    expect(home).toContain("xftKPqLVBztUvpUZ.png");
    expect(home).toContain("mMwkxBRkmMXfalck.png");
    expect(home).not.toContain("storage.manus.com/manus-storage");
    expect(home).toContain("setInterval");
    expect(home).toContain("prefers-reduced-motion: reduce");
    expect(home).toContain("Sign in");
    expect(home).toContain("Sign up");
  });

  it("keeps AI opening only on the mobile AI tab", () => {
    const home = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    const topup = readFileSync(resolve(process.cwd(), "client/src/pages/GameTopup.tsx"), "utf8");
    const account = readFileSync(resolve(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    const chat = readFileSync(resolve(process.cwd(), "client/src/components/ZursAiChat.tsx"), "utf8");
    expect(home).not.toContain("openZursAiChat");
    expect(topup).not.toContain("openZursAiChat");
    expect(account).not.toContain("openZursAiChat");
    expect(shell).toContain('aria-label="បើក ZURS AI"');
    expect(shell).not.toContain("AI ជំនួយការ");
    expect(shell).not.toContain("ZursAiFloatingButton");
    expect(chat).not.toContain("ZursAiFloatingButton");
  });
});
