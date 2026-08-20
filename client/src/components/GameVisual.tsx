import { cn } from "@/lib/utils";

const gameArt: Record<string, string> = {
  mlbb: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/BNJqalnFtclRRCiT.webp",
  "free-fire": "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/fburUCTmIwlaMTcd.jpg",
  pubg: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/pBboNKOCtOgaXMBf.jpg",
  blox: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/zjTlHGZicKSaidSv.jpg",
};

export default function GameVisual({ slug, name, label, className }: { slug: string; name: string; label: string; className?: string }) {
  const src = gameArt[slug];
  return <div className={cn("game-visual", className)}>{src ? <img src={src} alt={`${name} official game artwork`} loading="lazy" /> : <span>{label}</span>}<div className="game-visual-shine" /></div>;
}
