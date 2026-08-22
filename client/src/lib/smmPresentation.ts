export const smmPlatforms = ["All", "Facebook", "Instagram", "TikTok", "YouTube", "Telegram"] as const;

export function smmPlatformFor(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("facebook")) return { label: "Facebook" };
  if (normalized.includes("instagram")) return { label: "Instagram" };
  if (normalized.includes("tiktok")) return { label: "TikTok" };
  if (normalized.includes("youtube")) return { label: "YouTube" };
  if (normalized.includes("telegram")) return { label: "Telegram" };
  return { label: "Social" };
}
