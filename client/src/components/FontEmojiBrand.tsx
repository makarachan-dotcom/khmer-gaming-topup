import { memo } from "react";
import { PackEmoji, type PackEmojiName } from "./PackEmoji";

const BURST_EMOJI: readonly PackEmojiName[] = [
  "sparkles-z",
  "party-popper",
  "star-purple",
  "rocket-plane",
  "gift-blue",
  "diamond-blue",
  "gem-pink",
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
