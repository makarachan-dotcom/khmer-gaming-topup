import { useMemo } from "react";

/**
 * FloatingParticles — នាងបក់នាងបោយ ✦
 * Ambient floating particles for the homepage hero.
 * Pure CSS animations (GPU friendly) — no extra libraries.
 * Animations run only under prefers-reduced-motion: no-preference
 * (see index.css), so reduced-motion users see a calm static field.
 */
const PARTICLE_COLORS = [
  "oklch(0.72 0.16 295 / 0.55)", // violet
  "oklch(0.80 0.12 300 / 0.45)", // light violet
  "oklch(0.85 0.12 220 / 0.40)", // cyan
  "oklch(1 0 0 / 0.35)", // white
];

type ParticleSpec = {
  id: number;
  left: number;
  bottom: number;
  size: number;
  color: string;
  duration: number;
  delay: number;
  sway: number;
  swayDuration: number;
  isDiamond: boolean;
};

function buildParticles(count: number): ParticleSpec[] {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    left: rand(2, 98),
    bottom: rand(-10, 35),
    size: rand(3, 9),
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    duration: rand(10, 22),
    delay: rand(-22, 0),
    sway: rand(12, 34),
    swayDuration: rand(3.5, 7),
    // Every 5th particle is a ✦ diamond — matches the diamond top-up theme
    isDiamond: i % 5 === 0,
  }));
}

export function FloatingParticles({ count }: { count?: number }) {
  const isMobile =
    typeof window !== "undefined" && window.innerWidth < 640;
  const particleCount = count ?? (isMobile ? 9 : 20);
  const particles = useMemo(() => buildParticles(particleCount), [particleCount]);

  return (
    <div aria-hidden="true" className="hero-particles">
      {particles.map((p) =>
        p.isDiamond ? (
          <span
            key={p.id}
            className="hero-particle hero-particle--diamond"
            style={{
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              fontSize: `${p.size + 4}px`,
              color: p.color,
              animationDuration: `${p.duration}s, ${p.swayDuration}s, ${p.duration}s`,
              animationDelay: `${p.delay}s, ${p.delay}s, ${p.delay}s`,
              ["--sway" as string]: `${p.sway}px`,
            }}
          >
            ✦
          </span>
        ) : (
          <span
            key={p.id}
            className="hero-particle hero-particle--dot"
            style={{
              left: `${p.left}%`,
              bottom: `${p.bottom}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: p.color,
              color: p.color,
              animationDuration: `${p.duration}s, ${p.swayDuration}s, ${p.duration}s`,
              animationDelay: `${p.delay}s, ${p.delay}s, ${p.delay}s`,
              ["--sway" as string]: `${p.sway}px`,
            }}
          />
        ),
      )}
    </div>
  );
}

export default FloatingParticles;
