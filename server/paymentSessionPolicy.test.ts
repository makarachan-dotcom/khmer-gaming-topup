import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectFile = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("five-minute KHQR payment-session policy", () => {
  it("uses a five-minute payment window with exact currency reconciliation", () => {
    const khqr = projectFile("server/bakongKhqr.ts");
    const reconciliation = projectFile("server/khqrReconciliation.ts");
    expect(khqr).toContain("khqrPaymentWindowMs = 5 * 60 * 1000");
    expect(khqr).toContain("const expiry = new Date(Date.now() + khqrPaymentWindowMs)");
    expect(reconciliation).toContain("callback.currency !== stored.currency");
  });

  it("limits direct manual checks to two and retains a single active Wallet session", () => {
    const schema = projectFile("drizzle/schema.ts");
    const database = projectFile("server/db.ts");
    expect(schema).toContain("manualCheckCount: int(\"manualCheckCount\").default(0).notNull()");
    expect(schema).toContain("activeSessionKey: varchar(\"activeSessionKey\", { length: 64 })");
    expect(database).toContain("lt(walletTopups.manualCheckCount, 2)");
    expect(database).toContain("lt(paymentTransactions.manualCheckCount, 2)");
    expect(database).toContain("activeSessionKey: db ? `wallet:${input.userId}` : null");
    expect(database).toContain("requireNoOtherOpenPayment");
  });

  it("renders bounded automatic checking and the two-check allowance in both payment screens", () => {
    const wallet = projectFile("client/src/pages/Wallet.tsx");
    const checkout = projectFile("client/src/pages/Checkout.tsx");
    expect(wallet).toContain("session.refetch(), 10_000");
    expect(wallet).toContain("active.manualChecksRemaining}/2");
    expect(wallet).toContain("USD · ដុល្លារ");
    expect(checkout).toContain("session.refetch(), 10_000");
    expect(checkout).toContain("payment.manualChecksRemaining}/2");
    expect(checkout).toContain("រយៈពេល 5 នាទី");
  });

  it("keeps the verified account bar privacy-safe and scroll-aware", () => {
    const gameTopup = projectFile("client/src/pages/GameTopup.tsx");
    const verifiedBar = projectFile("client/src/components/VerifiedAccountBar.tsx");
    expect(gameTopup).toContain("IntersectionObserver");
    expect(gameTopup).toContain("fields={providerFields ?? {}}");
    expect(verifiedBar).toContain("z-[70]");
    expect(verifiedBar).toContain("•••${value.slice(-4)}");
  });
});
