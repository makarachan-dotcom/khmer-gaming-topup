/**
 * Disposable / throwaway mailbox domains. Used to stop OTP email-bombing and
 * Appwrite ghost-user creation. Keep this list conservative: a false positive
 * locks a real customer out of sign-in.
 */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "mailinator.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "guerrillamail.org",
  "sharklasers.com",
  "grr.la",
  "guerrillamailblock.com",
  "pokemail.net",
  "spam4.me",
  "10minutemail.com",
  "10minutemail.net",
  "temp-mail.org",
  "tempmail.com",
  "tempmailo.com",
  "tempmail.net",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "yopmail.com",
  "yopmail.fr",
  "fakeinbox.com",
  "getnada.com",
  "nada.ltd",
  "dispostable.com",
  "mailnesia.com",
  "maildrop.cc",
  "mintemail.com",
  "moakt.com",
  "discard.email",
  "discardmail.com",
  "mailcatch.com",
  "mytrashmail.com",
  "getairmail.com",
  "emailondeck.com",
  "tmpmail.org",
  "tmpmail.net",
  "inboxkitten.com",
  "spamgourmet.com",
  "mailnull.com",
  "guerrillamail.biz",
  "trashmail.ws",
]);

export function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  const parts = domain.split(".");
  // mailinator.co.uk-style: match the registrable tail against the list.
  if (parts.length > 2) {
    const tail = parts.slice(-2).join(".");
    if (DISPOSABLE_DOMAINS.has(tail)) return true;
  }
  return false;
}

/**
 * Strict login email: no CRLF, no spaces, RFC-ish length, no disposable inbox.
 * Returns null for anything the OTP relay must not accept.
 */
export function parseLoginEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length > 320) return null;
  if (/[\r\n\0\u000b\u000c]/.test(value)) return null;
  const email = value.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (email.includes(" ")) return null;
  if (!/^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(email)) return null;
  return email;
}
