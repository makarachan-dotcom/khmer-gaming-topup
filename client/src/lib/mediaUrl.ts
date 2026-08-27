const LEGACY_MANUS_STORAGE_PREFIX = "/manus-storage/";
const WEBSITE_MEDIA_PREFIX = "/api/media/";

/**
 * Serves managed uploads through ZURS's own API route. Older records retain
 * their stored value, but render through the same working origin endpoint.
 */
export function toWebsiteMediaUrl(value?: string | null): string {
  const url = value?.trim() ?? "";
  if (!url) return "";
  if (url.startsWith(LEGACY_MANUS_STORAGE_PREFIX)) {
    return `${WEBSITE_MEDIA_PREFIX}${url.slice(LEGACY_MANUS_STORAGE_PREFIX.length)}`;
  }
  return url;
}

export function isWebsiteManagedMediaUrl(value?: string | null): boolean {
  const url = value?.trim() ?? "";
  return url.startsWith(WEBSITE_MEDIA_PREFIX) || url.startsWith(LEGACY_MANUS_STORAGE_PREFIX);
}
