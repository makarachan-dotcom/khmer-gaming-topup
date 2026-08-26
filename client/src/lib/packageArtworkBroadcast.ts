const channelName = "zurs-package-artwork";

export function notifyPackageArtworkChanged(gameId: string) {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({ gameId });
  channel.close();
}

export function subscribeToPackageArtworkChanges(callback: (gameId: string) => void) {
  if (typeof BroadcastChannel === "undefined") return () => undefined;
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const payload = event.data;
    if (payload && typeof payload === "object" && "gameId" in payload && typeof payload.gameId === "string") callback(payload.gameId);
  };
  return () => channel.close();
}
