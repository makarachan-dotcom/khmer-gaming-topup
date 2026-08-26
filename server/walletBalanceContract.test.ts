import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("customer wallet balance contract", () => {
  it("stores a customer-scoped KHR wallet with a safe zero default", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(schema).toContain('customer_wallets');
    expect(schema).toContain('balanceKhr');
    expect(db).toContain('getCustomerWalletSummary(userId: number)');
    expect(db).toContain('eq(customerWallets.userId, userId)');
    expect(router).toContain('summary: protectedProcedure');
  });

  it("replaces the signed-in customer wallet control with a non-interactive paused status", () => {
    const header = readFileSync(resolve(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    expect(header).toContain('wallet-paused-control');
    expect(header).toContain('role="status"');
    expect(header).toContain('Wallet កំពុងបិទជាបណ្តោះអាសន្ន');
    expect(header).not.toContain('trpc.wallet.summary.useQuery');
    expect(header).not.toContain('balance-control--visible');
  });

  it("preserves wallet records while the customer UI prevents new wallet top-ups during the KHQR-only pause", () => {
    const schema = readFileSync(resolve(process.cwd(), "drizzle/schema.ts"), "utf8");
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const appwrite = readFileSync(resolve(process.cwd(), "server/appwriteStore.ts"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const readiness = readFileSync(resolve(process.cwd(), "server/paymentReadiness.ts"), "utf8");
    const walletPage = readFileSync(resolve(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
    expect(schema).toContain('wallet_topups');
    expect(schema).toContain('providerRequestId');
    expect(db).toContain('checkBakongKhqrPayment');
    expect(db).toContain('refreshWalletTopup');
    expect(db).toContain('refreshAppwriteWalletTopup');
    expect(appwrite).toContain('getAppwriteWalletSummary');
    expect(appwrite).toContain('topup.status === "paid"');
    expect(router).toContain('beginTopup: protectedProcedure');
    expect(router).toContain('refreshTopup: protectedProcedure');
    expect(walletPage).toContain('Wallet បិទជាបណ្តោះអាសន្ន');
    expect(walletPage).toContain('បន្តទូទាត់តាម KHQR');
    expect(walletPage).toContain('មិនមាន Wallet balance, top-up QR ឬ Wallet transaction ថ្មី');
    expect(walletPage).not.toContain('trpc.wallet');
    expect(walletPage).not.toContain('session.refetch()');
    expect(readiness).toContain('reason: "payment_switch_off"');
    expect(readiness).toContain('getPublicPaymentReadiness');
    expect(db).toContain('requirePublicPaymentEnabled();');
    expect(db).toContain('getPaymentControl');
    expect(appwrite).toContain('getAppwritePaymentControl');
  });
});
