import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const walletSource = readFileSync(resolve(import.meta.dirname, "Wallet.tsx"), "utf8");

describe("Wallet automatic KHQR payment status", () => {
  it("observes a pending Wallet session every five seconds without initiating provider verification from the browser", () => {
    expect(walletSource).toContain('if (!topupId || active?.status !== "pending") return;');
    expect(walletSource).toContain("window.setInterval");
    expect(walletSource).toContain("5_000");
    expect(walletSource).toContain("void session.refetch()");
    expect(walletSource).not.toContain('refresh.mutate({ topupId })');
    expect(walletSource).toContain("window.clearInterval(timer)");
  });
});
