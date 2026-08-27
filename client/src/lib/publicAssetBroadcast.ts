export type PublicAssetArea = "game-images" | "contact-admins";

const channelName = "zurs-public-asset-refresh";

export function notifyPublicAssetChanged(area: PublicAssetArea) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({ area });
  channel.close();
}

export function subscribeToPublicAssetChanges(callback: (area: PublicAssetArea) => void) {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const payload = event.data;
    if (!payload || typeof payload !== "object" || !("area" in payload)) return;
    const area = payload.area;
    if (area === "game-images" || area === "contact-admins") callback(area);
  };
  return () => channel.close();
}
