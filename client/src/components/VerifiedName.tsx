import { useId } from "react";

/**
 * Gold ZURS seal next to a signed-in name. Outer sparkles spin; the disc
 * wobbles like a laugh. Replaces the generic green ✅ so it still reads as
 * verified, but on-brand and moving.
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
        <linearGradient id={`${uid}-gold`} x1="8" y1="6" x2="28" y2="30">
          <stop stopColor="#fff3b0" />
          <stop offset="0.4" stopColor="#e3b34c" />
          <stop offset="1" stopColor="#8a5f1c" />
        </linearGradient>
      </defs>

      <g className="zurs-verified-seal__ring">
        <path d="M18 1.6 L19.1 4.4 L22 5.5 L19.1 6.6 L18 9.4 L16.9 6.6 L14 5.5 L16.9 4.4 Z" fill="#f6e08a" />
        <path d="M18 26.6 L19.1 29.4 L22 30.5 L19.1 31.6 L18 34.4 L16.9 31.6 L14 30.5 L16.9 29.4 Z" fill="#f6e08a" />
        <path d="M30.5 14 L31.6 16.9 L34.4 18 L31.6 19.1 L30.5 22 L29.4 19.1 L26.6 18 L29.4 16.9 Z" fill="#f3d27a" />
        <path d="M1.6 18 L4.4 16.9 L5.5 14 L6.6 16.9 L9.4 18 L6.6 19.1 L5.5 22 L4.4 19.1 Z" fill="#f3d27a" />
      </g>

      <g className="zurs-verified-seal__face">
        <circle cx="18" cy="18" r="11.2" fill={`url(#${uid}-gold)`} />
        <circle cx="18" cy="18" r="11.2" fill="none" stroke="#fff1b8" strokeWidth="1.3" opacity="0.9" />
        <path
          d="M12.6 18.3 L16.4 22.1 L24.2 13.6"
          fill="none"
          stroke="#fffdf4"
          strokeWidth="2.8"
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
