import { AnimatedEmoji } from "@/components/AnimatedEmoji";

/**
 * Soft Lottie cluster for empty chat states. Hero is the feeling of the
 * screen; the orbiting three are the same pack the storefront already uses
 * on Home / Account so the motion language stays ZURS, not a new mascot.
 *
 *   signin  — 👋 come in, we are here
 *   welcome — 💬 ready to help
 *   quota   — 🌙 rest until tomorrow
 *   closed  — 🙏 thank you, sampeah
 */
const MOODS = {
  signin: { hero: "👋", orbit: ["✨", "💬", "🙏"] as const },
  welcome: { hero: "💬", orbit: ["🙏", "✨", "💗"] as const },
  quota: { hero: "🌙", orbit: ["⏰", "💬"] as const },
  closed: { hero: "🙏", orbit: ["💗", "✨"] as const },
} as const;

export type ChatWarmthMood = keyof typeof MOODS;

export function ChatWarmth({ mood }: { mood: ChatWarmthMood }) {
  const { hero, orbit } = MOODS[mood];
  return (
    <div className="zs-chat__warmth" aria-hidden="true">
      {orbit.map((emoji, index) => (
        <span key={`${mood}-${emoji}-${index}`} className={`zs-chat__orbit zs-chat__orbit--${index}`}>
          <AnimatedEmoji emoji={emoji} size={26} />
        </span>
      ))}
      <div className="zs-chat__heroEmoji">
        <AnimatedEmoji emoji={hero} size={84} />
      </div>
    </div>
  );
}
