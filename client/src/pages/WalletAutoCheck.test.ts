import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const walletSource = readFileSync(resolve(import.meta.dirname, "Wallet.tsx"), "utf8");

describe("Wallet pause contract", () => {
  it("does not poll or initiate a Wallet payment session while direct KHQR checkout is active", () => {
    expect(walletSource).toContain("Wallet បិទជាបណ្តោះអាសន្ន");
    expect(walletSource).toContain("បន្តទូទាត់តាម KHQR");
    expect(walletSource).not.toContain("window.setInterval");
    expect(walletSource).not.toContain("session.refetch()");
    expect(walletSource).not.toContain("trpc.wallet");
    expect(walletSource).not.toContain("beginTopup");
  });
});
