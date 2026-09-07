import { PackEmoji } from "@/components/PackEmoji";
import { khqrLogoUrl } from "@/lib/mobileLegendsAssets";

const ITEMS = [
  { id: "khqr", label: "KHQR ផ្លូវការ" },
  { id: "eta", label: "៥–១០ នាទី", pack: "shield-check" as const },
  { id: "logo", label: "Logo ផ្លូវការ", pack: "sparkles-z" as const },
  { id: "trust", label: "មានទំនុកចិត្ត", pack: "diamond-blue" as const },
];

export function TrustStrip({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`zurs-trust${compact ? " zurs-trust--compact" : ""}`} aria-label="ហេតុអ្វីទុកចិត្ត ZURS.me">
      {ITEMS.map((item) => (
        <li key={item.id}>
          {item.id === "khqr" ? <img src={khqrLogoUrl} alt="" /> : <PackEmoji name={item.pack!} size={14} />}
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
