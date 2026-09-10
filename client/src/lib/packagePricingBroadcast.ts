/**
 * Cross-tab notice that an admin changed a package price.
 *
 * Prices are the single source of truth for both the storefront label and the
 * KHQR amount, so the storefront must never keep showing an old number after the
 * owner has saved a new one. A BroadcastChannel ping reaches other tabs in the
 * SAME browser instantly; `refetchInterval` on the storefront query covers other
 * devices, where the admin is usually signed in.
 *
 * Only the game id travels over the channel — never a price — so a forged
 * message can never make a browser display an amount the server would not mint
 * a QR for.
 */
const channelName = "zurs-package-pricing";

export function notifyPackagePricingChanged(gameId?: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({ gameId: gameId ?? "" });
  channel.close();
}

export function subscribeToPackagePricingChanges(callback: (gameId: string) => void) {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const payload = event.data;
    if (!payload || typeof payload !== "object" || !("gameId" in payload)) return;
    const gameId = (payload as { gameId?: unknown }).gameId;
    if (typeof gameId === "string") callback(gameId);
  };
  return () => channel.close();
}
