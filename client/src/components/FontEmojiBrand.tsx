import { memo, useEffect, useState } from "react";

const BURST_COUNT = 7;

export const FontEmojiBrand = memo(function FontEmojiBrand({
  text = "ZURS.me",
  size = 18,
  className = "",
}: {
  text?: string;
  size?: number;
  className?: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
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
        const poster = `/emoji-anim/font/burst-${burst}.png`;
        return (
          <span
            key={`${char}-${index}`}
            aria-hidden="true"
            className="font-emoji-brand__letter"
            style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
          >
            <img src={poster} alt="" className="font-emoji-brand__media" draggable={false} />
            {reduceMotion ? null : (
              <video className="font-emoji-brand__media font-emoji-brand__media--video" autoPlay muted loop playsInline poster={poster} aria-hidden="true">
                <source src={`/emoji-anim/font/burst-${burst}.webm`} type="video/webm" />
              </video>
            )}
            <span className="font-emoji-brand__char">{char}</span>
          </span>
        );
      })}
    </span>
  );
});
