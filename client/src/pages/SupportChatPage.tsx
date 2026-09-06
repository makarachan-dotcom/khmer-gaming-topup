import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import SupportChat from "@/components/SupportChat";

/**
 * zurs.me/chat
 *
 * Live support is a real page now, not an overlay bolted onto the storefront.
 * The mascot in the header links here, and a purchase row in the account page
 * links here with ?order=<reference> so the chat opens pre-seeded.
 */
export default function SupportChatPage() {
  const [, setLocation] = useLocation();

  const seed = useMemo(() => {
    if (typeof window === "undefined") return { topic: null as string | null, orderRef: null as string | null };
    const params = new URLSearchParams(window.location.search);
    const topic = params.get("topic");
    const order = params.get("order");
    return {
      topic: topic && topic.trim().length > 0 ? topic.trim() : null,
      orderRef: order && order.trim().length > 0 ? order.trim() : null,
    };
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = "ជំនួយផ្ទាល់ · ZURS.me";
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <main className="zs-page">
      <SupportChat
        open
        onClose={() => setLocation("/")}
        seedTopic={seed.topic}
        seedOrderRef={seed.orderRef}
      />
    </main>
  );
}
