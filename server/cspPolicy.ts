import { createHash } from "node:crypto";

/**
 * Page CSP helpers.
 *
 * Static Vite HTML on Vercel has no per-request nonce, so inline JSON-LD in
 * `client/index.html` is allowed only by sha256 hashes of those exact blocks.
 * The Vite bundle is an external `/assets/*.js` file covered by `'self'`.
 *
 * `'strict-dynamic'` is intentionally omitted: it ignores `'self'` and would
 * block the parser-inserted module script (JSON-LD hashes do not load it).
 * `'unsafe-eval'` is omitted; lottie-web can eval expressions, but the Noto
 * emoji / loading JSON we ship does not use expressions.
 */

export function cspSha256(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

export function inlineScriptBodies(html: string): string[] {
  const bodies: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    if (/\bsrc\s*=/i.test(match[1] ?? "")) continue;
    bodies.push(match[2] ?? "");
  }
  return bodies;
}

export function scriptSrcFromInlineHtml(html: string): string {
  const hashes = inlineScriptBodies(html).map(cspSha256);
  return hashes.length > 0 ? `script-src 'self' ${hashes.join(" ")}` : "script-src 'self'";
}

/** Hashes of the theme boot script + JSON-LD blocks in `client/index.html`. */
export const INDEX_JSONLD_SCRIPT_HASHES = [
  "'sha256-M1hxKy77n4W5qR7Zyia6sr9tfxljigVWqNfWGKbCUWo='",
  "'sha256-RNVq7KCFgdPTgiE2ccaasel0NNygecV5GIjMuAplKl8='",
  "'sha256-/A4iLe8qmlxaNjrdqCmaLpw29lK0pp9QMdV7p1No5Mg='",
  "'sha256-+2fpB4RRSi59XpvbtzRVb6BWOSv9U5x2j39nSlGychE='",
] as const;

const HTML_CSP_AFTER_SCRIPT = [
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://www.zurs.me https://files.manuscdn.com https://*.appwrite.io https://*.googleusercontent.com https://*.cdn.digitaloceanspaces.com https://reseller.fazercards.com",
  "connect-src 'self' https://www.zurs.me https://zurs.me https://*.appwrite.io https://accounts.google.com https://fonts.gstatic.com",
  "media-src 'self' blob:",
  "frame-src 'self' https://accounts.google.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
] as const;

export function htmlContentSecurityPolicy(scriptSrc: string): string {
  return ["default-src 'self'", scriptSrc, ...HTML_CSP_AFTER_SCRIPT].join("; ");
}

export function htmlContentSecurityPolicyFromHtml(html: string): string {
  return htmlContentSecurityPolicy(scriptSrcFromInlineHtml(html));
}

export function htmlContentSecurityPolicyFromCommittedHashes(): string {
  return htmlContentSecurityPolicy(`script-src 'self' ${INDEX_JSONLD_SCRIPT_HASHES.join(" ")}`);
}
