import { describe, expect, it } from "vitest";
import {
  PaymentSecurityError,
  assertOrderAmountIntegrity,
  assertPackagePriceIntegrity,
  assessOrderVelocity,
  isFreshWebhookTimestamp,
  moneyEquals,
  bakongPaidAmountMatches,
  normalizeBakongCurrency,
  toMinorUnits,
  webhookReplayKey,
  webhookTimestampToleranceMs,
} from "./paymentSecurity";

function codeOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    return error instanceof PaymentSecurityError ? error.code : "WRONG_ERROR_TYPE";
  }
  return "NO_ERROR";
}

describe("money parsing", () => {
  it("parses plain decimal USD into cents", () => {
    expect(toMinorUnits("2.00", "USD")).toBe(200);
    expect(toMinorUnits("0.02", "USD")).toBe(2);
    expect(toMinorUnits(19.99, "USD")).toBe(1999);
  });

  it("treats KHR as a zero-decimal currency", () => {
    expect(toMinorUnits("20000", "KHR")).toBe(20000);
    // Riel has no minor unit, so a fractional amount is not representable.
    expect(toMinorUnits("20000.50", "KHR")).toBeNull();
  });

  it("rejects the notations that make amount-confusion bugs possible", () => {
    for (const value of ["1e3", "0x10", "-2.00", "2.005", "", "abc", "2,00", "+2", "Infinity", "2 0", "2.", ".5"]) {
      expect(toMinorUnits(value, "USD"), value).toBeNull();
    }
    expect(toMinorUnits(Number.NaN, "USD")).toBeNull();
    expect(toMinorUnits(Number.POSITIVE_INFINITY, "USD")).toBeNull();
  });

  it("tolerates surrounding whitespace so a padded ledger value still settles", () => {
    // Refusing padding would block a real payment, not stop a fraudulent one.
    expect(toMinorUnits(" 2.00 ", "USD")).toBe(200);
    expect(moneyEquals(" 2.00 ", "2", "USD")).toBe(true);
  });

  it("compares money exactly, unlike Number()", () => {
    expect(moneyEquals("2.00", "2", "USD")).toBe(true);
    expect(moneyEquals("2.00", "2.01", "USD")).toBe(false);
    // Number("2.00000001") !== 2 but both round to 200 cents; strict parsing
    // refuses the over-precise side instead of silently accepting it.
    expect(moneyEquals("2.00", "2.00000001", "USD")).toBe(false);
    expect(moneyEquals("2.00", "2e0", "USD")).toBe(false);
  });
});

describe("Bakong USD KHQR settled in riel", () => {
  it("accepts the NBC-band conversion used by ABA/PRASAC ($0.02 → 81៛)", () => {
    expect(bakongPaidAmountMatches({ expectedAmount: "0.02", expectedCurrency: "USD", actualAmount: 81, actualCurrency: "KHR" })).toBe(true);
    expect(bakongPaidAmountMatches({ expectedAmount: "0.02", expectedCurrency: "USD", actualAmount: 80, actualCurrency: "KHR" })).toBe(true);
    expect(bakongPaidAmountMatches({ expectedAmount: "0.02", expectedCurrency: "USD", actualAmount: 82, actualCurrency: "KHR" })).toBe(true);
  });

  it("rejects a tiny riel payment against a large USD QR", () => {
    expect(bakongPaidAmountMatches({ expectedAmount: "50.00", expectedCurrency: "USD", actualAmount: 81, actualCurrency: "KHR" })).toBe(false);
  });

  it("reads Bakong numeric currency codes", () => {
    expect(normalizeBakongCurrency(840)).toBe("USD");
    expect(normalizeBakongCurrency("116")).toBe("KHR");
    expect(normalizeBakongCurrency("usd")).toBe("USD");
  });
});

describe("order amount integrity", () => {
  it("accepts a normal order total", () => {
    expect(assertOrderAmountIntegrity({ amount: "1.50", currency: "USD" }).minorUnits).toBe(150);
  });

  it("refuses zero, malformed and out-of-band totals", () => {
    expect(codeOf(() => assertOrderAmountIntegrity({ amount: "0.00", currency: "USD" }))).toBe("AMOUNT_NOT_POSITIVE");
    expect(codeOf(() => assertOrderAmountIntegrity({ amount: "abc", currency: "USD" }))).toBe("AMOUNT_MALFORMED");
    expect(codeOf(() => assertOrderAmountIntegrity({ amount: "999999", currency: "USD" }))).toBe("AMOUNT_ABOVE_CEILING");
    expect(codeOf(() => assertOrderAmountIntegrity({ amount: "99999999", currency: "KHR" }))).toBe("AMOUNT_ABOVE_CEILING");
  });
});

describe("package price anti-tamper", () => {
  it("accepts a row whose price matches base plus margin", () => {
    const result = assertPackagePriceIntegrity({ priceUsd: "1.20", basePriceUsd: "1.00", profitMarginPercent: "20", quantity: 2 });
    expect(result.subtotal).toBe("2.40");
  });

  it("refuses a price edited away from base plus margin", () => {
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "0.10", basePriceUsd: "1.00", profitMarginPercent: "20", quantity: 1 }))).toBe("PRICE_BELOW_COST");
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "5.00", basePriceUsd: "1.00", profitMarginPercent: "20", quantity: 1 }))).toBe("PRICE_MARGIN_MISMATCH");
  });

  it("refuses a zeroed or negative price", () => {
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "0.00", basePriceUsd: "1.00", profitMarginPercent: "20", quantity: 1 }))).toBe("PRICE_NOT_POSITIVE");
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "-1.00", basePriceUsd: "1.00", profitMarginPercent: "20", quantity: 1 }))).toBe("PRICE_MALFORMED");
  });

  it("refuses an absurd margin", () => {
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "2.00", basePriceUsd: "1.00", profitMarginPercent: "99999", quantity: 1 }))).toBe("MARGIN_ABOVE_CEILING");
  });

  it("skips cost checks when the base price was never recorded", () => {
    // basePriceUsd defaults to 0.00 in the schema. Legacy rows must still sell.
    expect(assertPackagePriceIntegrity({ priceUsd: "2.00", basePriceUsd: "0.00", profitMarginPercent: "0.00", quantity: 1 }).subtotal).toBe("2.00");
    expect(assertPackagePriceIntegrity({ priceUsd: "2.00", basePriceUsd: null, profitMarginPercent: null, quantity: 1 }).subtotal).toBe("2.00");
  });

  it("tolerates one cent of stored rounding", () => {
    // 0.99 * 1.15 = 1.1385 -> stored as 1.14, recomputed as 1.14.
    expect(assertPackagePriceIntegrity({ priceUsd: "1.14", basePriceUsd: "0.99", profitMarginPercent: "15", quantity: 1 }).subtotal).toBe("1.14");
    expect(assertPackagePriceIntegrity({ priceUsd: "1.13", basePriceUsd: "0.99", profitMarginPercent: "15", quantity: 1 }).subtotal).toBe("1.13");
  });

  it("refuses quantities outside the storefront range", () => {
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "1.00", basePriceUsd: "1.00", profitMarginPercent: "0", quantity: 0 }))).toBe("QUANTITY_OUT_OF_RANGE");
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "1.00", basePriceUsd: "1.00", profitMarginPercent: "0", quantity: 99 }))).toBe("QUANTITY_OUT_OF_RANGE");
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "1.00", basePriceUsd: "1.00", profitMarginPercent: "0", quantity: 1.5 }))).toBe("QUANTITY_OUT_OF_RANGE");
  });

  it("blocks a quantity that would push the total over the ceiling", () => {
    expect(codeOf(() => assertPackagePriceIntegrity({ priceUsd: "1000.00", basePriceUsd: "0", profitMarginPercent: "0", quantity: 9 }))).toBe("AMOUNT_ABOVE_CEILING");
  });
});

describe("webhook replay defences", () => {
  const now = Date.parse("2026-09-01T00:00:00.000Z");

  it("accepts a callback inside the freshness window", () => {
    expect(isFreshWebhookTimestamp("2026-09-01T00:00:00.000Z", now)).toBe(true);
    expect(isFreshWebhookTimestamp(new Date(now - webhookTimestampToleranceMs + 1_000).toISOString(), now)).toBe(true);
  });

  it("refuses a captured body once it goes stale", () => {
    expect(isFreshWebhookTimestamp(new Date(now - webhookTimestampToleranceMs - 1_000).toISOString(), now)).toBe(false);
  });

  it("refuses a future-dated stamp so skew cannot extend a capture", () => {
    expect(isFreshWebhookTimestamp(new Date(now + webhookTimestampToleranceMs + 1_000).toISOString(), now)).toBe(false);
  });

  it("refuses a missing or unparseable stamp", () => {
    expect(isFreshWebhookTimestamp(undefined, now)).toBe(false);
    expect(isFreshWebhookTimestamp("not-a-date", now)).toBe(false);
  });

  it("derives one stable nonce per money-moving identity", () => {
    const callback = { event: "payment.paid", md5: "ABCDEF0123456789", orderId: "order-1", amount: "2.00", currency: "USD", timestamp: "2026-09-01T00:00:00.000Z" };
    expect(webhookReplayKey(callback)).toBe(webhookReplayKey({ ...callback, md5: callback.md5.toLowerCase() }));
    for (const changed of [{ amount: "3.00" }, { orderId: "order-2" }, { currency: "KHR" }, { event: "payment.expired" }, { timestamp: "2026-09-01T00:00:01.000Z" }]) {
      expect(webhookReplayKey({ ...callback, ...changed })).not.toBe(webhookReplayKey(callback));
    }
  });
});

describe("order velocity anti-cheat", () => {
  const now = Date.parse("2026-09-01T00:00:00.000Z");
  const unpaid = (count: number) => Array.from({ length: count }, () => ({ createdAt: now - 60_000, status: "awaiting_payment" }));

  it("allows a normal shopper", () => {
    expect(assessOrderVelocity(unpaid(3), { now }).blocked).toBe(false);
  });

  it("blocks an account stacking unpaid orders with nothing settled", () => {
    const verdict = assessOrderVelocity(unpaid(12), { now });
    expect(verdict.blocked).toBe(true);
    expect(verdict.reason).toBe("ORDER_VELOCITY_BLOCKED");
  });

  it("never blocks a customer who actually pays", () => {
    const samples = [...unpaid(20), { createdAt: now - 30_000, status: "paid" }];
    expect(assessOrderVelocity(samples, { now }).blocked).toBe(false);
  });

  it("ignores activity outside the window", () => {
    const stale = Array.from({ length: 30 }, () => ({ createdAt: now - 5 * 60 * 60 * 1000, status: "awaiting_payment" }));
    expect(assessOrderVelocity(stale, { now }).blocked).toBe(false);
  });
});
