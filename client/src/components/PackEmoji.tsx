import { memo, useEffect, useRef, useState } from "react";
import type { AnimationItem } from "lottie-web";

/**
 * PackEmoji — Telegram-style animated emoji/icons served from the local
 * sticker packs in `client/public/emoji-anim` (exported from the user's
 * EmojiSaverBot packs: Mix Emoji, Various Animations, Icon-1, Product Logo).
 *
 * Each name has a Lottie JSON (`<name>.json`) plus a static PNG fallback
 * (`<name>.png`). Animations lazy-load once per name and cache forever; when
 * the fetch fails or the visitor prefers reduced motion, the crisp PNG frame
 * renders instead so the UI never breaks.
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
  verified: { emoji: "☑️", label: "Verified" },
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

const animationCache = new Map<string, Promise<unknown | null>>();

function loadPackAnimation(name: string): Promise<unknown | null> {
  const cached = animationCache.get(name);
  if (cached) return cached;
  const request = fetch(`/emoji-anim/${encodeURIComponent(name)}.json`)
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);
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

  // Track the preference instead of sampling it once at mount: some mobile
  // browsers report "reduce" while battery or data saver is on, and every pack
  // emoji would otherwise stay frozen for the rest of the session even after
  // the visitor turns the setting back off.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      setStaticFrame(true);
      return;
    }
    let cancelled = false;
    let animation: AnimationItem | null = null;
    setStaticFrame(false);
    // lottie-web probes a <canvas> the moment it is evaluated, which jsdom does
    // not implement, so the player is imported lazily and skipped under jsdom -
    // the same pattern OutlineLoader and SelectedPackageCheck already use.
    if (typeof navigator !== "undefined" && navigator.userAgent.toLowerCase().includes("jsdom")) return;
    void Promise.all([loadPackAnimation(name), import("lottie-web")])
      .then(([data, module]) => {
        if (cancelled) return;
        if (!data || !hostRef.current) {
          setStaticFrame(true);
          return;
        }
        try {
          animation = module.default.loadAnimation({ container: hostRef.current, renderer: "svg", loop, autoplay: true, animationData: data });
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

  if (staticFrame) {
    return (
      <img
        src={`/emoji-anim/${encodeURIComponent(name)}.png`}
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        alt={meta.label}
        className={`pack-emoji pack-emoji--static ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return <div ref={hostRef} role="img" aria-label={meta.label} className={`pack-emoji ${className}`} style={{ width: size, height: size }} />;
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
  for (const [pattern, name] of rules) if (pattern.test(value)) return name;
  return "svc-sparkle";
}
