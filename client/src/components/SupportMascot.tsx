import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

/**
 * Header mascot.
 *
 * Round 6: the mascot is a header control, not a floating overlay, and it no
 * Tapping it navigates to the dedicated /chat page. The greeting bubble hangs
 * UNDER the mascot (not left across the ZURS.me wordmark) and wraps instead of
 * clipping.
 */

export type SupportChatRequest = { orderRef?: string | null; topic?: string | null };

/**
 * Support lives at its own route now, so "requesting" support is a navigation.
 * Kept as a plain function because the callers are imperative handlers, e.g. a
 * purchase row in the account page.
 */
export function requestSupportChat(detail?: SupportChatRequest) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  if (detail && detail.orderRef) params.set("order", detail.orderRef);
  if (detail && detail.topic) params.set("topic", detail.topic);
  const query = params.toString();
  window.location.assign(query.length > 0 ? "/chat?" + query : "/chat");
}

function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good night";
}

export default function SupportMascot() {
  const [phase, setPhase] = useState<"greeting" | "prompt">("greeting");
  const [bubbleShown, setBubbleShown] = useState(true);
  const greeting = useMemo(() => greetingFor(new Date()), []);

  /* Greet once on arrival, then stay quiet. Repeating every 10s crowded the
   * header and made the storefront feel noisy on a phone. */
  useEffect(() => {
    const hide = window.setTimeout(() => setBubbleShown(false), 4800);
    const settle = window.setTimeout(() => setPhase("prompt"), 4800);
    return () => {
      window.clearTimeout(hide);
      window.clearTimeout(settle);
    };
  }, []);

  return (
    <div className="zs-mascot">
      {bubbleShown ? (
        <span className={`zs-mascot__bubble zs-mascot__bubble--${phase}`}>
          {phase === "greeting" ? greeting : "ត្រូវការជំនួយ?"}
        </span>
      ) : null}
      <Link
        href="/chat"
        className="zs-mascot__btn"
        aria-label="ត្រូវការជំនួយ? ចុចដើម្បីឆាតជាមួយក្រុមជំនួយ"
      >
        <span className="zs-mascot__ping" aria-hidden="true" />
        <svg className="zs-mascot__svg" viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
          <line x1="24" y1="8" x2="24" y2="14" stroke="#8d97b2" strokeWidth="1.6" strokeLinecap="round" />
          <circle className="zs-mascot__antenna" cx="24" cy="6.5" r="2.6" fill="#38bdf8" />
          <rect x="8" y="14" width="32" height="28" rx="10" fill="#f4f7fb" stroke="#38bdf8" strokeWidth="1.6" />
          <rect x="12" y="19" width="24" height="15" rx="7" fill="#e8f4ff" />
          <g className="zs-mascot__eyes">
            <circle cx="19" cy="26" r="2.9" fill="#7dd3fc" />
            <circle cx="29" cy="26" r="2.9" fill="#7dd3fc" />
            <circle cx="20" cy="25" r="0.9" fill="#ffffff" />
            <circle cx="30" cy="25" r="0.9" fill="#ffffff" />
          </g>
          <path d="M20 37.5 Q24 40 28 37.5" stroke="#7dd3fc" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <circle cx="14.5" cy="31" r="2" fill="#f472b6" opacity="0.55" />
          <circle cx="33.5" cy="31" r="2" fill="#f472b6" opacity="0.55" />
          <path className="zs-mascot__hand" d="M40 25 q5 -2 5 -8" stroke="#38bdf8" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        </svg>
      </Link>
    </div>
  );
}
