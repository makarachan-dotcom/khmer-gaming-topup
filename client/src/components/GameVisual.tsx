import { cn } from "@/lib/utils";

const gameArt: Record<string, string> = {
  mlbb: "/manus-storage/mobile-legends-logo_6884c584.webp",
  "free-fire": "/manus-storage/free-fire-art_c58846dc.jpg",
  pubg: "/manus-storage/pubg-mobile-art_fb240ade.jpg",
  blox: "/manus-storage/blox-fruits-art_b2f6c6e0.jpg",
};

export default function GameVisual({ slug, name, label, className }: { slug: string; name: string; label: string; className?: string }) {
  const src = gameArt[slug];
  return <div className={cn("game-visual", className)}>{src ? <img src={src} alt={`${name} official game artwork`} loading="lazy" /> : <span>{label}</span>}<div className="game-visual-shine" /></div>;
}
