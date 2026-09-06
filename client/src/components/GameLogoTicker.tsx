type TickerLogo = { name: string; logoUrl?: string | null };

type GameLogoTickerProps = {
  /** Logos to scroll, e.g. games.map(g => ({ name: g.name, logoUrl: g.logoUrl })) */
  logos: TickerLogo[];
  className?: string;
  /** Seconds for one full loop. Default 30. */
  speed?: number;
};

/**
 * Infinite marquee of game logos running RIGHT → LEFT above the game grid.
 * The track is duplicated so the loop is seamless. Pauses on hover/touch.
 * Motion lives in zurs-premium.css (.zp-ticker*) and respects reduced motion.
 *
 * Usage (HomeTopupExperience, directly above the game grid):
 *   <GameLogoTicker logos={games.map(g => ({ name: g.name, logoUrl: g.logoUrl }))} />
 */
export function GameLogoTicker({ logos, className = "", speed = 30 }: GameLogoTickerProps) {
  if (!logos.length) return null;
  // duplicate the list so translateX(-50%) loops seamlessly
  const items = [...logos, ...logos];
  return (
    <div className={`zp-ticker ${className}`} aria-hidden="true" role="presentation">
      <div className="zp-ticker__track" style={{ "--zp-ticker-speed": `${speed}s` } as React.CSSProperties}>
        {items.map((logo, index) => (
          <span key={`${logo.name}-${index}`} className="zp-ticker__item">
            {logo.logoUrl ? (
              <img src={logo.logoUrl} alt="" loading="lazy" decoding="async" draggable={false} />
            ) : (
              <span
                className="grid h-[1.35rem] w-[1.35rem] place-items-center rounded-full bg-neon/25 text-[10px] font-extrabold text-neon"
              >
                {logo.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
            {logo.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default GameLogoTicker;
