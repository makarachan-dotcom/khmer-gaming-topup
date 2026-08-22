import { cn } from "@/lib/utils";
import { Share2 } from "lucide-react";
import { siFacebook, siInstagram, siTelegram, siTiktok, siYoutube, type SimpleIcon } from "simple-icons";

const platformMarks: Record<string, SimpleIcon> = {
  Facebook: siFacebook,
  Instagram: siInstagram,
  TikTok: siTiktok,
  YouTube: siYoutube,
  Telegram: siTelegram,
};

export function SmmPlatformLogo({ platform, className }: { platform: string; className?: string }) {
  const mark = platformMarks[platform];
  if (!mark) return <Share2 className={cn("h-4 w-4", className)} aria-hidden="true" />;
  return <svg viewBox="0 0 24 24" className={cn("h-4 w-4", className)} style={{ color: `#${mark.hex}` }} role="img" aria-label={`${platform} official logo`}><path fill="currentColor" d={mark.path} /></svg>;
}
