import { Instagram, Music2, Send, Share2, Youtube } from "lucide-react";

export const smmPlatforms = ["All", "Facebook", "Instagram", "TikTok", "YouTube", "Telegram"] as const;

export function smmPlatformFor(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("facebook")) return { label: "Facebook", icon: Share2 };
  if (normalized.includes("instagram")) return { label: "Instagram", icon: Instagram };
  if (normalized.includes("tiktok")) return { label: "TikTok", icon: Music2 };
  if (normalized.includes("youtube")) return { label: "YouTube", icon: Youtube };
  if (normalized.includes("telegram")) return { label: "Telegram", icon: Send };
  return { label: "Social", icon: Share2 };
}
