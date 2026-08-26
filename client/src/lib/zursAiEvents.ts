export const aiOpenIntentKey = "zurs:ai:open-intent";

export function openZursAiChat() {
  window.sessionStorage.setItem(aiOpenIntentKey, "1");
  window.dispatchEvent(new Event("zurs:open-ai-chat"));
}
