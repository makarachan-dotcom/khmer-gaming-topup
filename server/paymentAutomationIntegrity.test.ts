import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (name: string) => readFileSync(resolve(import.meta.dirname, name), "utf8");
const dbSource = source("db.ts");
const bakongSource = source("bakongKhqr.ts");

describe("KHQR payment automation integrity", () => {
  it("persists the MD5 and expected merchant account before registering Wallet and checkout worker watches", () => {
    expect(bakongSource).toContain("merchantAccountId: config.accountId");
    expect(dbSource).toContain("merchantAccountId: generated.merchantAccountId");
    expect(dbSource).toContain("merchantAccountId: generated!.merchantAccountId");

    const walletInsert = dbSource.indexOf("await db.insert(walletTopups).values(record);");
    const walletWatch = dbSource.indexOf("registerBakongKhqrWorkerWatch({ md5: generated.md5, orderId: `wallet:${record.id}`");
    expect(walletInsert).toBeGreaterThan(-1);
    expect(walletWatch).toBeGreaterThan(walletInsert);

    const checkoutInsert = dbSource.indexOf("await db.insert(paymentTransactions).values(transaction);");
    const checkoutWatch = dbSource.indexOf("registerBakongKhqrWorkerWatch({ md5: generated!.md5, orderId: input.orderId");
    expect(checkoutInsert).toBeGreaterThan(-1);
    expect(checkoutWatch).toBeGreaterThan(checkoutInsert);
  });

  it("requires a fresh server-side Bakong match before callback reconciliation credits a session", () => {
    expect(dbSource).toContain("expectedMerchantAccountId: merchantAccountId");
    expect(dbSource).toContain("lastWorkerVerificationMd5: input.md5");
    expect(dbSource).toContain("lastWorkerVerificationStatus: verification.status");
    expect(dbSource).toContain("providerTransactionId: verification.transactionHash");
    expect(dbSource).toContain("Bakong did not confirm the stored Wallet payment session.");
    expect(dbSource).toContain("Bakong did not confirm the stored checkout payment session.");
  });
});
