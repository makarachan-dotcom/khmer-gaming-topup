import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("owner payment-control quick-toggle contract", () => {
  it("keeps the owner switch actionable while actual payment processing remains separately readiness-gated", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPayment.tsx"), "utf8");
    const readiness = readFileSync(resolve(process.cwd(), "server/paymentReadiness.ts"), "utf8");
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(page).toContain("const customerPaymentsAvailable = enabled && ready;");
    expect(page).toContain("disabled={control.isLoading || update.isPending}");
    expect(page).toContain("Actual payment processor និង merchant readiness");
    expect(readiness).toContain('reason: "payment_switch_off"');
    expect(database).toContain("requirePublicPaymentEnabled();");
  });

  it("exposes owner-managed payment methods without embedding merchant credentials in the editor", () => {
    const page = readFileSync(resolve(process.cwd(), "client/src/pages/AdminPayment.tsx"), "utf8");
    const router = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    const database = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");

    expect(page).toContain("គ្រប់គ្រងវិធីបង់ប្រាក់");
    expect(page).toContain("trpc.admin.paymentMethods.useQuery()");
    expect(page).toContain("trpc.admin.savePaymentMethod.useMutation");
    expect(page).toContain("Upload icon");
    expect(page).toContain("Bakong KHQR");
    expect(router).toContain("paymentMethods: ownerProcedure.query");
    expect(router).toContain("savePaymentMethod: ownerProcedure.input");
    expect(database).toContain('const paymentMethodContentPrefix = "payment-method:"');
    expect(database).not.toContain("merchantSecret");
  });
});
