import { AnimatedEmoji } from "@/components/AnimatedEmoji";

/**
 * Signed-in name badge. 🤩 (star-struck) instead of a green check: the
 * Noto Lottie spins stars in the eyes while CSS adds a laugh-wobble.
 */
export function VerifiedName({
  name,
  size = 22,
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
        <AnimatedEmoji emoji="🤩" size={size} />
      </span>
    </span>
  );
}
