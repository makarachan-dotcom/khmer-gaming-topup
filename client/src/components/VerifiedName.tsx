import { useId } from "react";

/**
 * Signed-in member name with a gold ZURS seal instead of the generic green ✅.
 * The disc, check, and sparkle are inline SVG so they stay sharp at 15–18px
 * on both the dark chat header and the light account card.
 */
function VerifiedMark({ size }: { size: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg
      className="zurs-verified-seal"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${uid}-gold`} x1="6" y1="4" x2="26" y2="28">
          <stop stopColor="#f6e08a" />
          <stop offset="0.45" stopColor="#d4a017" />
          <stop offset="1" stopColor="#8a5f1c" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="10" y1="6" x2="22" y2="20">
          <stop stopColor="#fff8d6" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff8d6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" fill={`url(#${uid}-gold)`} />
      <circle cx="16" cy="16" r="13" fill="none" stroke="#f3d27a" strokeWidth="1.4" opacity="0.85" />
      <circle cx="16" cy="16" r="10.2" fill={`url(#${uid}-shine)`} opacity="0.35" />
      <path
        d="M10.2 16.4 L14.1 20.2 L21.8 12.1"
        fill="none"
        stroke="#fffdf4"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path className="zurs-verified-seal__spark" d="M27.2 6.2 L28 8.4 L30.2 9.2 L28 10 L27.2 12.2 L26.4 10 L24.2 9.2 L26.4 8.4 Z" fill="#f6e08a" />
    </svg>
  );
}

export function VerifiedName({
  name,
  size = 18,
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
