import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const walletSource = readFileSync(join(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
const storefrontSource = readFileSync(join(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");

describe("temporary wallet pause", () => {
  it("keeps the wallet route informational and prevents balance or top-up activity", () => {
    expect(walletSource).toContain("Wallet បិទជាបណ្តោះអាសន្ន");
    expect(walletSource).toContain("ទូទាត់តាម KHQR ដោយផ្ទាល់");
    expect(walletSource).toContain('href="/topup"');
    expect(walletSource).not.toContain("trpc.wallet");
    expect(walletSource).not.toContain("beginTopup");
    expect(walletSource).not.toContain("topupSession");
  });

  it("uses a non-interactive gray wallet indicator in the storefront header", () => {
    expect(storefrontSource).toContain("wallet-paused-control");
    expect(storefrontSource).toContain("ZURS Wallet បិទជាបណ្តោះអាសន្ន");
    expect(storefrontSource).not.toContain("trpc.wallet.summary");
    expect(storefrontSource).not.toContain('href="/wallet"');
  });
});
