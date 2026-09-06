import { memo, useEffect, useState } from "react";

/**
 * FontEmojiBrand — renders the ZURS.me wordmark as Telegram "Font Emoji"
 * tiles (the animated aurora-burst letters from the
 * `Font Emoji · @StickersPackRobot by @EmojiSaverBot` pack, served locally
 * from `/emoji-anim/font`). Each letter sits on its own looping burst video,
 * like Telegram Premium font emoji. The plain wordmark stays in the DOM for
 * screen readers, and visitors who prefer reduced motion get the static poster
 * frame instead of the video.
 */

const BURST_COUNT = 7;

export const FontEmojiBrand = memo(function FontEmojiBrand({
  text = "ZURS.me",
  size = 24,
  className = "",
}: {
  text?: string;
  size?: number;
  className?: string;
}) {
  const [reducedMotion, setReducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  // Subscribe rather than sampling once at render: a browser that reports
  // "reduce" while battery or data saver is on would otherwise leave every
  // letter parked on its poster frame for the rest of the session.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const chars = Array.from(text);
  let letterIndex = 0;
  return (
    <span className={`font-emoji-brand ${className}`} role="img" aria-label={text} style={{ height: size }}>
      {chars.map((char, index) => {
        if (char === " ") return <span key={`space-${index}`} aria-hidden="true" style={{ width: Math.round(size * 0.28) }} />;
        if (char === ".")
          return (
            <span key={`dot-${index}`} aria-hidden="true" className="font-emoji-brand__dot" style={{ fontSize: Math.round(size * 0.95) }}>
              .
            </span>
          );
        const burst = letterIndex % BURST_COUNT;
        letterIndex += 1;
        return (
          <span
            key={`${char}-${index}`}
            aria-hidden="true"
            className="font-emoji-brand__letter"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
          >
            {reducedMotion ? (
              <img className="font-emoji-brand__media" src={`/emoji-anim/font/burst-${burst}.png`} alt="" loading="lazy" decoding="async" />
            ) : (
              <video
                className="font-emoji-brand__media"
                src={`/emoji-anim/font/burst-${burst}.webm`}
                poster={`/emoji-anim/font/burst-${burst}.png`}
                autoPlay
                loop
                muted
                playsInline
                disablePictureInPicture
                preload="auto"
                tabIndex={-1}
              />
            )}
            <span className="font-emoji-brand__char">{char}</span>
          </span>
        );
      })}
    </span>
  );
});
