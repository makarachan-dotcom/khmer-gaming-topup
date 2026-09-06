import { memo, useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";

/**
 * PackEmoji — Telegram-style animated emoji/icons served from the local
 * sticker packs in `client/public/emoji-anim` (exported from the user's
 * EmojiSaverBot packs: Mix Emoji, Various Animations, Icon-1, Product Logo).
 *
 * Logical names map onto files that actually exist. Missing names alias to a
 * close pack file so Lottie never 404s. A unicode glyph is painted immediately
 * while the JSON loads; PNG is the reduced-motion / failure fallback.
 */

export const PACK_EMOJI = {
  fire: { emoji: "🔥", label: "Popular" },
  gamepad: { emoji: "🎮", label: "Game" },
  gem: { emoji: "💎", label: "Diamonds" },
  "diamond-blue": { emoji: "💎", label: "Diamond" },
  star: { emoji: "⭐", label: "Star" },
  crown: { emoji: "👑", label: "Admin" },
  clock: { emoji: "🕒", label: "Processing time" },
  "shield-lock": { emoji: "🛡️", label: "Secure" },
  fireworks: { emoji: "🎆", label: "Celebration" },
  party: { emoji: "🎉", label: "Party" },
  plane: { emoji: "✈️", label: "Fast delivery" },
  "shopping-bag": { emoji: "🛍️", label: "Shopping" },
  briefcase: { emoji: "💼", label: "Package" },
  "check-badge": { emoji: "✅", label: "Done" },
  "sparkles-z": { emoji: "✨", label: "Sparkles" },
  warning: { emoji: "❗", label: "Warning" },
  "search-user": { emoji: "🔍", label: "Find account" },
  "heart-red": { emoji: "❤️", label: "Love" },
  rainbow: { emoji: "🌈", label: "Rainbow" },
  "rocket-plane": { emoji: "🚀", label: "Launch" },
  heart: { emoji: "💗", label: "Heart" },
  megaphone: { emoji: "📣", label: "Announcement" },
  verified: { emoji: "✅", label: "Verified" },
  "shield-check": { emoji: "🛡️", label: "Trusted" },
  gift: { emoji: "🎁", label: "Gift" },
  question: { emoji: "❓", label: "Help" },
  vip: { emoji: "🏅", label: "VIP" },
  "new-badge": { emoji: "🆕", label: "New" },
  globe: { emoji: "🌐", label: "Global" },
  lightning: { emoji: "⚡", label: "Instant" },
  "party-popper": { emoji: "🎊", label: "Congrats" },
  "star-purple": { emoji: "🌟", label: "Featured" },
  moon: { emoji: "🌙", label: "Night" },
  "gem-pink": { emoji: "💠", label: "Gem" },
  "telegram-plane": { emoji: "✈️", label: "Telegram" },
  bell: { emoji: "🔔", label: "Notification" },
  "user-laptop": { emoji: "👤", label: "Account" },
  key: { emoji: "🔑", label: "API key" },
  gear: { emoji: "⚙️", label: "Settings" },
  "chat-smile": { emoji: "💬", label: "Chat" },
  "clock-outline": { emoji: "⏱️", label: "Timer" },
  info: { emoji: "ℹ️", label: "Info" },
  help: { emoji: "🆘", label: "Support" },
  pencil: { emoji: "✏️", label: "Edit" },
  pin: { emoji: "📍", label: "Location" },
  "globe-2": { emoji: "🌍", label: "Worldwide" },
  wifi: { emoji: "📶", label: "Online" },
  "question-blue": { emoji: "❔", label: "Question" },
  confetti: { emoji: "🎊", label: "Confetti" },
  "gift-blue": { emoji: "🎁", label: "Reward" },
  "svc-gemini": { emoji: "✨", label: "Gemini" },
  "svc-chatgpt": { emoji: "🤖", label: "ChatGPT" },
  "svc-netflix": { emoji: "🎬", label: "Netflix" },
  "svc-youtube": { emoji: "▶️", label: "YouTube" },
  "svc-tiktok": { emoji: "🎵", label: "TikTok" },
  "svc-spotify": { emoji: "🎧", label: "Spotify" },
  "svc-discord": { emoji: "🎮", label: "Discord" },
  "svc-whatsapp": { emoji: "💬", label: "WhatsApp" },
  "svc-telegram": { emoji: "✈️", label: "Telegram" },
  "svc-playstation": { emoji: "🎮", label: "PlayStation" },
  "svc-xbox": { emoji: "🎮", label: "Xbox" },
  "svc-steam": { emoji: "🕹️", label: "Steam" },
  "svc-microsoft": { emoji: "🪟", label: "Microsoft" },
  "svc-apple": { emoji: "🍎", label: "Apple" },
  "svc-instagram": { emoji: "📸", label: "Instagram" },
  "svc-facebook": { emoji: "📘", label: "Facebook" },
  "svc-canva": { emoji: "🎨", label: "Canva" },
  "svc-google": { emoji: "🔎", label: "Google" },
  "svc-adobe": { emoji: "🅰️", label: "Adobe" },
  "svc-photoshop": { emoji: "🖌️", label: "Photoshop" },
  "svc-sparkle": { emoji: "✨", label: "Premium service" },
} as const;

export type PackEmojiName = keyof typeof PACK_EMOJI;

/** Logical names that do not have their own JSON/PNG files. */
const PACK_FILE: Partial<Record<PackEmojiName, string>> = {
  fire: "sparkles-z",
  gamepad: "svc-sparkle",
  gem: "diamond-blue",
  star: "star-purple",
  crown: "star-purple",
  clock: "clock-outline",
  fireworks: "party-popper",
  party: "party-popper",
  plane: "rocket-plane",
  briefcase: "shopping-bag",
  warning: "question-blue",
  rainbow: "sparkles-z",
  heart: "heart-red",
  megaphone: "chat-smile",
  verified: "check-badge",
  gift: "gift-blue",
  question: "question-blue",
  vip: "star-purple",
  globe: "globe-2",
  lightning: "sparkles-z",
  moon: "star-purple",
  bell: "chat-smile",
  key: "shield-lock",
  gear: "shield-check",
  info: "question-blue",
  help: "question-blue",
  pencil: "search-user",
  pin: "search-user",
  wifi: "globe-2",
  confetti: "party-popper",
};

export function packAssetName(name: PackEmojiName): string {
  return PACK_FILE[name] ?? name;
}

const animationCache = new Map<string, Promise<unknown | null>>();

function loadPackAnimation(name: PackEmojiName): Promise<unknown | null> {
  const asset = packAssetName(name);
  const cached = animationCache.get(asset);
  if (cached) return cached;
  const request = fetch(`/emoji-anim/${encodeURIComponent(asset)}.json`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
  animationCache.set(asset, request);
  return request;
}

export function prefersStaticEmoji() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export const PackEmoji = memo(function PackEmoji({
  name,
  size = 20,
  className = "",
  loop = true,
  speed,
}: {
  name: PackEmojiName;
  size?: number;
  className?: string;
  loop?: boolean;
  speed?: number;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const meta = PACK_EMOJI[name];
  const asset = packAssetName(name);
  const [staticFrame, setStaticFrame] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(prefersStaticEmoji);
  const [pngFailed, setPngFailed] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setPngFailed(false);
    setPlaying(false);
    if (reduceMotion) {
      setStaticFrame(true);
      return;
    }
    let cancelled = false;
    let animation: AnimationItem | null = null;
    setStaticFrame(false);
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")) return;
    void Promise.all([loadPackAnimation(name), import("lottie-web")])
      .then(async ([data, module]) => {
        if (cancelled) return;
        if (!data) {
          setStaticFrame(true);
          return;
        }
        if (!hostRef.current) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        if (cancelled || !hostRef.current) {
          setStaticFrame(true);
          return;
        }
        try {
          hostRef.current.replaceChildren();
          animation = module.default.loadAnimation({ container: hostRef.current, renderer: "svg", loop, autoplay: true, animationData: data });
          if (speed && speed > 0) animation.setSpeed(speed);
          setPlaying(true);
        } catch {
          setStaticFrame(true);
        }
      })
      .catch(() => setStaticFrame(true));
    return () => {
      cancelled = true;
      animation?.destroy();
    };
  }, [name, loop, speed, reduceMotion]);

  if (!meta) return null;

  return (
    <span
      role="img"
      aria-label={meta.label}
      className={`pack-emoji ${staticFrame ? "pack-emoji--static" : ""} ${className}`}
      style={{ width: size, height: size, position: "relative", display: "inline-grid", placeItems: "center", flex: "0 0 auto", overflow: "hidden", lineHeight: 1 }}
    >
      {(staticFrame && pngFailed) || (!staticFrame && !playing) ? (
        <span aria-hidden="true" className="pack-emoji__glyph" style={{ fontSize: Math.round(size * 0.86), lineHeight: 1 }}>
          {meta.emoji}
        </span>
      ) : null}
      {staticFrame ? (
        pngFailed ? null : (
          <img
            src={`/emoji-anim/${encodeURIComponent(asset)}.png`}
            width={size}
            height={size}
            loading="lazy"
            decoding="async"
            alt=""
            onError={() => setPngFailed(true)}
            className="pack-emoji__frame"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
          />
        )
      ) : (
        <div ref={hostRef} aria-hidden="true" className="pack-emoji__lottie" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      )}
    </span>
  );
});

/** Maps a free-text provider/product name from the Partner API to a pack logo. */
export function serviceEmojiName(text: string): PackEmojiName {
  const value = text.toLowerCase();
  const rules: Array<[RegExp, PackEmojiName]> = [
    [/gemini/, "svc-gemini"],
    [/chatgpt|openai|gpt/, "svc-chatgpt"],
    [/netflix/, "svc-netflix"],
    [/youtube|ytb/, "svc-youtube"],
    [/tiktok/, "svc-tiktok"],
    [/spotify/, "svc-spotify"],
    [/discord|nitro/, "svc-discord"],
    [/whatsapp/, "svc-whatsapp"],
    [/telegram/, "svc-telegram"],
    [/playstation|\bpsn\b|\bps\s/, "svc-playstation"],
    [/xbox|game\s*pass/, "svc-xbox"],
    [/steam/, "svc-steam"],
    [/microsoft|office|windows/, "svc-microsoft"],
    [/apple|icloud|itunes/, "svc-apple"],
    [/instagram|\big\b/, "svc-instagram"],
    [/facebook|meta/, "svc-facebook"],
    [/canva/, "svc-canva"],
    [/google/, "svc-google"],
    [/photoshop/, "svc-photoshop"],
    [/adobe/, "svc-adobe"],
  ];
  for (const [pattern, mapped] of rules) if (pattern.test(value)) return mapped;
  return "svc-sparkle";
}
