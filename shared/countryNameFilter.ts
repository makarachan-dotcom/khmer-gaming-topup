/**
 * Name-based foreign-country filter (owner request, 2026-09-30):
 * a product is excluded ONLY when its display NAME explicitly names another
 * country or multi-country region. Provider category ids / region slugs
 * (mobile_legends_ph, free_fire_sg, ...) are NEVER a reason to exclude —
 * every regional category stays on the storefront.
 *
 * Always kept: names mentioning Cambodia/Khmer, names with Global, names with
 * no country marker, and ALL Free Fire products (every region).
 *
 * The patterns below are deliberately conservative: full country/region names
 * (word-boundaried), flag emoji, and parenthesized 2-letter codes such as
 * "(PH)". Bare short codes are NOT matched — "ID" also means "identifier"
 * and "US" also means "us" — so "Player ID" style labels never get filtered.
 */

const FOREIGN_COUNTRY_NAME_PATTERNS: RegExp[] = [
  /\bindonesia\b|\bindonesian\b/i,
  /\bthailand\b|\bthai\b|ไทย|ประเทศไทย/i,
  /\bvietnam\b|\bvietnamese\b/i,
  /\bmalaysia\b|\bmalaysian\b/i,
  /\bphilippines\b|\bphilippine\b|\bfilipino\b/i,
  /\bsingapore\b|\bsingaporean\b/i,
  /\bmyanmar\b|\bburmese\b/i,
  /\bbangladesh\b|\bbangladeshi\b/i,
  /\bbrunei\b|\bbruneian\b/i,
  /\blaos\b|\blaotian\b/i,
  /\bbrazil\b|\bbrasil\b|\bbrazilian\b/i,
  /\bpakistan\b|\bpakistani\b/i,
  /\btaiwan\b|\btaiwanese\b/i,
  /\bturkey\b|\bturkish\b|\bturkiye\b/i,
  /\brussia\b|\brussian\b/i,
  /\bunited\s+states\b|\busa\b/i,
  /\bcanada\b|\bcanadian\b/i,
  /\bjapan\b|\bjapanese\b/i,
  /\bkorea\b|\bkorean\b/i,
  /\bchina\b|\bchinese\b/i,
  /\bindia\b|\bindian\b/i,
  /\baustralia\b|\baustralian\b/i,
  /\bnew\s+zealand\b/i,
  /\bsaudi\b|\bsaudi\s+arabia\b/i,
  /\bunited\s+arab\s+emirates\b|\buae\b/i,
  /\beurope\b|\beuropean\b/i,
  /\bmiddle\s+east\b/i,
  // Multi-country region groups the provider uses (delimited so they never
  // match inside ordinary words).
  /(?:^|[\s(\-/])(?:latam|mena|cis|naeu)(?:$|[\s)\-/])/i,
  // "MY/SG" style combined routes.
  /\bmy\s*\/\s*sg\b|\bsg\s*\/\s*my\b/i,
  // Parenthesized 2-letter country codes as used in display names like
  // "Mobile Legends (PH)". Parentheses keep this from matching "Player ID"
  // or other bare abbreviations.
  /\((?:ph|id|my|sg|th|vn|mm|bd|bn|la|br|pk|tw|tr|ru|jp|kr|cn|in|au|nz|sa|ae|us|ca|eu)\)/i,
  // Flag emoji.
  /🇮🇩|🇹🇭|🇻🇳|🇲🇾|🇵🇭|🇸🇬|🇲🇲|🇧🇩|🇧🇳|🇱🇦|🇧🇷|🇵🇰|🇹🇼|🇹🇷|🇷🇺|🇺🇸|🇨🇦|🇯🇵|🇰🇷|🇨🇳|🇮🇳|🇦🇺|🇪🇺|🇸🇦|🇦🇪/,
];

const CAMBODIA_KEEP_PATTERN = /cambodia|khmer|កម្ពុជា|ខ្មែរ|🇰🇭/i;
const FREE_FIRE_KEEP_PATTERN = /free[\s_-]*fire/i;

export function isForeignCountryNamedProduct(name: string | null | undefined): boolean {
  if (!name) return false;
  // Free Fire is sold on the storefront in all regions per owner request.
  if (FREE_FIRE_KEEP_PATTERN.test(name)) return false;
  // Cambodia/Khmer products are always kept.
  if (CAMBODIA_KEEP_PATTERN.test(name)) return false;
  return FOREIGN_COUNTRY_NAME_PATTERNS.some((pattern) => pattern.test(name));
}
