/**
 * Round 9: every package must show a picture that MEANS what the buyer gets.
 *
 * The storefront already has real artwork for a few games (suppliedProductArtwork,
 * pubgUcAssets, generatedPackageArtwork). Anything outside those lists used to fall
 * back to a bare icon, which looked empty for the new Telegram and Roblox services.
 *
 * These fallbacks are drawn as inline SVG data URIs on purpose:
 *  - no network request, so they cannot 404 or slow the grid down,
 *  - no copyrighted game asset is copied into the repo,
 *  - the owner can still replace any single package picture from Admin, and that
 *    override always wins over the drawing below.
 */

export type MeaningfulArtworkKind =
  | "telegram-stars"
  | "telegram-premium"
  | "robux"
  | "diamond"
  | "coin"
  | "pass"
  | "ticket"
  | "bundle";

type Palette = { from: string; to: string; ink: string };

const palettes: Record<MeaningfulArtworkKind, Palette> = {
  "telegram-stars": { from: "#2ea6ff", to: "#0b5cad", ink: "#ffd84d" },
  "telegram-premium": { from: "#8b5cf6", to: "#3b1a94", ink: "#ffe082" },
  robux: { from: "#3a4a63", to: "#111a2b", ink: "#e8ecf4" },
  diamond: { from: "#38bdf8", to: "#1d4ed8", ink: "#e0f2ff" },
  coin: { from: "#f7c948", to: "#b45309", ink: "#fff7e0" },
  pass: { from: "#f472b6", to: "#9d174d", ink: "#ffe4f1" },
  ticket: { from: "#34d399", to: "#065f46", ink: "#e9fff6" },
  bundle: { from: "#fb923c", to: "#9a3412", ink: "#fff1e0" },
};

const shapes: Record<MeaningfulArtworkKind, string> = {
  // A single clean star - Telegram Stars.
  "telegram-stars":
    '<path d="M80 30l14.6 29.9 33 4.8-23.9 23.2 5.7 32.8L80 105.2 50.6 120.7l5.7-32.8L32.4 64.7l33-4.8z"/><circle cx="124" cy="38" r="5" opacity=".85"/><circle cx="38" cy="120" r="4" opacity=".7"/>',
  // Crown over a bar - Telegram Premium.
  "telegram-premium":
    '<path d="M38 100l-6-46 26 17 22-31 22 31 26-17-6 46z"/><rect x="38" y="108" width="84" height="14" rx="7"/><circle cx="80" cy="46" r="5" opacity=".9"/>',
  // Rotated square with a square hole - the Robux silhouette.
  robux:
    '<path d="M62 22l76 20-20 76-76-20zm6 30l-9 34 34 9 9-34z" fill-rule="evenodd"/>',
  diamond:
    '<path d="M80 26l42 32-42 76-42-76z"/><path d="M38 58h84" stroke="#0b1220" stroke-opacity=".22" stroke-width="5" fill="none"/>',
  coin:
    '<circle cx="80" cy="74" r="38"/><circle cx="80" cy="74" r="26" fill="#0b1220" fill-opacity=".18"/><rect x="42" y="116" width="76" height="12" rx="6" opacity=".75"/>',
  pass:
    '<rect x="30" y="46" width="100" height="64" rx="14"/><rect x="42" y="62" width="44" height="9" rx="4.5" fill="#0b1220" fill-opacity=".25"/><rect x="42" y="80" width="66" height="9" rx="4.5" fill="#0b1220" fill-opacity=".18"/>',
  ticket:
    '<path d="M30 58h100v20a12 12 0 000 24v20H30V102a12 12 0 000-24z"/><path d="M80 60v56" stroke="#0b1220" stroke-opacity=".28" stroke-width="5" stroke-dasharray="7 8" fill="none"/>',
  bundle:
    '<path d="M32 62l48-22 48 22-48 22z"/><path d="M32 62v42l48 22V84z" opacity=".82"/><path d="M128 62v42l-48 22V84z" opacity=".62"/>',
};

function artworkDataUri(kind: MeaningfulArtworkKind) {
  const palette = palettes[kind];
  const markup =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img">' +
    "<defs>" +
    '<radialGradient id="bg" cx="50%" cy="30%" r="78%">' +
    `<stop offset="0" stop-color="${palette.from}"/><stop offset="1" stop-color="${palette.to}"/>` +
    "</radialGradient>" +
    '<linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">' +
    `<stop offset="0" stop-color="${palette.ink}"/><stop offset="1" stop-color="${palette.ink}" stop-opacity=".72"/>` +
    "</linearGradient>" +
    "</defs>" +
    '<rect width="160" height="160" rx="30" fill="url(#bg)"/>' +
    '<ellipse cx="80" cy="36" rx="64" ry="30" fill="#ffffff" opacity=".12"/>' +
    `<g fill="url(#fg)">${shapes[kind]}</g>` +
    "</svg>";
  return `data:image/svg+xml,${encodeURIComponent(markup)}`;
}

const artworkCache = new Map<MeaningfulArtworkKind, string>();

export function meaningfulArtworkUrl(kind: MeaningfulArtworkKind) {
  const cached = artworkCache.get(kind);
  if (cached) return cached;
  const url = artworkDataUri(kind);
  artworkCache.set(kind, url);
  return url;
}

/** Chooses the picture from what the buyer actually receives. */
export function meaningfulArtworkKind(gameId: string, gameName: string, label: string, amountLabel: string): MeaningfulArtworkKind {
  const game = `${gameId} ${gameName}`.toLowerCase();
  const text = `${label} ${amountLabel}`.toLowerCase();
  const all = `${game} ${text}`;
  if (/telegram/.test(all) && /premium|month/.test(all)) return "telegram-premium";
  if (/telegram/.test(all) || /\bstars?\b/.test(text)) return "telegram-stars";
  if (/roblox|robux/.test(all)) return "robux";
  if (/\bticket\b/.test(text)) return "ticket";
  if (/\bpass\b|membership|subscription|weekly|monthly|daily/.test(text)) return "pass";
  if (/bundle|crate|chest|\bbag\b|\bbox\b|combo/.test(text)) return "bundle";
  if (/coin|gold|token|credit|\buc\b|\bcp\b|\bbc\b|robux/.test(text)) return "coin";
  return "diamond";
}

export function meaningfulPackageArtwork(gameId: string, gameName: string, label: string, amountLabel: string) {
  const kind = meaningfulArtworkKind(gameId, gameName, label, amountLabel);
  return { kind, url: meaningfulArtworkUrl(kind) };
}
