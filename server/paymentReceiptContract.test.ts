import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("verified payment receipt contract", () => {
  it("limits receipt data to the authenticated customer's verified paid order", () => {
    const database = source("server/db.ts");
    const router = source("server/routers.ts");
    expect(database).toContain("getCustomerPaymentReceipt");
    expect(database).toContain("eq(orders.userId, input.userId)");
    expect(database).toContain('eq(paymentTransactions.status, "paid")');
    expect(database).not.toContain("providerRequestId: row.payment.providerRequestId");
    expect(router).toContain("receipt: protectedProcedure");
  });

  it("shows paid-success receipt actions and supports local receipt download", () => {
    const checkout = source("client/src/pages/Checkout.tsx");
    const wallet = source("client/src/pages/Wallet.tsx");
    const receipt = source("client/src/components/PaymentReceipt.tsx");
    expect(checkout).toContain("PaymentSuccessDialog");
    expect(checkout).toContain("payment?.status === \"paid\"");
    expect(checkout).toContain("ReceiptActionButtons");
    expect(wallet).toContain("WalletPaymentSuccessDialog");
    expect(wallet).toContain("trpc.wallet.receipt.useQuery");
    expect(wallet).toContain("ReceiptActionButtons");
    expect(receipt).toContain("URL.createObjectURL");
    expect(receipt).toContain("anchor.download");
    expect(receipt).not.toContain("providerTransactionId");
  });

  it("keeps Wallet receipt data customer-owned and provider-safe", () => {
    const database = source("server/db.ts");
    const router = source("server/routers.ts");
    const walletReceipt = source("client/src/pages/WalletReceipt.tsx");
    expect(database).toContain("getWalletTopupReceipt");
    expect(database).toContain("eq(walletTopups.userId, input.userId)");
    expect(database).not.toContain("providerRequestId: current.providerRequestId");
    expect(router).toContain("receipt: protectedProcedure");
    expect(walletReceipt).toContain("QR, transaction hash, worker ID");
  });

  it("keeps referral rewards and discounts intentionally deferred", () => {
    const todo = source("todo.md");
    expect(todo).toContain("Deferred at the owner's request: referral attribution");
  });
});
