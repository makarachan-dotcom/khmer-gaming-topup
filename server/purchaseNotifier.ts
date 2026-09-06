import { escapeHtml, notifyAdmins } from "./telegramBot";

/**
 * "New purchase" push to the operator's Telegram.
 *
 * Called from the payment reconciliation path, which is the single place a
 * payment actually becomes money. Two hard rules:
 *
 * 1. It is fire-and-forget and can never throw. A Telegram outage must not
 *    roll back or retry a confirmed payment.
 * 2. It fires only when the reconciliation genuinely credited the order, so a
 *    duplicate webhook does not produce a duplicate notification.
 *
 * Deliberately kept to identifiers and amounts. It does not import from `db`,
 * both to avoid a circular import and so a phone notification never carries
 * customer contact details.
 */

function formatAmount(amount: string | number, currency: string): string {
  const numeric = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numeric)) return `${String(amount)} ${currency}`;
  const formatted =
    currency === "KHR"
      ? `${Math.round(numeric).toLocaleString("en-US")} \u17DB`
      : `$${numeric.toFixed(2)}`;
  return formatted;
}

export async function notifyPurchase(input: {
  orderId: string;
  amount: string | number;
  currency: string;
  reference?: string | null;
}): Promise<void> {
  try {
    const isWallet = input.orderId.startsWith("wallet:");
    const heading = isWallet ? "\u{1F4B0} <b>បញ្ចូលប្រាក់ថ្មី</b>" : "\u{1F6CD}\uFE0F <b>ការកម្មង់ថ្មី</b>";

    await notifyAdmins(
      [
        heading,
        `Amount: <b>${escapeHtml(formatAmount(input.amount, input.currency))}</b>`,
        `Order: <code>${escapeHtml(input.orderId)}</code>`,
        input.reference ? `Ref: <code>${escapeHtml(input.reference)}</code>` : null,
        `Time: ${new Date().toISOString()}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  } catch (error) {
    console.warn("[telegram] purchase notification failed", error);
  }
}
