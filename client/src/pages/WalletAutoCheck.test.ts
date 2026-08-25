import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const walletSource = readFileSync(resolve(import.meta.dirname, "Wallet.tsx"), "utf8");

describe("Wallet automatic KHQR payment check", () => {
  it("verifies a pending Wallet session every ten seconds and stops for non-pending states", () => {
    expect(walletSource).toContain('if (!topupId || active?.status !== "pending") return;');
    expect(walletSource).toContain("window.setInterval");
    expect(walletSource).toContain("10_000");
    expect(walletSource).toContain("refresh.mutate({ topupId })");
    expect(walletSource).toContain("window.clearInterval(timer)");
  });
});
