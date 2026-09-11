import { PackEmoji } from "@/components/PackEmoji";

/** Signed-in member name with the looping verified Lottie badge. */
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
      <span className="zurs-verified-name__mark" aria-hidden="true">
        <PackEmoji name="verified" size={size} />
      </span>
    </span>
  );
}
