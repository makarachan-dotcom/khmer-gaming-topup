/**
 * End-to-end encryption for the ZURS support chat (`/chat`).
 *
 * Design (browser <-> browser, the server only ever stores ciphertext):
 *
 *   1. Support staff publish ONE long-lived ECDH P-256 identity public key from
 *      the admin console. The private half never leaves that browser.
 *   2. When a visitor opens a conversation their browser mints a fresh ECDH
 *      key pair for that conversation and publishes only the public half.
 *   3. Both sides run ECDH against the other side's public key and stretch the
 *      shared secret with HKDF-SHA256 into an AES-GCM-256 message key.
 *      The two sides derive the exact same key without it ever being sent.
 *   4. Text is sealed into `zurs-e2ee.v1.<iv>.<ciphertext>` envelopes and
 *      images are uploaded as encrypted bytes, so storage, the database, logs
 *      and the Telegram bot only ever see opaque blobs.
 *
 * A short "safety number" (plus an emoji strip, because it reads faster on a
 * phone) is derived from both public keys so the visitor and the agent can
 * confirm nobody is sitting in the middle.
 */

export const E2EE_VERSION = "zurs-e2ee.v1";
export const E2EE_INFO = "zurs-support-chat-e2ee";
export const ENCRYPTED_MEDIA_CONTENT_TYPE = "application/octet-stream";

/** Shown wherever ciphertext would otherwise leak (Telegram, previews, logs). */
export const ENCRYPTED_PLACEHOLDER = "🔒 សារអ៊ិនគ្រីប";

export type KeyPairJwk = { publicJwk: JsonWebKey; privateJwk: JsonWebKey };

const CUSTOMER_KEY_PREFIX = "zurs:e2ee:chat:";
const ADMIN_IDENTITY_KEY = "zurs:e2ee:admin-identity";

/* ------------------------------------------------------------------ *
 * Capability check
 * ------------------------------------------------------------------ */

/** WebCrypto ECDH needs a secure context (https / localhost). */
export function e2eeSupported(): boolean {
  if (typeof window === "undefined") return false;
  const subtle = window.crypto?.subtle;
  if (!subtle || typeof subtle.deriveBits !== "function") return false;
  return window.isSecureContext !== false;
}

/* ------------------------------------------------------------------ *
 * base64 helpers
 * ------------------------------------------------------------------ */

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + chunk)));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function utf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

/** Copy bytes into a concrete ArrayBuffer for DOM and Node WebCrypto typings. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

/* ------------------------------------------------------------------ *
 * Keys
 * ------------------------------------------------------------------ */

export async function generateKeyPair(): Promise<KeyPairJwk> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicJwk, privateJwk };
}

/** Public JWKs travel as compact JSON; strip anything private or advisory. */
export function serializePublicKey(jwk: JsonWebKey): string {
  return JSON.stringify({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y });
}

export function parsePublicKey(value?: string | null): JsonWebKey | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as JsonWebKey;
    if (parsed?.kty !== "EC" || !parsed.x || !parsed.y) return null;
    return { kty: parsed.kty, crv: parsed.crv ?? "P-256", x: parsed.x, y: parsed.y, ext: true };
  } catch {
    return null;
  }
}

async function importPrivate(jwk: JsonWebKey) {
  return crypto.subtle.importKey("jwk", { ...jwk, key_ops: ["deriveBits"] }, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
}

async function importPublic(jwk: JsonWebKey) {
  const cleaned: JsonWebKey = { kty: jwk.kty, crv: jwk.crv ?? "P-256", x: jwk.x, y: jwk.y, ext: true };
  return crypto.subtle.importKey("jwk", cleaned, { name: "ECDH", namedCurve: "P-256" }, false, []);
}

/**
 * ECDH -> HKDF-SHA256 -> AES-GCM-256.
 * `salt` is the conversation reference, so two chats never share a key.
 */
export async function deriveSharedKey(privateJwk: JsonWebKey, peerPublicJwk: JsonWebKey, salt: string): Promise<CryptoKey> {
  const [privateKey, publicKey] = await Promise.all([importPrivate(privateJwk), importPublic(peerPublicJwk)]);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  try {
    const material = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
    return await crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: toArrayBuffer(utf8(salt)), info: toArrayBuffer(utf8(E2EE_INFO)) },
      material,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    // Older Safari builds ship ECDH without HKDF; SHA-256 over the shared
    // secret plus the salt is the documented fallback.
    const combined = new Uint8Array(bits.byteLength + utf8(salt).byteLength);
    combined.set(new Uint8Array(bits), 0);
    combined.set(utf8(salt), bits.byteLength);
    const digest = await crypto.subtle.digest("SHA-256", combined);
    return crypto.subtle.importKey("raw", digest, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
}

/* ------------------------------------------------------------------ *
 * Sealing / opening
 * ------------------------------------------------------------------ */

export function isEncryptedEnvelope(value?: string | null): boolean {
  return typeof value === "string" && value.startsWith(`${E2EE_VERSION}.`);
}

export async function encryptText(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(utf8(plaintext)));
  return `${E2EE_VERSION}.${toBase64(iv)}.${toBase64(new Uint8Array(sealed))}`;
}

export async function decryptText(key: CryptoKey, envelope: string): Promise<string> {
  const [version, ivPart, bodyPart] = envelope.split(".");
  if (version !== E2EE_VERSION || !ivPart || !bodyPart) throw new Error("envelope");
  const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(fromBase64(ivPart)) }, key, toArrayBuffer(fromBase64(bodyPart)));
  return new TextDecoder().decode(opened);
}

/** Sealed media = 12-byte IV followed by the AES-GCM ciphertext. */
export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<Uint8Array> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, data));
  const payload = new Uint8Array(iv.byteLength + sealed.byteLength);
  payload.set(iv, 0);
  payload.set(sealed, iv.byteLength);
  return payload;
}

export async function decryptBytes(key: CryptoKey, payload: ArrayBuffer): Promise<Uint8Array> {
  const bytes = new Uint8Array(payload);
  const iv = bytes.subarray(0, 12);
  const opened = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(bytes.subarray(12)));
  return new Uint8Array(opened);
}

/** Encrypted upload payload for `supportChat.sendAttachment`. */
export async function encryptImageToDataUrl(key: CryptoKey, data: ArrayBuffer): Promise<string> {
  const payload = await encryptBytes(key, data);
  return `data:${ENCRYPTED_MEDIA_CONTENT_TYPE};base64,${toBase64(payload)}`;
}

/** Downloads sealed media and hands back an object URL the <img> can use. */
export async function decryptMediaToObjectUrl(key: CryptoKey, url: string, mimeType = "image/jpeg"): Promise<string> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`media ${response.status}`);
  const opened = await decryptBytes(key, await response.arrayBuffer());
  return URL.createObjectURL(new Blob([toArrayBuffer(opened)], { type: mimeType }));
}

/* ------------------------------------------------------------------ *
 * Safety number
 * ------------------------------------------------------------------ */

const SAFETY_EMOJI = ["🐉", "🦊", "🐧", "🦁", "🐢", "🦉", "🐬", "🦋", "🌸", "🍀", "⚡", "🔥", "🌊", "⭐", "🎧", "🎮"];

/**
 * Same output on both screens when — and only when — the two browsers really
 * hold each other's keys.
 */
export async function safetyNumber(a: JsonWebKey, b: JsonWebKey): Promise<{ digits: string; emoji: string }> {
  const fingerprints = [serializePublicKey(a), serializePublicKey(b)].sort();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", toArrayBuffer(utf8(fingerprints.join("|")))));
  const digits: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const value = ((digest[index * 2] << 8) | digest[index * 2 + 1]) % 10000;
    digits.push(String(value).padStart(4, "0"));
  }
  const emoji = Array.from({ length: 5 }, (_unused, index) => SAFETY_EMOJI[digest[index + 8] % SAFETY_EMOJI.length]).join(" ");
  return { digits: digits.join(" "), emoji };
}

/* ------------------------------------------------------------------ *
 * Local key storage
 * ------------------------------------------------------------------ */

function readStoredPair(storageKey: string): KeyPairJwk | null {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KeyPairJwk;
    if (!parsed?.privateJwk?.d || !parsed?.publicJwk?.x) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredPair(storageKey: string, pair: KeyPairJwk) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(pair));
  } catch {
    /* private mode / quota — the chat still works for this tab */
  }
}

/** Per-conversation key pair for the visitor. */
export async function ensureChatKeyPair(chatReference: string): Promise<KeyPairJwk> {
  const storageKey = `${CUSTOMER_KEY_PREFIX}${chatReference}`;
  const existing = readStoredPair(storageKey);
  if (existing) return existing;
  const created = await generateKeyPair();
  writeStoredPair(storageKey, created);
  return created;
}

/** Long-lived identity key pair for a support agent's browser. */
export async function ensureAdminIdentityKeyPair(): Promise<KeyPairJwk> {
  const existing = readStoredPair(ADMIN_IDENTITY_KEY);
  if (existing) return existing;
  const created = await generateKeyPair();
  writeStoredPair(ADMIN_IDENTITY_KEY, created);
  return created;
}

export function forgetAdminIdentityKeyPair() {
  try {
    window.localStorage.removeItem(ADMIN_IDENTITY_KEY);
  } catch {
    /* ignore */
  }
}

/** Wipes the visitor's key once a conversation is closed for good. */
export function forgetChatKeyPair(chatReference: string) {
  try {
    window.localStorage.removeItem(`${CUSTOMER_KEY_PREFIX}${chatReference}`);
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ *
 * Key rings
 *
 * One stored pair is not enough in the field:
 *   - iOS in-app webviews and private windows silently drop localStorage
 *     writes, so a visitor can come back holding a brand new pair;
 *   - a console whose storage was cleared mints a new identity, leaving the
 *     published key without a matching private half.
 * Both sides therefore keep a small ring and try every pairing when opening a
 * message, so a re-key never orphans a conversation.
 * ------------------------------------------------------------------ */

const RING_LIMIT = 4;
const RING_SUFFIX = ":ring";

/** Pairs held for this tab even when storage refuses to persist them. */
const memoryRings = new Map<string, KeyPairJwk[]>();

function readStoredRing(storageKey: string): KeyPairJwk[] {
  const ring: KeyPairJwk[] = [];
  try {
    const raw = window.localStorage.getItem(`${storageKey}${RING_SUFFIX}`);
    const parsed = raw ? (JSON.parse(raw) as KeyPairJwk[]) : [];
    if (Array.isArray(parsed)) {
      for (const entry of parsed) {
        if (entry?.privateJwk?.d && entry?.publicJwk?.x) ring.push(entry);
      }
    }
  } catch {
    /* unreadable ring - fall back to the single stored pair */
  }
  const single = readStoredPair(storageKey);
  if (single && !ring.some((entry) => entry.publicJwk.x === single.publicJwk.x)) ring.unshift(single);
  return ring.slice(0, RING_LIMIT);
}

function writeStoredRing(storageKey: string, ring: KeyPairJwk[]) {
  try {
    window.localStorage.setItem(`${storageKey}${RING_SUFFIX}`, JSON.stringify(ring.slice(0, RING_LIMIT)));
  } catch {
    /* private mode / quota - the in-memory ring still serves this tab */
  }
}

/** Newest first: the pair to seal with, then older pairs for history. */
export async function ensureKeyRing(storageKey: string): Promise<KeyPairJwk[]> {
  const remembered = memoryRings.get(storageKey);
  if (remembered && remembered.length > 0) return remembered;
  const stored = readStoredRing(storageKey);
  if (stored.length > 0) {
    memoryRings.set(storageKey, stored);
    return stored;
  }
  const created = await generateKeyPair();
  writeStoredPair(storageKey, created);
  writeStoredRing(storageKey, [created]);
  const ring = [created];
  memoryRings.set(storageKey, ring);
  return ring;
}

export function ensureChatKeyRing(chatReference: string): Promise<KeyPairJwk[]> {
  return ensureKeyRing(`${CUSTOMER_KEY_PREFIX}${chatReference}`);
}

export function ensureAdminIdentityRing(): Promise<KeyPairJwk[]> {
  return ensureKeyRing(ADMIN_IDENTITY_KEY);
}

/**
 * One AES key per (my pair, peer key) pairing.
 * `saltFrom` says which side owns the HKDF salt: the visitor salts with its
 * own public key, the console salts with the visitor key it was handed, so
 * both ends land on the same bytes.
 */
export async function deriveKeyRing(
  pairs: KeyPairJwk[],
  peerKeys: Array<string | null | undefined>,
  saltFrom: "mine" | "peer",
): Promise<CryptoKey[]> {
  const keys: CryptoKey[] = [];
  for (const pair of pairs) {
    const mine = serializePublicKey(pair.publicJwk);
    for (const peerRaw of peerKeys) {
      if (!peerRaw) continue;
      const peer = parsePublicKey(peerRaw);
      if (!peer) continue;
      try {
        keys.push(await deriveSharedKey(pair.privateJwk, peer, saltFrom === "mine" ? mine : peerRaw));
      } catch {
        /* unusable pairing - keep going */
      }
    }
  }
  return keys;
}

/** Opens an envelope with the first key in the ring that fits. */
export async function decryptTextWithRing(keys: CryptoKey[], envelope: string): Promise<string> {
  for (const key of keys) {
    try {
      return await decryptText(key, envelope);
    } catch {
      /* try the next key */
    }
  }
  throw new Error("no-key");
}

/** Same idea for sealed media: fetch once, then try each key. */
export async function decryptMediaWithRing(keys: CryptoKey[], url: string, mimeType = "image/jpeg"): Promise<string> {
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error(`media ${response.status}`);
  const payload = await response.arrayBuffer();
  for (const key of keys) {
    try {
      const opened = await decryptBytes(key, payload);
      return URL.createObjectURL(new Blob([toArrayBuffer(opened)], { type: mimeType }));
    } catch {
      /* try the next key */
    }
  }
  throw new Error("no-key");
}
