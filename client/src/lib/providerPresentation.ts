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

/** Every storefront product has been selected for Cambodia support; retain the original provider region only as a secondary label. */
export function cambodiaSupportMarker(name: string, providerRegion?: string | null) {
  const marker = gameRegionMarker(name, providerRegion);
  if (marker.kind === "global") return { flag: "🇰🇭", label: "Cambodia · Global" };
  if (marker.kind === "country" && marker.label === "Cambodia") return { flag: "🇰🇭", label: "Cambodia" };
  return { flag: "🇰🇭", label: `Cambodia · ${marker.label}` };
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
      (filter === "cambodia") ||
      (filter === "global" && marker.kind === "global");
    const matchesQuery =
      !normalizedQuery ||
      `${game.name} ${game.region ?? ""}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}


export type ProviderGameCatalogItem = {
  id: string;
  name: string;
  region?: string | null;
};

export type ProviderGameCatalogGroup<T extends ProviderGameCatalogItem> = {
  baseName: string;
  games: T[];
};

const trailingVariantNames = [
  "auto via login",
  "exclusive",
  "global",
  "promo",
  "special",
  "asia",
  "sea",
  "mena",
  "cis",
  "latam",
  "naeu",
  "bangladesh",
  "brazil",
  "canada",
  "cambodia",
  "europe",
  "indonesia",
  "malaysia",
  "pakistan",
  "philippines",
  "russia",
  "singapore",
  "taiwan",
  "turkey",
  "united states",
  "usa",
  "vietnam",
  "bd",
  "br",
  "eu",
  "id",
  "kh",
  "my",
  "ph",
  "pk",
  "ru",
  "sg",
  "tr",
  "tw",
  "us",
  "vn",
  "my/sg",
].sort((left, right) => right.length - left.length);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const trailingVariantPattern = new RegExp(
  `^(.*?)(?:\\s+-\\s*|\\s+)(${trailingVariantNames.map(escapeRegExp).join("|")})\\s*$`,
  "i"
);

/** Splits a provider title into a customer-facing game name and the genuine provider variant. */
export function providerGameNameParts(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  const parenthetical = normalized.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  if (parenthetical?.[1]?.trim() && parenthetical[2]?.trim()) {
    return { baseName: parenthetical[1].trim(), variant: parenthetical[2].trim() };
  }

  const suffix = normalized.match(trailingVariantPattern);
  if (suffix?.[1]?.trim() && suffix[2]?.trim()) {
    return { baseName: suffix[1].trim(), variant: suffix[2].trim() };
  }

  return { baseName: normalized, variant: "" };
}

export function providerGameBaseName(game: Pick<ProviderGameCatalogItem, "name">) {
  return providerGameNameParts(game.name).baseName;
}

/** The compact label is shown only inside a group of the same base game. */
export function providerGameVariantLabel(game: Pick<ProviderGameCatalogItem, "name">) {
  return providerGameNameParts(game.name).variant || "Global";
}

function providerVariantPriority(game: ProviderGameCatalogItem) {
  const variant = providerGameVariantLabel(game).toLocaleLowerCase();
  if (variant === "global") return 0;
  if (variant === "cambodia" || variant === "kh") return 1;
  return 2;
}

/**
 * Groups only genuinely equivalent provider titles. The individual product IDs stay untouched,
 * so every selected variant continues to load its own authorized details and packages.
 */
export function groupProviderGamesByBaseName<T extends ProviderGameCatalogItem>(games: T[]): ProviderGameCatalogGroup<T>[] {
  const groups = new Map<string, ProviderGameCatalogGroup<T>>();
  for (const game of games) {
    const baseName = providerGameBaseName(game);
    const key = baseName.toLocaleLowerCase();
    const existing = groups.get(key);
    if (existing) existing.games.push(game);
    else groups.set(key, { baseName, games: [game] });
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      games: [...group.games].sort((left, right) =>
        providerVariantPriority(left) - providerVariantPriority(right) ||
        providerGameVariantLabel(left).localeCompare(providerGameVariantLabel(right), undefined, { sensitivity: "base" }) ||
        left.id.localeCompare(right.id)
      ),
    }))
    .sort((left, right) => left.baseName.localeCompare(right.baseName, undefined, { sensitivity: "base" }));
}
