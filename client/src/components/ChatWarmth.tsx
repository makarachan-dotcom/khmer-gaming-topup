import { AnimatedEmoji } from "@/components/AnimatedEmoji";
import { WavingPerson } from "@/components/WavingPerson";

/**
 * Soft Lottie cluster for empty chat states. Hero is the feeling of the
 * screen; the orbiting three are the same pack the storefront already uses
 * on Home / Account so the motion language stays ZURS, not a new mascot.
 *
 * Sign-in and welcome also stand a waving person next to the cluster. Both
 * share the same 4.8s beat so the wave and the emoji float stay in sync.
 *
 *   signin  — 👋 come in, we are here
 *   welcome — 💬 ready to help
 *   quota   — 🌙 rest until tomorrow
 *   closed  — 🙏 thank you, sampeah
 */
const MOODS = {
  signin: { hero: "👋", orbit: ["✨", "💬", "🙏"] as const, person: true },
  welcome: { hero: "💬", orbit: ["🙏", "✨", "💗"] as const, person: true },
  quota: { hero: "🌙", orbit: ["⏰", "💬"] as const, person: false },
  closed: { hero: "🙏", orbit: ["💗", "✨"] as const, person: false },
} as const;

export type ChatWarmthMood = keyof typeof MOODS;

export function ChatWarmth({ mood }: { mood: ChatWarmthMood }) {
  const { hero, orbit, person } = MOODS[mood];
  const heroSize = person ? 72 : 84;
  const orbitSize = person ? 22 : 26;
  return (
    <div className={`zs-chat__scene${person ? " zs-chat__scene--together" : ""}`} aria-hidden="true">
      {person ? (
        <div className="zs-chat__person">
          <WavingPerson />
        </div>
      ) : null}
      <div className="zs-chat__warmth">
        {orbit.map((emoji, index) => (
          <span key={`${mood}-${emoji}-${index}`} className={`zs-chat__orbit zs-chat__orbit--${index}`}>
            <AnimatedEmoji emoji={emoji} size={orbitSize} />
          </span>
        ))}
        <div className="zs-chat__heroEmoji">
          <AnimatedEmoji emoji={hero} size={heroSize} />
        </div>
      </div>
    </div>
  );
}
