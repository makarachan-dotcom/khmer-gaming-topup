import { useId } from "react";

/**
 * A different tick: Telegram-style blue scalloped seal with a white check.
 * Sparkles still spin; the badge still wobbles. Not the green ✅ square.
 */
function VerifiedMark({ size }: { size: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      className="zurs-verified-seal"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-blue`} x1="10" y1="6" x2="26" y2="30">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.45" stopColor="#2aabee" />
          <stop offset="1" stopColor="#0369a1" />
        </linearGradient>
      </defs>

      <g className="zurs-verified-seal__ring">
        <path d="M18 1.4 L19.2 4.4 L22.2 5.5 L19.2 6.6 L18 9.6 L16.8 6.6 L13.8 5.5 L16.8 4.4 Z" fill="#f6e08a" />
        <path d="M18 26.4 L19.2 29.4 L22.2 30.5 L19.2 31.6 L18 34.6 L16.8 31.6 L13.8 30.5 L16.8 29.4 Z" fill="#f6e08a" />
        <path d="M30.5 13.8 L31.6 16.8 L34.6 18 L31.6 19.2 L30.5 22.2 L29.4 19.2 L26.4 18 L29.4 16.8 Z" fill="#7dd3fc" />
        <path d="M1.4 18 L4.4 16.8 L5.5 13.8 L6.6 16.8 L9.6 18 L6.6 19.2 L5.5 22.2 L4.4 19.2 Z" fill="#7dd3fc" />
      </g>

      <g className="zurs-verified-seal__face">
        <circle cx="18" cy="8.4" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="24.8" cy="11.2" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="27.6" cy="18" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="24.8" cy="24.8" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="18" cy="27.6" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="11.2" cy="24.8" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="8.4" cy="18" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="11.2" cy="11.2" r="4.4" fill={`url(#${uid}-blue)`} />
        <circle cx="18" cy="18" r="10.2" fill={`url(#${uid}-blue)`} />
        <path
          d="M12.4 18.2 L16.2 22 L24.2 13.4"
          fill="none"
          stroke="#fff"
          strokeWidth="2.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function VerifiedName({
  name,
  size = 20,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <span className={`zurs-verified-name ${className}`.trim()}>
      <span className="zurs-verified-name__text">{name}</span>
      <span className="zurs-verified-name__mark" title="គណនីបានផ្ទៀងផ្ទាត់">
        <VerifiedMark size={size} />
      </span>
    </span>
  );
}
