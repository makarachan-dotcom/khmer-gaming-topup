import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("checkout redesign contract", () => {
  it("renders the official Bakong KHQR card with red header, merchant, amount, and scan hint", () => {
    const card = read("client/src/components/BakongKhqrCard.tsx");
    const styles = read("client/src/index.css");
    const checkout = read("client/src/pages/Checkout.tsx");
    expect(card).toContain('className="bakong-card__logo">KHQR');
    expect(card).toContain("bakong-card__merchant");
    expect(card).toContain("bakong-card__amount");
    expect(card).toContain("bakong-card__divider");
    expect(styles).toContain("background: #e21836");
    expect(styles).toContain(".bakong-card__fold");
    expect(checkout).toContain('merchantName="ZURS STORE"');
    expect(checkout).toContain("ស្កេនជាមួយ ABA, Bakong, Wing, ACLEDA ឬ app KHQR ណាមួយ");
  });

  it("removes the payment-method section from the checkout session page", () => {
    const checkout = read("client/src/pages/Checkout.tsx");
    expect(checkout).not.toContain("PaymentMethodCards");
    expect(checkout).not.toContain("PAYMENT METHOD");
  });

  it("shows an order-summary confirm step with explicit confirm and edit actions before the QR", () => {
    const checkout = read("client/src/pages/Checkout.tsx");
    expect(checkout).toContain("ពិនិត្យ និងបញ្ជាក់ការបញ្ជាទិញ");
    expect(checkout).toContain("checkout-confirm-actions");
    expect(checkout).toContain("បញ្ជាក់ និងបង្កើត KHQR");
    expect(checkout).toContain("កែប្រែការបញ្ជាទិញ");
    expect(checkout).toContain("window.history.back()");
  });

  it("caps concurrent pending KHQR payments at two on both the server and the confirm step", () => {
    const db = read("server/db.ts");
    const routers = read("server/routers.ts");
    const checkout = read("client/src/pages/Checkout.tsx");
    expect(db).toContain("export const pendingKhqrPaymentLimit = 2");
    expect(db).toContain("countPendingKhqrPayments");
    expect(db).toContain('{ code: "PENDING_PAYMENT_LIMIT" }');
    expect(db).toContain("await assertPendingKhqrPaymentCapacity(input.userId);");
    expect(db).toContain("await assertPendingKhqrPaymentCapacity(input.userId, input.orderId);");
    expect(routers).toContain("pendingPaymentCount: protectedProcedure.query");
    expect(checkout).toContain("pendingLimitReached");
    expect(checkout).toContain("trpc.orders.pendingPaymentCount.useQuery");
  });

  it("plays the ten-second Khmer sampeah celebration only on the pending → paid transition", () => {
    const celebration = read("client/src/components/SampeahCelebration.tsx");
    const checkout = read("client/src/pages/Checkout.tsx");
    const styles = read("client/src/index.css");
    expect(celebration).toContain("const celebrationDurationMs = 10_000");
    expect(celebration).toContain("window.setTimeout(onClose, celebrationDurationMs)");
    expect(celebration).toContain("អរគុណច្រើន!");
    expect(checkout).toContain('previousStatus.current !== "paid" && paymentStatus === "paid"');
    expect(checkout).toContain("<SampeahCelebration open={celebrate}");
    expect(styles).toContain("sampeah-petal-fall");
  });

  it("animates a drawn sampeah person: bowing torso, nodding head, rising joined palms, blinking eyes", () => {
    const figure = read("client/src/components/SampeahFigure.tsx");
    const celebration = read("client/src/components/SampeahCelebration.tsx");
    const styles = read("client/src/index.css");
    expect(figure).toContain('aria-label="មនុស្សសំពះ"');
    expect(figure).toContain("sampeah-figure__bow");
    expect(figure).toContain("sampeah-figure__hands");
    expect(figure).toContain("sampeah-figure__head");
    expect(figure).toContain("sampeah-figure__eyes");
    expect(celebration).toContain("<SampeahFigure />");
    expect(celebration).not.toContain("🙏");
    expect(styles).toContain("@keyframes sampeah-figure-bow");
    expect(styles).toContain("@keyframes sampeah-figure-nod");
    expect(styles).toContain("@keyframes sampeah-figure-hands");
    expect(styles).toContain("@keyframes sampeah-figure-blink");
  });
});
