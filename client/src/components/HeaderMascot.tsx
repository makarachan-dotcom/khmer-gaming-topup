import { useCallback, useEffect, useRef, useState } from "react";
import { MASCOT_HELP_TEXT, mascotGreeting, openSupportChat } from "@/lib/supportChat";

/**
 * ZURS header mascot — the little robot (ប្អូន robot កំដរ) in the top-right of
 * the header. It is now the front door to live support.
 *
 * Behaviour asked for by the shop owner:
 *   1. When a visitor lands, greet by local clock — "Good morning" /
 *      "Good afternoon" (with the Khmer line under it).
 *   2. After ~10s the bubble morphs into "ត្រូវការជំនួយ?" and keeps
 *      re-asking every 10 seconds until it is dismissed or used.
 *   3. Clicking the robot opens the live support chat.
 *
 * Eyes blink on their own, pupils track the cursor, and everything respects
 * `prefers-reduced-motion`.
 */

const GREETING_MS = 10_000;
const NUDGE_MS = 10_000;

export function HeaderMascot() {
  const pupilsRef = useRef<SVGGElement | null>(null);
  const [greeting] = useState(() => mascotGreeting(new Date()));
  const [phase, setPhase] = useState<"greeting" | "help">("greeting");
  const [bubbleVisible, setBubbleVisible] = useState(true);
  const [muted, setMuted] = useState(false);
  // Bumped on every nudge so the bubble replays its entrance animation.
  const [nudge, setNudge] = useState(0);

  /* Pupils follow the cursor. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = pupilsRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = Math.max(-1.6, Math.min(1.6, (event.clientX - cx) / 60));
        const dy = Math.max(-1.2, Math.min(1.2, (event.clientY - cy) / 60));
        el.style.transform = `translate(${dx}px, ${dy}px)`;
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  /* Greeting → help text. */
  useEffect(() => {
    if (muted) return;
    const timer = window.setTimeout(() => {
      setPhase("help");
      setBubbleVisible(true);
      setNudge((value) => value + 1);
    }, GREETING_MS);
    return () => window.clearTimeout(timer);
  }, [muted]);

  /* "ត្រូវការជំនួយ?" every 10 seconds: hide briefly, then pop back in. */
  useEffect(() => {
    if (muted || phase !== "help") return;
    const timer = window.setInterval(() => {
      setBubbleVisible(false);
      window.setTimeout(() => {
        setBubbleVisible(true);
        setNudge((value) => value + 1);
      }, 900);
    }, NUDGE_MS);
    return () => window.clearInterval(timer);
  }, [muted, phase]);

  const openChat = useCallback(() => {
    setMuted(true);
    setBubbleVisible(false);
    openSupportChat({});
  }, []);

  const dismiss = useCallback(() => {
    setMuted(true);
    setBubbleVisible(false);
  }, []);

  const helping = phase === "help";
  const bubbleText = helping ? MASCOT_HELP_TEXT : greeting.en;
  const bubbleSub = helping ? "ចុចនៅទីនេះដើម្បីជ្រេកាមួយក្រុមជំនួយ" : greeting.kh;

  return (
    <span className="zp-mascot-shell">
      {bubbleVisible && !muted && (
        <span
          key={`${phase}-${nudge}`}
          className={`zp-mascot-bubble${helping ? " zp-mascot-bubble--help" : ""}`}
          role="status"
          aria-live="polite"
        >
          <span className="zp-mascot-bubble__swap">
            {helping ? "💬" : greeting.icon} {bubbleText}
          </span>
          <span className="zp-mascot-bubble__sub">{bubbleSub}</span>
          <button
            type="button"
            className="zp-mascot-bubble__close"
            onClick={(event) => { event.stopPropagation(); dismiss(); }}
            aria-label="បិទសារនេះ"
          >
            ✕
          </button>
        </span>
      )}

      <button
        type="button"
        className="zp-mascot-btn zp-mascot"
        onClick={openChat}
        aria-label={`${MASCOT_HELP_TEXT} — បើកការជជែកជាមួយក្រុមជំនួយ`}
        title={MASCOT_HELP_TEXT}
      >
        <svg viewBox="0 0 48 48" width="30" height="30" aria-hidden="true">
          {/* antenna */}
          <line x1="24" y1="8" x2="24" y2="14" stroke="#8d97b2" strokeWidth="2" strokeLinecap="round" />
          <circle className="zp-mascot__antenna-dot" cx="24" cy="6.5" r="3" fill="#38bdf8" />
          {/* head/body */}
          <rect x="8" y="14" width="32" height="28" rx="10" fill="#18233a" stroke="#38bdf8" strokeOpacity="0.5" strokeWidth="1.5" />
          {/* face screen */}
          <rect x="13" y="20" width="22" height="14" rx="7" fill="#0a0f1e" />
          {/* eyes (blink as one group; pupils follow cursor) */}
          <g className="zp-mascot__eyes">
            <g className="zp-mascot__pupils" ref={pupilsRef}>
              <circle cx="20" cy="27" r="3.1" fill="#7dd3fc" />
              <circle cx="28" cy="27" r="3.1" fill="#7dd3fc" />
              <circle cx="20.9" cy="26.1" r="1.05" fill="#fff" />
              <circle cx="28.9" cy="26.1" r="1.05" fill="#fff" />
            </g>
          </g>
          {/* smile */}
          <path d="M20 37.5 Q24 40 28 37.5" stroke="#7dd3fc" strokeWidth="1.6" strokeLinecap="round" fill="none" />
          {/* blush */}
          <circle cx="15.5" cy="31" r="1.6" fill="#f472b6" opacity="0.55" />
          <circle cx="32.5" cy="31" r="1.6" fill="#f472b6" opacity="0.55" />
        </svg>
        <span className="zp-mascot-badge" aria-hidden="true">?</span>
      </button>
    </span>
  );
}

export default HeaderMascot;
