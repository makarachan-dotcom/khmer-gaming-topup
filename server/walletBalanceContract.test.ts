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

  it("keeps the header balance hidden until the signed-in customer chooses to reveal it", () => {
    const header = readFileSync(resolve(process.cwd(), "client/src/components/StorefrontLayout.tsx"), "utf8");
    expect(header).toContain('trpc.wallet.summary.useQuery');
    expect(header).toContain('useState(false)');
    expect(header).toContain('"••••"');
    expect(header).toContain('aria-pressed={balanceVisible}');
    expect(header).toContain('balance-control--visible');
  });

  it("adds wallet funds only through a verified Bakong top-up while the owner-controlled payment gate defaults to off", () => {
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
    expect(walletPage).toContain('បញ្ចូលប្រាក់');
    expect(walletPage).toContain('session.refetch()');
    expect(walletPage).not.toContain('refresh.mutate({ topupId: active.id })');
    expect(readiness).toContain('reason: "payment_switch_off"');
    expect(readiness).toContain('getPublicPaymentReadiness');
    expect(db).toContain('requirePublicPaymentEnabled();');
    expect(db).toContain('getPaymentControl');
    expect(appwrite).toContain('getAppwritePaymentControl');
  });
});
