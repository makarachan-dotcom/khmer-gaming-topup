import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const dbSource = readFileSync(resolve(import.meta.dirname, "db.ts"), "utf8");

describe("wallet KHQR worker integration", () => {
  it("registers the worker watch only after persisting a primary-ledger wallet session", () => {
    const insertIndex = dbSource.indexOf("await db.insert(walletTopups).values(record);");
    const watchIndex = dbSource.indexOf("registerBakongKhqrWorkerWatch({ md5: generated.md5, orderId: `wallet:${record.id}`");
    expect(insertIndex).toBeGreaterThan(-1);
    expect(watchIndex).toBeGreaterThan(insertIndex);
  });

  it("reuses an unexpired pending Wallet session before generating another QR or worker watch", () => {
    const activeLookupIndex = dbSource.indexOf('const active = await db.select().from(walletTopups)');
    const existingReturnIndex = dbSource.indexOf('if (active[0]) return walletTopupPayload(active[0]);');
    const generateIndex = dbSource.indexOf('const generated = await createBakongKhqrPayment');
    expect(activeLookupIndex).toBeGreaterThan(-1);
    expect(existingReturnIndex).toBeGreaterThan(activeLookupIndex);
    expect(generateIndex).toBeGreaterThan(existingReturnIndex);
  });

  it("routes wallet-prefixed worker callbacks through exact wallet reconciliation", () => {
    expect(dbSource).toContain('if (input.orderId.startsWith("wallet:"))');
    expect(dbSource).toContain("getKhqrWalletReconciliationDisposition");
    expect(dbSource).toContain("onDuplicateKeyUpdate({ set: { balanceKhr:");
  });
});
