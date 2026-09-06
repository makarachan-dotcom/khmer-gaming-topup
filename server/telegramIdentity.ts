/**
 * Round 9: verify a Telegram handle before we sell Stars or Premium to it.
 *
 * Telegram publishes a tiny public preview page at https://t.me/<username>.
 * We read ONLY the public display name and the public profile picture from that
 * page - nothing else. There is no API key, no login, and no private data: the
 * same bytes are served to any anonymous browser that opens the link.
 *
 * Why this matters commercially: Stars and Premium are delivered to a handle.
 * A typo is unrecoverable, and a channel or bot handle cannot receive Premium at
 * all, so the buyer must see the real account name before paying.
 *
 * parseTelegramProfileHtml is deliberately pure so it can be unit tested without
 * network access.
 */

export type TelegramAccountKind = "user" | "bot" | "channel" | "group";

export type TelegramProfile = {
  handle: string;
  displayName: string;
  photoUrl: string | null;
  kind: TelegramAccountKind;
};

export type TelegramLookupResult =
  | { status: "verified"; profile: TelegramProfile }
  | { status: "invalid"; reason: "format" | "not_found" | "not_a_user" }
  | { status: "unavailable" };

const lookupTimeoutMs = 6_000;
const cacheTtlMs = 5 * 60 * 1000;
const failureCacheTtlMs = 60 * 1000;
const maxCacheEntries = 400;
const maxHtmlBytes = 512 * 1024;

const profileCache = new Map<string, { at: number; ttl: number; value: TelegramLookupResult }>();

/**
 * Assembled from parts rather than written as one literal so that URL-rewriting
 * tooling in the build and docs pipeline cannot corrupt it.
 */
function telegramPreviewOrigin() {
  return ["https:", "", "t.me"].join("/");
}

/** Accepts "@name", "name", "t.me/name", "https://t.me/name?start=1". */
export function normalizeTelegramHandle(raw: string) {
  return raw
    .trim()
    .replace(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me|telegram\.dog)\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@+/, "")
    .trim();
}

/** Telegram public usernames: 5-32 chars, must start with a letter. */
export function isTelegramHandleShape(handle: string) {
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(handle);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : "";
    })
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function metaContent(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const forward = new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]*content=["']([^"']*)["']`, "i");
  const reverse = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${escaped}["']`, "i");
  const raw = html.match(forward)?.[1] ?? html.match(reverse)?.[1] ?? null;
  return raw === null ? null : decodeHtmlEntities(raw).trim();
}

function elementText(html: string, className: string) {
  const pattern = new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]{0,400}?)<\\/`, "i");
  const raw = html.match(pattern)?.[1];
  if (!raw) return null;
  return decodeHtmlEntities(raw.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim() || null;
}

/** Only Telegram's own image hosts may reach the browser as a profile picture. */
export function isTelegramPhotoUrl(value: string) {
  if (!/^https:\/\//i.test(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "t.me" || host === "telesco.pe" || host.endsWith(".telesco.pe") || host === "cdn-telegram.org" || host.endsWith(".cdn-telegram.org");
  } catch {
    return false;
  }
}

function accountKind(handle: string, extra: string | null, description: string | null): TelegramAccountKind {
  const context = `${extra ?? ""} ${description ?? ""}`.toLowerCase();
  if (/\bsubscribers?\b/.test(context)) return "channel";
  if (/\bmembers?\b/.test(context)) return "group";
  if (/bot$/i.test(handle)) return "bot";
  return "user";
}

/**
 * Turns the public t.me HTML into a result. Verification requires POSITIVE proof
 * that the handle resolves to something: Telegram answers 200 OK even for a
 * handle that does not exist, and that placeholder page carries only the generic
 * "Telegram" open-graph title. Anything we cannot positively confirm is reported
 * as not found rather than guessed as valid.
 */
export function parseTelegramProfileHtml(handle: string, html: string): TelegramLookupResult {
  const ogTitle = metaContent(html, "og:title");
  const pageTitle = elementText(html, "tgme_page_title");
  const extra = elementText(html, "tgme_page_extra");
  const description = metaContent(html, "og:description");
  const ogImage = metaContent(html, "og:image");

  const candidate = (ogTitle ?? pageTitle ?? "").trim();
  const looksLikePlaceholder =
    !candidate ||
    /^telegram\b/i.test(candidate) ||
    candidate.toLowerCase() === handle.toLowerCase() ||
    candidate.toLowerCase() === `@${handle.toLowerCase()}`;

  // A real account page always renders the name block. The placeholder does not.
  const hasAccountBlock = Boolean(pageTitle) || Boolean(ogImage && isTelegramPhotoUrl(ogImage));
  if (looksLikePlaceholder || !hasAccountBlock) return { status: "invalid", reason: "not_found" };

  const kind = accountKind(handle, extra, description);
  if (kind !== "user") return { status: "invalid", reason: "not_a_user" };

  return {
    status: "verified",
    profile: {
      handle,
      displayName: candidate.slice(0, 120),
      photoUrl: ogImage && isTelegramPhotoUrl(ogImage) ? ogImage : null,
      kind,
    },
  };
}

function rememberLookup(handle: string, value: TelegramLookupResult) {
  if (profileCache.size >= maxCacheEntries) {
    const oldest = profileCache.keys().next();
    if (!oldest.done) profileCache.delete(oldest.value);
  }
  profileCache.set(handle, { at: Date.now(), ttl: value.status === "verified" ? cacheTtlMs : failureCacheTtlMs, value });
  return value;
}

export function resetTelegramIdentityCacheForTests() {
  profileCache.clear();
}

export async function lookupTelegramProfile(rawHandle: string): Promise<TelegramLookupResult> {
  const handle = normalizeTelegramHandle(rawHandle);
  if (!isTelegramHandleShape(handle)) return { status: "invalid", reason: "format" };

  const cached = profileCache.get(handle);
  if (cached && Date.now() - cached.at < cached.ttl) return cached.value;

  try {
    const response = await fetch(`${telegramPreviewOrigin()}/${encodeURIComponent(handle)}`, {
      method: "GET",
      redirect: "follow",
      headers: {
        // Telegram serves the open-graph preview to plain browser requests.
        "user-agent": "Mozilla/5.0 (compatible; ZursStore/1.0)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(lookupTimeoutMs),
    });
    if (response.status === 404 || response.status === 410) {
      return rememberLookup(handle, { status: "invalid", reason: "not_found" });
    }
    if (!response.ok) return rememberLookup(handle, { status: "unavailable" });
    const html = (await response.text()).slice(0, maxHtmlBytes);
    return rememberLookup(handle, parseTelegramProfileHtml(handle, html));
  } catch (error) {
    console.warn("[telegram-identity] lookup failed", handle, error instanceof Error ? error.message : error);
    // A timeout must never be reported as a bad username.
    return rememberLookup(handle, { status: "unavailable" });
  }
}
