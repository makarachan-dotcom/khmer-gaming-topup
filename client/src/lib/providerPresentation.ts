export type ProviderPackageBadge = {
  label: string;
  tone: "weekly" | "discount" | "recommended" | "bonus";
};

export function providerPackageBadge(
  label: string
): ProviderPackageBadge | null {
  const normalized = label.toLowerCase();
  if (/weekly|week\s*pass/.test(normalized))
    return { label: "WEEKLY PASS", tone: "weekly" };
  if (/discount|sale|promo/.test(normalized))
    return { label: "DISCOUNT", tone: "discount" };
  if (/recommended|popular|best\s*value/.test(normalized))
    return { label: "RECOMMENDED", tone: "recommended" };
  if (/\bbonus\b|\d+\s*\+\s*\d+/.test(normalized))
    return { label: "BONUS", tone: "bonus" };
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

const countryCodeFlags: Record<string, { flag: string; label: string }> = {
  BD: { flag: "🇧🇩", label: "Bangladesh" },
  BR: { flag: "🇧🇷", label: "Brazil" },
  EU: { flag: "🇪🇺", label: "Europe" },
  ID: { flag: "🇮🇩", label: "Indonesia" },
  KH: { flag: "🇰🇭", label: "Cambodia" },
  MY: { flag: "🇲🇾", label: "Malaysia" },
  PH: { flag: "🇵🇭", label: "Philippines" },
  RU: { flag: "🇷🇺", label: "Russia" },
  SG: { flag: "🇸🇬", label: "Singapore" },
  TR: { flag: "🇹🇷", label: "Turkey" },
  US: { flag: "🇺🇸", label: "United States" },
  VN: { flag: "🇻🇳", label: "Vietnam" },
};

export function countryFlagForRegion(region?: string | null) {
  if (!region) return null;
  const normalized = region.trim().toLowerCase();
  return (
    countryFlags.find(country =>
      country.matches.some(
        match => normalized === match || normalized.includes(match)
      )
    ) ?? null
  );
}

export function gameRegionMarker(name: string, providerRegion?: string | null) {
  const source = `${providerRegion ?? ""} ${name}`.trim();
  const byName = countryFlagForRegion(source);
  if (byName) return { kind: "country" as const, ...byName };
  const code = source
    .match(/\(([A-Z]{2})\)|\b([A-Z]{2})\b/)
    ?.slice(1)
    .find(Boolean);
  if (code && countryCodeFlags[code])
    return { kind: "country" as const, ...countryCodeFlags[code] };
  return { kind: "global" as const, label: "Global" };
}

/** Cambodia storefront marker for all Global titles and Singapore (SG) titles accepted for Cambodia. */
export function cambodiaSupportMarker(name: string, providerRegion?: string | null) {
  const marker = gameRegionMarker(name, providerRegion);
  if (marker.kind === "global") return { flag: "🇰🇭", label: "Cambodia · Global" };
  if (marker.kind === "country" && marker.label === "Singapore") return { flag: "🇰🇭", label: "Cambodia · SG" };
  return null;
}

export function orderProviderGames<
  T extends { id: string; name: string; region?: string | null },
>(games: T[]) {
  return [...games].sort((left, right) => {
    const priority = (game: T) => {
      const marker = gameRegionMarker(game.name, game.region);
      if (marker.kind === "country" && marker.label === "Cambodia") return 0;
      if (marker.kind === "global") return 1;
      return 2;
    };
    const difference = priority(left) - priority(right);
    return (
      difference ||
      left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
      left.id.localeCompare(right.id)
    );
  });
}

export type ProviderGameFilter = "all" | "cambodia" | "global";

export function filterProviderGames<
  T extends { id: string; name: string; region?: string | null },
>(games: T[], query: string, filter: ProviderGameFilter = "all") {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return games.filter(game => {
    const marker = gameRegionMarker(game.name, game.region);
    const matchesFilter =
      filter === "all" ||
      (filter === "cambodia" &&
        marker.kind === "country" &&
        marker.label === "Cambodia") ||
      (filter === "global" && marker.kind === "global");
    const matchesQuery =
      !normalizedQuery ||
      `${game.name} ${game.region ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}
