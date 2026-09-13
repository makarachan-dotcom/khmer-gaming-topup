type TickerLogo = { name: string; logoUrl?: string | null };

type GameLogoTickerProps = {
  logos: TickerLogo[];
  className?: string;
  speed?: number;
};

export function GameLogoTicker({ logos, className = "", speed = 30 }: GameLogoTickerProps) {
  if (!logos.length) return null;
  const items = [...logos, ...logos];
  return (
    <div className={`zp-ticker ${className}`} aria-hidden="true" role="presentation">
      <div className="zp-ticker__track" style={{ "--zp-ticker-speed": `${speed}s` } as React.CSSProperties}>
        {items.map((logo, index) => (
          <span key={`${logo.name}-${index}`} className="zp-ticker__item">
            {logo.logoUrl ? (
              <img src={logo.logoUrl} alt="" loading="lazy" decoding="async" draggable={false} />
            ) : (
              <span className="grid h-[1.35rem] w-[1.35rem] place-items-center rounded-full bg-neon/25 text-[10px] font-extrabold text-neon">
                {logo.name.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default GameLogoTicker;
