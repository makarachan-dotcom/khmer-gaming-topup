import { memo, useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";
import { isRealLottie } from "./PackEmoji";

/**
 * Telegram-style animated emoji.
 *
 * Emoji-only messages render big and animated — the animation data is Google's
 * animated Noto Emoji set (the same open set Telegram-style clients use),
 * fetched once per emoji from fonts.gstatic.com and played with lottie-web
 * (already a project dependency). When the device is offline, or a given emoji
 * has no animation, it falls back to the native emoji glyph with a springy pop
 * so every emoji still *moves*.
 */

function notoLottieUrl(emoji: string) {
  const codepoints = Array.from(emoji.replace(/\ufe0f/g, ""))
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("_");
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoints}/lottie.json`;
}

const animationCache = new Map<string, Promise<unknown | null>>();

/**
 * Local-first mapping: emoji that exist in the user's Telegram sticker packs
 * (served from /emoji-anim) render with those Lottie animations — no network
 * needed. Anything else keeps the remote Noto fallback.
 */
const LOCAL_PACK_BY_EMOJI: Record<string, string> = {
  "🔥": "fire", "🎮": "gamepad", "💎": "gem", "⭐": "star", "🌟": "star-purple",
  "👑": "crown", "🕒": "clock", "🛡": "shield-check", "🎉": "party-popper", "🎊": "confetti",
  "✈": "plane", "🚀": "rocket-plane", "🛍": "shopping-bag", "💼": "briefcase",
  "✅": "check-badge", "✨": "sparkles-z", "❗": "warning", "❤": "heart-red", "💗": "heart",
  "🌈": "rainbow", "📣": "megaphone", "☑": "verified", "🎁": "gift", "❓": "question",
  "🌐": "globe", "⚡": "lightning", "🌙": "moon", "💠": "gem-pink", "🔔": "bell",
  "👤": "user-laptop", "🔑": "key", "⚙": "gear", "💬": "chat-smile", "ℹ": "info",
  "✏": "pencil", "📍": "pin", "📶": "wifi",
};

function loadEmojiAnimation(emoji: string): Promise<unknown | null> {
  const cached = animationCache.get(emoji);
  if (cached) return cached;
  const localName = LOCAL_PACK_BY_EMOJI[emoji.replace(/\ufe0f/g, "")];
  const request = (localName
    ? fetch(`/emoji-anim/${encodeURIComponent(localName)}.json`).then((response) => (response.ok ? response.json() : null)).catch(() => null)
    : Promise.resolve(null)
  ).then((localData) =>
    (isRealLottie(localData) ? localData : null) ?? fetch(notoLottieUrl(emoji))
      .then((response) => (response.ok ? response.json() : null))
      .catch(() => null),
  );
  animationCache.set(emoji, request);
  return request;
}

export const AnimatedEmoji = memo(function AnimatedEmoji({
  emoji,
  size = 72,
  className = "",
}: {
  emoji: string;
  size?: number;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [staticOnly, setStaticOnly] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let animation: AnimationItem | null = null;
    setStaticOnly(false);
    // Lazy player import keeps lottie-web - and the canvas probe it runs on
    // import - out of the module graph until an animated emoji is rendered.
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")) return;
    void Promise.all([loadEmojiAnimation(emoji), import("lottie-web")])
      .then(([data, module]) => {
        if (cancelled) return;
        if (!data || !hostRef.current) {
          setStaticOnly(true);
          return;
        }
        try {
          animation = module.default.loadAnimation({
            container: hostRef.current,
            renderer: "svg",
            loop: true,
            autoplay: true,
            animationData: data,
          });
        } catch {
          setStaticOnly(true);
        }
      })
      .catch(() => setStaticOnly(true));
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [emoji]);

  if (staticOnly) {
    return (
      <span className={`zcp-emoji-static ${className}`} style={{ fontSize: Math.round(size * 0.82), lineHeight: 1 }} role="img" aria-label={emoji}>
        {emoji}
      </span>
    );
  }
  return <div ref={hostRef} className={`zcp-emoji-lottie ${className}`} style={{ width: size, height: size }} role="img" aria-label={emoji} />;
});

/* ------------------------------------------------------------ detection */

/**
 * One emoji cluster: a pictograph plus any ZWJ-joined partners, variation
 * selectors and skin-tone modifiers.
 */
const EMOJI_CLUSTER = /\p{Extended_Pictographic}(?:\u200d\p{Extended_Pictographic}|\ufe0f|[\u{1f3fb}-\u{1f3ff}])*/gu;

/** Most emoji Telegram renders as one big sticker-like block. */
const MAX_BIG_EMOJI = 4;

/**
 * Returns the emoji clusters when the message is *only* emoji (1–4 of them,
 * whitespace allowed) — i.e. it should render as big animated emoji with no
 * bubble, exactly like Telegram. Returns `null` for ordinary text.
 */
export function splitEmojiOnly(text: string): string[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const clusters = trimmed.match(EMOJI_CLUSTER);
  if (!clusters || clusters.length === 0 || clusters.length > MAX_BIG_EMOJI) return null;
  if (trimmed.replace(EMOJI_CLUSTER, "").replace(/\s/g, "") !== "") return null;
  return clusters;
}

/** The composer's quick-emoji tray (Khmer support-chat favourites first). */
export const QUICK_EMOJIS = [
  "🙏", "😀", "😂", "🥰", "😍", "🤔", "👍", "❤️",
  "🔥", "🎉", "😢", "😮", "👏", "💯", "✨", "🎮",
  "💳", "🛒", "📦", "⏰", "✅", "❌", "🆗", "🙌",
  "😅", "🤝", "💸", "🚀",
  "😭", "😡", "🤯", "🥳", "😴", "🤗", "😇", "🤩",
  "👋", "💪", "🎁", "⭐",
];
