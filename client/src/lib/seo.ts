import { useEffect } from "react";

/**
 * Per-route document metadata without adding a dependency.
 *
 * The app is a client-rendered SPA, so every route shares the `index.html`
 * head. Googlebot renders JavaScript, but it only sees the title and
 * description that exist after render, which means every indexable route needs
 * to write its own. `react-helmet-async` would do the same job; a ~60 line hook
 * avoids touching the lockfile and keeps the entry chunk smaller.
 */

export const SITE_ORIGIN = "https://www.zurs.me";
export const DEFAULT_SOCIAL_IMAGE = `${SITE_ORIGIN}/og-cover.png`;

export type SeoOptions = {
  /** Full <title>. Keep it under ~60 characters where possible. */
  title: string;
  /** Meta description, ideally 150-160 characters. */
  description: string;
  /** Route path such as "/live-spin". Used for canonical and og:url. */
  path: string;
  /** Absolute image URL for social cards. */
  image?: string;
  /** Private surfaces (checkout, admin, account) must never be indexed. */
  noindex?: boolean;
};

function upsertMeta(selector: string, attribute: "name" | "property", key: string, content: string) {
  if (typeof document === "undefined") return;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  if (typeof document === "undefined") return;
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }
  element.setAttribute("href", href);
}

export function applySeo(options: SeoOptions) {
  if (typeof document === "undefined") return;
  const { title, description, path, image = DEFAULT_SOCIAL_IMAGE, noindex = false } = options;
  const url = `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;

  document.title = title;
  upsertCanonical(url);
  upsertMeta('meta[name="description"]', "name", "description", description);
  upsertMeta(
    'meta[name="robots"]',
    "name",
    "robots",
    noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1",
  );
  upsertMeta('meta[property="og:title"]', "property", "og:title", title);
  upsertMeta('meta[property="og:description"]', "property", "og:description", description);
  upsertMeta('meta[property="og:url"]', "property", "og:url", url);
  upsertMeta('meta[property="og:image"]', "property", "og:image", image);
  upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", title);
  upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
  upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", image);
}

/** Hook form of {@link applySeo}. Call it once at the top of a page component. */
export function useSeo(options: SeoOptions) {
  const { title, description, path, image, noindex } = options;
  useEffect(() => {
    applySeo({ title, description, path, image, noindex });
  }, [title, description, path, image, noindex]);
}
