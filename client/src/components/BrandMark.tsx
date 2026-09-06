import { PackEmoji } from "@/components/PackEmoji";
import { BRAND_PATHS } from "@/components/brandIcons";

type BrandId =
  | "chatgpt"
  | "gemini"
  | "claude"
  | "cursor"
  | "canva"
  | "capcut"
  | "netflix"
  | "spotify"
  | "youtube"
  | "telegram"
  | "figma"
  | "elevenlabs"
  | "linkedin"
  | "prime"
  | "ilovepdf"
  | "discord"
  | "whatsapp"
  | "tiktok"
  | "instagram"
  | "facebook"
  | "adobe"
  | "apple"
  | "steam"
  | "nordvpn"
  | "heygen"
  | "quillbot"
  | "manus"
  | "microsoft";

const BRAND_STYLE: Record<Exclude<BrandId, "chatgpt" | "gemini">, { bg: string; fg: string; path: keyof typeof BRAND_PATHS | "microsoft"; label: string }> = {
  claude: { bg: "#D97757", fg: "#fff", path: "claude", label: "Claude" },
  cursor: { bg: "#111111", fg: "#fff", path: "cursor", label: "Cursor" },
  canva: { bg: "#00C4CC", fg: "#fff", path: "canva", label: "Canva" },
  capcut: { bg: "#000000", fg: "#fff", path: "capcut", label: "CapCut" },
  netflix: { bg: "#E50914", fg: "#fff", path: "netflix", label: "Netflix" },
  spotify: { bg: "#1DB954", fg: "#fff", path: "spotify", label: "Spotify" },
  youtube: { bg: "#FF0000", fg: "#fff", path: "youtube", label: "YouTube" },
  telegram: { bg: "#26A5E4", fg: "#fff", path: "telegram", label: "Telegram" },
  figma: { bg: "#1E1E1E", fg: "#fff", path: "figma", label: "Figma" },
  elevenlabs: { bg: "#111111", fg: "#fff", path: "elevenlabs", label: "ElevenLabs" },
  linkedin: { bg: "#0A66C2", fg: "#fff", path: "linkedin", label: "LinkedIn" },
  prime: { bg: "#00A8E1", fg: "#fff", path: "prime", label: "Prime Video" },
  ilovepdf: { bg: "#E5322D", fg: "#fff", path: "ilovepdf", label: "iLovePDF" },
  discord: { bg: "#5865F2", fg: "#fff", path: "discord", label: "Discord" },
  whatsapp: { bg: "#25D366", fg: "#fff", path: "whatsapp", label: "WhatsApp" },
  tiktok: { bg: "#111111", fg: "#fff", path: "tiktok", label: "TikTok" },
  instagram: { bg: "#E1306C", fg: "#fff", path: "instagram", label: "Instagram" },
  facebook: { bg: "#0866FF", fg: "#fff", path: "facebook", label: "Facebook" },
  adobe: { bg: "#FF0000", fg: "#fff", path: "adobe", label: "Adobe" },
  apple: { bg: "#111111", fg: "#fff", path: "apple", label: "Apple" },
  steam: { bg: "#171A21", fg: "#fff", path: "steam", label: "Steam" },
  nordvpn: { bg: "#4687FF", fg: "#fff", path: "nordvpn", label: "VPN" },
  heygen: { bg: "#0F766E", fg: "#fff", path: "heygen", label: "HeyGen" },
  quillbot: { bg: "#499557", fg: "#fff", path: "quillbot", label: "QuillBot" },
  manus: { bg: "#EA580C", fg: "#fff", path: "manus", label: "Manus" },
  microsoft: { bg: "#F4F4F4", fg: "#111", path: "microsoft", label: "Microsoft" },
};

const RULES: Array<[RegExp, BrandId]> = [
  [/chatgpt|openai|\bgpt\b/, "chatgpt"],
  [/gemini/, "gemini"],
  [/claude|anthropic/, "claude"],
  [/cursor/, "cursor"],
  [/canva/, "canva"],
  [/capcut|cap cut/, "capcut"],
  [/netflix/, "netflix"],
  [/spotify/, "spotify"],
  [/youtube|ytb/, "youtube"],
  [/telegram/, "telegram"],
  [/figma/, "figma"],
  [/eleven/, "elevenlabs"],
  [/linkedin/, "linkedin"],
  [/prime/, "prime"],
  [/ilovepdf|i love pdf|love.?pdf/, "ilovepdf"],
  [/discord|nitro/, "discord"],
  [/whatsapp/, "whatsapp"],
  [/tiktok/, "tiktok"],
  [/instagram|\big\b/, "instagram"],
  [/facebook|meta/, "facebook"],
  [/photoshop|adobe/, "adobe"],
  [/apple|icloud|itunes/, "apple"],
  [/steam/, "steam"],
  [/\bvpn\b|nordvpn|wireguard/, "nordvpn"],
  [/heygen/, "heygen"],
  [/quill/, "quillbot"],
  [/manus/, "manus"],
  [/microsoft|office|windows/, "microsoft"],
];

export function matchBrand(text: string): BrandId | null {
  const value = text.toLowerCase();
  for (const [pattern, id] of RULES) if (pattern.test(value)) return id;
  return null;
}

export function BrandMark({ id, size = 28, className = "" }: { id: BrandId; size?: number; className?: string }) {
  if (id === "chatgpt") return <PackEmoji name="svc-chatgpt" size={size} className={className} />;
  if (id === "gemini") return <PackEmoji name="svc-gemini" size={size} className={className} />;
  const style = BRAND_STYLE[id];
  const radius = Math.max(6, Math.round(size * 0.28));
  const icon = Math.round(size * 0.58);
  return (
    <span
      role="img"
      aria-label={style.label}
      className={`zurs-brand ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: style.bg,
        display: "inline-grid",
        placeItems: "center",
        flex: "0 0 auto",
        overflow: "hidden",
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
      }}
    >
      {style.path === "microsoft" ? (
        <svg viewBox="0 0 24 24" width={icon} height={icon} aria-hidden="true">
          <rect x="1" y="1" width="10" height="10" fill="#F25022" />
          <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
          <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
          <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width={icon} height={icon} aria-hidden="true">
          <path d={BRAND_PATHS[style.path]} fill={style.fg} />
        </svg>
      )}
    </span>
  );
}

export function ServiceLogo({ text, size = 28, className = "" }: { text: string; size?: number; className?: string }) {
  const brand = matchBrand(text);
  if (brand) return <BrandMark id={brand} size={size} className={className} />;
  return <PackEmoji name="svc-sparkle" size={size} className={className} />;
}
