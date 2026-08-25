import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("KHQR request-budget polling policy", () => {
  it("keeps the owner verification surface ledger-derived", () => {
    const database = projectFile("server/db.ts");
    const latestVerification = database.slice(
      database.indexOf("export async function getLatestWalletVerification"),
      database.indexOf("export async function getWalletTopupReceipt"),
    );

    expect(latestVerification).toContain('current.status === "paid"');
    expect(latestVerification).not.toContain("checkBakongKhqrPayment");
  });

  it("reserves direct Bakong verification for exactly two manual Wallet checks", () => {
    const database = projectFile("server/db.ts");
    const router = projectFile("server/routers.ts");
    const refreshWallet = database.slice(
      database.indexOf("export async function refreshWalletTopup"),
      database.indexOf("async function refreshAppwriteWalletTopup"),
    );

    expect(refreshWallet).toContain("lt(walletTopups.manualCheckCount, 2)");
    expect(refreshWallet).toContain("checkBakongKhqrPayment");
    expect(router).toContain('refreshTopup: protectedProcedure.input(z.object({ topupId: z.string().min(4).max(64) }))');
    expect(router).not.toContain('source: z.enum(["manual", "automatic"])');
  });

  it("uses ledger reads for ten-second UI updates without countdown-reset dependencies", () => {
    const wallet = projectFile("client/src/pages/Wallet.tsx");
    const checkout = projectFile("client/src/pages/Checkout.tsx");
    const walletAutomaticEffect = wallet.slice(
      wallet.indexOf("if (!topupId || !waiting) return;"),
      wallet.indexOf("useEffect(() => { if (paid)", wallet.indexOf("if (!topupId || !waiting) return;")),
    );
    const checkoutAutomaticEffect = checkout.slice(
      checkout.indexOf("if (!waitingForBakong || refresh.isPending) return;"),
      checkout.indexOf("const amount", checkout.indexOf("if (!waitingForBakong || refresh.isPending) return;")),
    );

    expect(walletAutomaticEffect).toContain("refetchSession()");
    expect(walletAutomaticEffect).not.toContain('source: "automatic"');
    expect(walletAutomaticEffect).not.toContain("countdown.remaining");
    expect(checkoutAutomaticEffect).toContain("refetchPaymentSession()");
    expect(checkoutAutomaticEffect).not.toContain("countdown.seconds");
  });
});
