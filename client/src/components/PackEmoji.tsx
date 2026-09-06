import { memo, useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";

/**
 * PackEmoji — Telegram-style animated icons.
 *
 * Real Noto Animated Emoji Lottie files are vendored in `/emoji-anim`.
 * A unicode glyph is always painted underneath, so the icon is never blank
 * while JSON loads, if Lottie fails, or if the visitor prefers reduced motion.
 */

export const PACK_EMOJI = {
  fire: { emoji: "🔥", label: "Popular" },
  gamepad: { emoji: "🎯", label: "Game" },
  gem: { emoji: "💎", label: "Diamonds" },
  "diamond-blue": { emoji: "💎", label: "Diamond" },
  star: { emoji: "⭐", label: "Star" },
  crown: { emoji: "👑", label: "Admin" },
  clock: { emoji: "⏰", label: "Processing time" },
  "shield-lock": { emoji: "🔒", label: "Secure" },
  fireworks: { emoji: "🎆", label: "Celebration" },
  party: { emoji: "🎉", label: "Party" },
  plane: { emoji: "✈️", label: "Fast delivery" },
  "shopping-bag": { emoji: "🛒", label: "Shopping" },
  briefcase: { emoji: "📦", label: "Package" },
  "check-badge": { emoji: "✅", label: "Done" },
  "sparkles-z": { emoji: "✨", label: "Sparkles" },
  warning: { emoji: "❗", label: "Warning" },
  "search-user": { emoji: "🔎", label: "Find account" },
  "heart-red": { emoji: "❤️", label: "Love" },
  rainbow: { emoji: "🌈", label: "Rainbow" },
  "rocket-plane": { emoji: "🚀", label: "Launch" },
  heart: { emoji: "💗", label: "Heart" },
  megaphone: { emoji: "📣", label: "Announcement" },
  verified: { emoji: "✅", label: "Verified" },
  "shield-check": { emoji: "🔒", label: "Trusted" },
  gift: { emoji: "🎁", label: "Gift" },
  question: { emoji: "❓", label: "Help" },
  vip: { emoji: "🏆", label: "VIP" },
  "new-badge": { emoji: "🆕", label: "New" },
  globe: { emoji: "🌍", label: "Global" },
  lightning: { emoji: "⚡", label: "Instant" },
  "party-popper": { emoji: "🎊", label: "Congrats" },
  "star-purple": { emoji: "🌟", label: "Featured" },
  moon: { emoji: "🌝", label: "Night" },
  "gem-pink": { emoji: "💎", label: "Gem" },
  "telegram-plane": { emoji: "✈️", label: "Telegram" },
  bell: { emoji: "🔔", label: "Notification" },
  "user-laptop": { emoji: "💻", label: "Account" },
  key: { emoji: "🔒", label: "API key" },
  gear: { emoji: "⚙️", label: "Settings" },
  "chat-smile": { emoji: "💬", label: "Chat" },
  "clock-outline": { emoji: "⏳", label: "Timer" },
  info: { emoji: "💡", label: "Info" },
  help: { emoji: "🆘", label: "Support" },
  pencil: { emoji: "✏️", label: "Edit" },
  pin: { emoji: "🎯", label: "Location" },
  "globe-2": { emoji: "🌍", label: "Worldwide" },
  wifi: { emoji: "⚡", label: "Online" },
  "question-blue": { emoji: "❓", label: "Question" },
  confetti: { emoji: "🎊", label: "Confetti" },
  "gift-blue": { emoji: "🎁", label: "Reward" },
  "svc-gemini": { emoji: "✨", label: "Gemini" },
  "svc-chatgpt": { emoji: "🤖", label: "ChatGPT" },
  "svc-netflix": { emoji: "🎬", label: "Netflix" },
  "svc-youtube": { emoji: "🎬", label: "YouTube" },
  "svc-tiktok": { emoji: "🎶", label: "TikTok" },
  "svc-spotify": { emoji: "🎶", label: "Spotify" },
  "svc-discord": { emoji: "🎯", label: "Discord" },
  "svc-whatsapp": { emoji: "💬", label: "WhatsApp" },
  "svc-telegram": { emoji: "✈️", label: "Telegram" },
  "svc-playstation": { emoji: "🎯", label: "PlayStation" },
  "svc-xbox": { emoji: "🎯", label: "Xbox" },
  "svc-steam": { emoji: "👾", label: "Steam" },
  "svc-microsoft": { emoji: "💻", label: "Microsoft" },
  "svc-apple": { emoji: "🍎", label: "Apple" },
  "svc-instagram": { emoji: "📷", label: "Instagram" },
  "svc-facebook": { emoji: "💙", label: "Facebook" },
  "svc-canva": { emoji: "✨", label: "Canva" },
  "svc-google": { emoji: "🔎", label: "Google" },
  "svc-adobe": { emoji: "✨", label: "Adobe" },
  "svc-photoshop": { emoji: "✨", label: "Photoshop" },
  "svc-sparkle": { emoji: "✨", label: "Premium service" },
} as const;

export type PackEmojiName = keyof typeof PACK_EMOJI;

export function isRealLottie(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const layers = (data as { layers?: unknown }).layers;
  if (!Array.isArray(layers) || layers.length === 0) return false;
  try {
    return JSON.stringify(data).length >= 2000;
  } catch {
    return false;
  }
}

function notoLottieUrl(emoji: string) {
  const codepoints = Array.from(emoji.replace(/\ufe0f/g, ""))
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("_");
  return `https://fonts.gstatic.com/s/e/notoemoji/latest/${codepoints}/lottie.json`;
}

const animationCache = new Map<string, Promise<unknown | null>>();

async function readJsonIfReal(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.includes("json")) return null;
    const data = await response.json();
    return isRealLottie(data) ? data : null;
  } catch {
    return null;
  }
}

function loadPackAnimation(name: PackEmojiName): Promise<unknown | null> {
  const cached = animationCache.get(name);
  if (cached) return cached;
  const request = (async () => {
    const local = await readJsonIfReal(`/emoji-anim/${encodeURIComponent(name)}.json`);
    if (local) return local;
    return readJsonIfReal(notoLottieUrl(PACK_EMOJI[name].emoji));
  })();
  animationCache.set(name, request);
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
  const [staticFrame, setStaticFrame] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(prefersStaticEmoji);
  const [pngFailed, setPngFailed] = useState(false);

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
          animation = module.default.loadAnimation({
            container: hostRef.current,
            renderer: "svg",
            loop,
            autoplay: true,
            animationData: data,
          });
          if (speed && speed > 0) animation.setSpeed(speed);
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
      <span aria-hidden="true" className="pack-emoji__glyph" style={{ fontSize: Math.round(size * 0.86), lineHeight: 1, zIndex: 0 }}>
        {meta.emoji}
      </span>
      {staticFrame && !pngFailed ? (
        <img
          src={`/emoji-anim/${encodeURIComponent(name)}.png`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          alt=""
          onError={() => setPngFailed(true)}
          className="pack-emoji__frame"
          style={{ position: "absolute", inset: 0, zIndex: 1, width: "100%", height: "100%", objectFit: "contain" }}
        />
      ) : null}
      {staticFrame ? null : (
        <div ref={hostRef} aria-hidden="true" className="pack-emoji__lottie" style={{ position: "absolute", inset: 0, zIndex: 2, width: "100%", height: "100%" }} />
      )}
    </span>
  );
});

/** Maps a free-text provider/product name from the Partner API to a pack logo. */
export function serviceEmojiName(text: string): PackEmojiName {
  const value = text.toLowerCase();
  const rules: Array<[RegExp, PackEmojiName]> = [
    [/gemini/, "svc-gemini"],
    [/chatgpt|openai|gpt|claude|anthropic/, "svc-chatgpt"],
    [/netflix/, "svc-netflix"],
    [/capcut|cap cut/, "svc-netflix"],
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
