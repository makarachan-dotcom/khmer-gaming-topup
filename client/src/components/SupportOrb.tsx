import { useEffect, useState } from "react";
import { ThinkingOrb } from "thinking-orbs";

/**
 * Semantic wrapper over `thinking-orbs` (https://libraries.dev/orbs.html).
 *
 * The npm README documents six states while the GitHub docs list nine, so we
 * only hard-code the four that exist in every published build. If the copy you
 * install exposes all nine, "connecting" is a better fit for `joining` and
 * "composing" is a better fit for `typing` — swap them in ORB_STATE below and
 * nothing else needs to change.
 */
export type SupportOrbMood = "joining" | "waiting" | "typing" | "busy";

const ORB_STATE: Record<SupportOrbMood, "working" | "searching" | "solving" | "listening"> = {
  joining: "searching", // nobody has picked the chat up yet
  waiting: "listening", // an operator is in the room, we await their reply
  typing: "working", // the operator has been typing for a while
  busy: "solving", // local work: opening a chat, uploading a file
};

const CAPTION_KH: Record<SupportOrbMood, string> = {
  joining: "កំពុងចេញក្រុមជំនួយ…",
  waiting: "ក្រុមជំនួយកំពុងអានសាររបស់អ្នក…",
  typing: "ក្រុមជំនួយកំពុងសរសេរសារវ៉ង…",
  busy: "កំពុងដំណើរការ…",
};

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    }
    // Safari < 14 only has the deprecated listener API.
    query.addListener(onChange);
    return () => query.removeListener(onChange);
  }, []);

  return reduced;
}

export type SupportOrbProps = {
  mood: SupportOrbMood;
  /** 64 is the chat-avatar tuning, 20 the inline-text tuning. Nothing between. */
  size?: 64 | 20;
  caption?: boolean;
  className?: string;
};

export default function SupportOrb({ mood, size = 64, caption = true, className }: SupportOrbProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className={`zs-orb zs-orb--${mood}${className ? ` ${className}` : ""}`}
      role="status"
      aria-live="polite"
      aria-label={CAPTION_KH[mood]}
    >
      <span className="zs-orb__stage" aria-hidden="true">
        <ThinkingOrb
          state={ORB_STATE[mood]}
          size={size}
          dark
          paused={reduced}
          speed={mood === "typing" ? 1.15 : 1}
        />
      </span>
      {caption ? <span className="zs-orb__caption">{CAPTION_KH[mood]}</span> : null}
    </div>
  );
}
