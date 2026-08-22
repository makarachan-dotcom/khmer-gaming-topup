export type ProviderPackageBadge = {
  label: string;
  tone: "weekly" | "discount" | "recommended" | "bonus";
};

export function providerPackageBadge(label: string): ProviderPackageBadge | null {
  const normalized = label.toLowerCase();
  if (/weekly|week\s*pass/.test(normalized)) return { label: "WEEKLY PASS", tone: "weekly" };
  if (/discount|sale|promo/.test(normalized)) return { label: "DISCOUNT", tone: "discount" };
  if (/recommended|popular|best\s*value/.test(normalized)) return { label: "RECOMMENDED", tone: "recommended" };
  if (/\bbonus\b|\d+\s*\+\s*\d+/.test(normalized)) return { label: "BONUS", tone: "bonus" };
  return null;
}

const countryFlags = [
  { matches: ["cambodia", "khmer"], flag: "🇰🇭", label: "Cambodia" },
  { matches: ["indonesia", "indonesian"], flag: "🇮🇩", label: "Indonesia" },
  { matches: ["thailand", "thai"], flag: "🇹🇭", label: "Thailand" },
  { matches: ["vietnam", "vietnamese"], flag: "🇻🇳", label: "Vietnam" },
  { matches: ["malaysia", "malaysian"], flag: "🇲🇾", label: "Malaysia" },
  { matches: ["philippines", "philippine"], flag: "🇵🇭", label: "Philippines" },
  { matches: ["singapore"], flag: "🇸🇬", label: "Singapore" },
  { matches: ["europe", "european"], flag: "🇪🇺", label: "Europe" },
  { matches: ["russia", "russian", "ru"], flag: "🇷🇺", label: "Russia" },
];

export function countryFlagForRegion(region?: string | null) {
  if (!region) return null;
  const normalized = region.trim().toLowerCase();
  return countryFlags.find((country) => country.matches.some((match) => normalized === match || normalized.includes(match))) ?? null;
}
