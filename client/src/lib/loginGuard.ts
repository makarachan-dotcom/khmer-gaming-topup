/**
 * Browser half of the /login abuse guard.
 *
 * Responsibilities, in order of importance:
 *   1. carry a stable device id on every login request, so the server can bind
 *      an address to a device and cascade a block when either is locked;
 *   2. pre-charge a strike before each code check, so a client that crashes,
 *      navigates away, or is deliberately scripted still pays for the attempt;
 *   3. translate the server's 423 into something the page can render as a
 *      countdown rather than a generic error.
 *
 * The device id is a random opaque value, not a browser fingerprint: no canvas,
 * no font probing, nothing that follows the visitor around the rest of the web.
 * If it is cleared or blocked from storage the server falls back to a
 * header-derived bucket, so clearing it never *removes* a restriction.
 */

const DEVICE_STORAGE_KEY = "zurs.device.id";

export type LoginGuardState = {
  allowed: boolean;
  blocked: boolean;
  /** Seconds remaining on an active block. */
  retryAfter: number;
  strikes: number;
  remainingAttempts: number;
  threshold: number;
  message: string | null;
  /** True when the limiter is running on per-instance memory, not Redis. */
  durable: boolean;
};

const ALLOWED: LoginGuardState = {
  allowed: true,
  blocked: false,
  retryAfter: 0,
  strikes: 0,
  remainingAttempts: 5,
  threshold: 5,
  message: null,
  durable: true,
};

function randomId() {
  const bytes = new Uint8Array(20);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  let value = "";
  bytes.forEach((byte) => {
    value += byte.toString(16).padStart(2, "0");
  });
  return value;
}

/** Stable per-browser id. Survives reloads; regenerated if storage is wiped. */
export function getDeviceId() {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && /^[A-Za-z0-9_-]{16,128}$/.test(existing)) return existing;
    const created = randomId();
    window.localStorage.setItem(DEVICE_STORAGE_KEY, created);
    return created;
  } catch {
    // Private mode or storage disabled: the server's header fallback takes over.
    return "";
  }
}

/* --------------------------------------------------------- device identity */

type UaDataValues = { model?: string; platform?: string; platformVersion?: string };
type UaData = { platform?: string; getHighEntropyValues?: (hints: string[]) => Promise<UaDataValues> };

let deviceHints: UaDataValues = {};
let hintsPromise: Promise<void> | null = null;

/**
 * Asks the browser for its device model.
 *
 * A modern Chromium User-Agent is frozen — on Android it reports "Android 10; K"
 * no matter the handset — so Client Hints are the only way the admin ban table
 * can show a real model. This is the model only: no canvas, no fonts, nothing
 * that would identify the visitor across other websites.
 */
export function primeDeviceHints(): Promise<void> {
  if (hintsPromise) return hintsPromise;
  if (typeof navigator === "undefined") {
    hintsPromise = Promise.resolve();
    return hintsPromise;
  }
  const uaData = (navigator as Navigator & { userAgentData?: UaData }).userAgentData;
  if (!uaData?.getHighEntropyValues) {
    // Safari and Firefox: the legacy UA string still carries what we need.
    hintsPromise = Promise.resolve();
    return hintsPromise;
  }
  hintsPromise = uaData
    .getHighEntropyValues(["model", "platformVersion"])
    .then((values) => {
      deviceHints = { model: values.model, platform: values.platform ?? uaData.platform, platformVersion: values.platformVersion };
    })
    .catch(() => {
      // Hints are a nicety, never a requirement.
    });
  return hintsPromise;
}

/** Header values must be latin-1; a stray character would make fetch throw. */
function headerSafe(value: string | undefined, max: number) {
  if (!value) return "";
  return value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, max);
}

export function deviceHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", "X-Zurs-Device": getDeviceId() };
  const model = headerSafe(deviceHints.model, 48);
  const platform = headerSafe(deviceHints.platform, 24);
  const platformVersion = headerSafe(deviceHints.platformVersion, 24);
  if (model) headers["X-Zurs-Model"] = model;
  if (platform) headers["X-Zurs-Platform"] = platform;
  if (platformVersion) headers["X-Zurs-Platform-Version"] = platformVersion;
  return headers;
}

function parseState(payload: unknown, fallback: LoginGuardState): LoginGuardState {
  if (!payload || typeof payload !== "object") return fallback;
  const value = payload as Partial<LoginGuardState>;
  return {
    allowed: value.allowed !== false && value.blocked !== true,
    blocked: value.blocked === true || value.allowed === false,
    retryAfter: typeof value.retryAfter === "number" && Number.isFinite(value.retryAfter) ? Math.max(0, Math.round(value.retryAfter)) : fallback.retryAfter,
    strikes: typeof value.strikes === "number" ? value.strikes : fallback.strikes,
    remainingAttempts: typeof value.remainingAttempts === "number" ? value.remainingAttempts : fallback.remainingAttempts,
    threshold: typeof value.threshold === "number" ? value.threshold : fallback.threshold,
    message: typeof value.message === "string" ? value.message : fallback.message,
    durable: value.durable !== false,
  };
}

export class LoginBlockedError extends Error {
  readonly state: LoginGuardState;

  constructor(state: LoginGuardState) {
    super(state.message ?? "login blocked");
    this.name = "LoginBlockedError";
    this.state = state;
  }
}

export class LoginRateLimitedError extends Error {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super("login rate limited");
    this.name = "LoginRateLimitedError";
    this.retryAfter = retryAfter;
  }
}

async function callGuard(path: string, body: Record<string, unknown>) {
  await primeDeviceHints();
  const response = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: deviceHeaders(),
    body: JSON.stringify({ ...body, deviceId: getDeviceId() }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 423) throw new LoginBlockedError(parseState(payload, { ...ALLOWED, allowed: false, blocked: true, retryAfter: 86_400 }));
  if (response.status === 429) {
    const retryAfter = Number((payload as { retryAfter?: unknown })?.retryAfter ?? response.headers.get("retry-after") ?? 60);
    throw new LoginRateLimitedError(Number.isFinite(retryAfter) ? Math.max(1, Math.round(retryAfter)) : 60);
  }
  if (response.status === 400) throw new Error("អ៊ីមែលមិនត្រឹមត្រូវ — សូមពិនិត្យម្តងទៀត។");
  // A 5xx must not lock a real customer out of their account: the server-side
  // guard still runs on the session exchange, which is the enforcing endpoint.
  if (!response.ok) return ALLOWED;
  return parseState(payload, ALLOWED);
}

/** Page-load / pre-send probe. */
export function checkLoginGuard(intent: "request" | "verify", email?: string | null) {
  return callGuard("/api/auth/login/guard", { intent, email: email ?? null });
}

/** Must be awaited before asking Appwrite to send a code. */
export function guardCodeRequest(email: string) {
  return callGuard("/api/auth/login/request-code", { email });
}

/** Pre-charges one strike and returns the claim used to refund it. */
export async function openVerifyAttempt(email: string) {
  await primeDeviceHints();
  const response = await fetch("/api/auth/login/verify-attempt", {
    method: "POST",
    credentials: "include",
    headers: deviceHeaders(),
    body: JSON.stringify({ email, deviceId: getDeviceId() }),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.status === 423) throw new LoginBlockedError(parseState(payload, { ...ALLOWED, allowed: false, blocked: true, retryAfter: 86_400 }));
  if (response.status === 429) {
    const retryAfter = Number((payload as { retryAfter?: unknown })?.retryAfter ?? 60);
    throw new LoginRateLimitedError(Number.isFinite(retryAfter) ? Math.max(1, Math.round(retryAfter)) : 60);
  }
  const claimId = typeof (payload as { claimId?: unknown })?.claimId === "string" ? (payload as { claimId: string }).claimId : null;
  return { claimId, state: response.ok ? parseState(payload, ALLOWED) : ALLOWED };
}

/**
 * Settles a pre-charged attempt. Never throws — reporting the outcome is a
 * best-effort courtesy to the honest client, and a failure here must not turn a
 * successful sign-in into an error.
 */
export async function closeVerifyAttempt(claimId: string | null, outcome: "success" | "failure", email: string) {
  try {
    return await callGuard("/api/auth/login/verify-result", { claimId, outcome, email });
  } catch (reason) {
    if (reason instanceof LoginBlockedError) return reason.state;
    return null;
  }
}

/**
 * Non-throwing ban probe for pages outside /login.
 *
 * The account page uses this to remove its sign-in buttons entirely while a
 * ban is active. That is presentation only — the button being gone is not the
 * protection. The protection is that `enforceIpBan` refuses the OAuth start
 * endpoint and the session exchange for the same actor, so pasting the URL by
 * hand gets the same 423.
 */
export async function checkAccessBan(): Promise<LoginGuardState> {
  try {
    return await checkLoginGuard("request");
  } catch (reason) {
    if (reason instanceof LoginBlockedError) return reason.state;
    // Never strand a real customer on a network hiccup: default to allowed and
    // let the server-side gate be the authority.
    return ALLOWED;
  }
}

/** `86400` → `24 ម៉ោង`. Used by the lockout countdown. */
export function formatCountdownKh(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const rest = safe % 60;
  if (hours > 0) return `${hours} ម៉ោង ${String(minutes).padStart(2, "0")} នាទី`;
  if (minutes > 0) return `${minutes} នាទី ${String(rest).padStart(2, "0")} វិនាទី`;
  return `${rest} វិនាទី`;
}
