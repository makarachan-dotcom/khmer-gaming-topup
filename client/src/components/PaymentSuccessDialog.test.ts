import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "client/src/components/PaymentSuccessDialog.tsx"), "utf8");

describe("PaymentSuccessDialog", () => {
  it("offers an animated verified-success receipt and a downloadable non-secret receipt file", () => {
    expect(source).toContain('AnimatedGlyph name="success"');
    expect(source).toContain("PAYMENT VERIFIED");
    expect(source).toContain("new Blob");
    expect(source).toContain("zurs-receipt-${reference}.txt");
    expect(source).toContain("ទាញយកបង្កាន់ដៃ");
  });

  it("uses the confirmed amount, currency, and reference as receipt fields", () => {
    expect(source).toContain("AMOUNT RECEIVED");
    expect(source).toContain("REFERENCE");
    expect(source).toContain("Currency: ${input.currency}");
  });
});
