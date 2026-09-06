import { memo } from "react";
import { PackEmoji, type PackEmojiName } from "./PackEmoji";

/**
 * FontEmojiBrand - renders the ZURS.me wordmark as Telegram "Font Emoji"
 * tiles, one animated burst per letter.
 *
 * The burst layer used to be a video element pointing at
 * `/emoji-anim/font/burst-N` WebM files. That never actually played for most
 * mobile visitors: iOS Low Power Mode and Android Data Saver both refuse to
 * autoplay video, and the refusal fires no event, so every letter silently
 * sat on its poster frame and the wordmark looked completely static.
 *
 * The tiles now use the same Lottie runtime as PackEmoji. Lottie is plain
 * scripted animation, so no browser autoplay policy applies to it, and
 * PackEmoji already carries every piece this needs: a lazy
 * `import("lottie-web")`, a per-name cache, a live `prefers-reduced-motion`
 * subscription, a crisp PNG fallback when the JSON cannot be fetched, and a
 * jsdom guard for the test environment.
 */

// One burst animation per letter position, taken from the local sticker pack
// in client/public/emoji-anim (every name there has a .json and a .png).
const BURST_EMOJI: readonly PackEmojiName[] = [
  "sparkles-z",
  "fireworks",
  "confetti",
  "party-popper",
  "star-purple",
  "lightning",
  "rainbow",
];
const BURST_COUNT = BURST_EMOJI.length;

export const FontEmojiBrand = memo(function FontEmojiBrand({
  text = "ZURS.me",
  size = 24,
  className = "",
}: {
  text?: string;
  size?: number;
  className?: string;
}) {
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
            <PackEmoji name={BURST_EMOJI[burst]} size={size} className="font-emoji-brand__media" />
            <span className="font-emoji-brand__char">{char}</span>
          </span>
        );
      })}
    </span>
  );
});
