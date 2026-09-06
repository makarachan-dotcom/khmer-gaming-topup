import { useEffect } from "react";
import { useLocation } from "wouter";
import { SUPPORT_CHAT_OPEN_EVENT, SUPPORT_CHAT_PATH } from "@/lib/supportChat";

/**
 * Mounted once in the storefront layout. Turns "open support chat" clicks
 * (mascot, purchase history, login screen) into a client-side route change to
 * the dedicated `/chat` page — no full reload, no floating panel.
 */
export function SupportChatLauncher() {
  const [location, navigate] = useLocation();

  useEffect(() => {
    const handler = (event: Event) => {
      // Tells `openSupportChat()` that the SPA handled the navigation.
      event.preventDefault();
      if (location === SUPPORT_CHAT_PATH) {
        window.dispatchEvent(new CustomEvent("zurs:support-chat-refresh"));
        return;
      }
      navigate(SUPPORT_CHAT_PATH);
    };
    window.addEventListener(SUPPORT_CHAT_OPEN_EVENT, handler);
    return () => window.removeEventListener(SUPPORT_CHAT_OPEN_EVENT, handler);
  }, [location, navigate]);

  return null;
}

export default SupportChatLauncher;
