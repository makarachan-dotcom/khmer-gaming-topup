/** Shared helpers so stacked weekly passes can buy the same FZR offer N times. */

export function topupOrderQuantity(details: Record<string, unknown>) {
  const quantity = typeof details.quantity === "number" ? details.quantity : Number(details.quantity);
  if (!Number.isInteger(quantity)) return 1;
  return Math.min(9, Math.max(1, quantity));
}

export function readSubmittedProviderOrderIds(details: Record<string, unknown>) {
  const listed = Array.isArray(details.providerOrderIds)
    ? details.providerOrderIds.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : [];
  if (listed.length) return [...listed];
  if (typeof details.providerOrderId === "string" && details.providerOrderId.trim()) return [details.providerOrderId];
  return [];
}

export function fzrIdempotencyKey(orderId: string, attemptIndex: number, quantity: number) {
  if (quantity <= 1 && attemptIndex === 0) return `zurs-${orderId}`;
  return `zurs-${orderId}-${attemptIndex}`;
}
