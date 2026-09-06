import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("streamdown", () => ({ Streamdown: () => null }));

describe("secure checkout payment page", () => {
  it("uses the owner-scoped payment session and only polls the ledger every ten seconds while a KHQR session is pending", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    expect(source).toContain("trpc.orders.paymentSession.useQuery({ orderId }");
    expect(source).toContain("payment.status === \"pending\"");
    expect(source).toContain("window.setInterval(checkPayment, 10_000)");
    expect(source).toContain("void refreshPayment.mutateAsync({ orderId }).finally(() => { void session.refetch(); })");
    expect(source).toContain("if (!waitingForBakong) return");
    expect(source).not.toContain("check_transaction_by_md5");
  });

  it("renders the exact PAID rubber-stamp markup only after the stored payment status is paid", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(source).toContain('<div className="fx-stamp">PAID</div>');
    expect(source).toContain("{paid ? <div className=\"fx-stamp\">PAID</div> : null}");
    expect(styleSource).toContain(".fx-stamp");
    expect(styleSource).toContain("animation: fx-stamp 3.2s cubic-bezier(.22, 1.4, .36, 1) infinite");
    expect(styleSource).toContain("--ink-2: #16a34a");
  });

  it("limits customer-facing payment methods to KHQR and uses the local KHQR logo asset", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    const paymentGateSource = readFileSync(join(process.cwd(), "client/src/components/PaymentMethodGate.tsx"), "utf8");
    const assetSource = readFileSync(join(process.cwd(), "client/src/lib/mobileLegendsAssets.ts"), "utf8");
    expect(source).toContain("KHQR តែប៉ុណ្ណោះ");
    expect(source).toContain('methods.filter((method) => method.providerKey === "bakong_khqr")');
    expect(paymentGateSource).toContain('filter((method) => method.providerKey === "bakong_khqr")');
    expect(paymentGateSource).toContain("ទទួលការទូទាត់តាម KHQR ប៉ុណ្ណោះ");
    expect(assetSource).toContain('khqrLogoUrl = "/khqr-logo.svg"');
  });

  it("shows the verified username instead of Game ID and blocks required games without a verified username", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    expect(source).toContain('if (!product?.playerId)');
    expect(source).toContain('product.requiresVerifiedPlayerName && !product.playerName');
    expect(source).toContain("Check ID រហូតទទួលបាន Username");
    expect(source).toContain('<SummaryDetail label="Username" value={product.playerName} />');
    expect(source).toContain('<SummaryDetail label="Server ID" value={maskCustomerIdentifier(product.zoneId || "មិនទាមទារ")} />');
  });

  it("includes a printable receipt, the animated success pipeline, and masks customer identifiers in the payment page", () => {
    const source = readFileSync(join(process.cwd(), "client/src/pages/Checkout.tsx"), "utf8");
    const pipelineSource = readFileSync(join(process.cwd(), "client/src/components/PaymentSuccessPipeline.tsx"), "utf8");
    const styleSource = readFileSync(join(process.cwd(), "client/src/index.css"), "utf8");
    expect(source).toContain("បង្កាន់ដៃទូទាត់");
    expect(source).toContain("Download / Print Receipt");
    expect(source).toContain("<PaymentSuccessPipeline");
    expect(pipelineSource).toContain("Payment received");
    expect(pipelineSource).toContain("Delivering to your account");
    expect(pipelineSource).toContain("Completed");
    expect(source).not.toContain("Provider top-up");
    expect(source).not.toContain("no provider top-up");
    expect(source).toContain("maskCustomerIdentifier");
    expect(styleSource).toContain("@media print");
    expect(styleSource).toContain(".receipt-paper");
  });
});
