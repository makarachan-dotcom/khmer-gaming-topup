import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("owner payment-control quick-toggle contract", () => {
  it("keeps the owner switch actionable while customer payment availability remains separately readiness-gated", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPayment.tsx"), "utf8");
    const readiness = readFileSync(resolve(process.cwd(), "server/paymentReadiness.ts"), "utf8");
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(page).toContain("const customerPaymentsAvailable = enabled && ready;");
    expect(page).toContain("disabled={control.isLoading || update.isPending}");
    expect(page).not.toContain("disabled={control.isLoading || update.isPending || (!enabled");
    expect(page).toContain("customer payment នៅតែត្រូវ readiness gate");
    expect(readiness).toContain('reason: "payment_switch_off"');
    expect(database).toContain("requirePublicPaymentEnabled();");
  });
});
