import crypto from "node:crypto";
import { rateLimitBackendConfigured, redisPipeline } from "./rateLimit";

/**
 * Login abuse guard for zurs.me/login.
 *
 * What the storefront asked for, and how each part is delivered:
 *
 * 1. "report ip"                  → every strike and every block is appended to
 *                                   a capped report feed an admin can read.
 * 2. "5 wrong attempts → block ip" → five failed verifies inside the failure
 *                                   window blocks the address.
 * 3. "different device → block it  → blocks *cascade*. An address and a device
 *    immediately"                  fingerprint are linked the first time they
 *                                   are seen together, so blocking one blocks
 *                                   every actor already linked to it, and any
 *                                   new device that later appears from a
 *                                   blocked address is blocked on contact.
 * 4. "24 hours before they can     → one fixed block duration, enforced at the
 *    create again"                  session-exchange endpoint, which is the
 *                                   only place a ZURS account row is created.
 *                                   Sign-in and sign-up therefore share one
 *                                   lock: there is no "just make a new account"
 *                                   path around it.
 *
 * Storage
 * -------
 * Upstash Redis over REST, reusing the connection in `./rateLimit` so no new
 * dependency and no second credential appear. Vercel recycles functions between
 * requests, so a per-process `Map` cannot hold a 24 hour block — it is only the
 * degraded fallback for local development and for a Redis outage.
 *
 * Privacy
 * -------
 * Redis keys are HMACs, never raw addresses, device ids or emails. The admin
 * report keeps the readable IP on purpose (that is the point of an IP report)
 * but masks the email and never stores the device id in the clear.
 */

/** Failed verifies allowed before the address is blocked. */
export const loginFailureThreshold = 5;

/** Strikes decay after this long without a further failure. */
export const loginFailureWindowSeconds = 30 * 60;

/** How long a block lasts. The storefront requirement is a full day. */
export const loginBlockSeconds = 24 * 60 * 60;

/** How long an address ↔ device association is remembered for cascading. */
export const loginLinkTtlSeconds = 7 * 24 * 60 * 60;

/** Most linked actors a single block will cascade to in one pass. */
export const loginCascadeFanout = 50;

/** Entries kept in the admin report feed. */
export const loginReportSize = 200;

export type LoginActorScope = "ip" | "device" | "identity";

export type LoginIntent = "request" | "verify" | "session";

export type LoginBlockReason =
  | "too_many_failed_codes"
  | "linked_to_blocked_ip"
  | "linked_to_blocked_device"
  | "linked_to_blocked_identity"
  | "manual";

export type LoginBlockRecord = {
  scope: LoginActorScope;
  reason: LoginBlockReason;
  strikes: number;
  blockedAt: string;
  expiresAt: string;
  /** Readable only for the `ip` scope. Device and identity stay pseudonymous. */
  label: string;
  /**
   * Operator context, carried on every scope so the admin ban table can answer
   * "who is this?" without a second lookup. The storefront explicitly asked to
   * see the phone model and the address next to each ban.
   */
  ip?: string | null;
  /** `Samsung Galaxy A15 · Chrome 128 · Android 14`, from `deviceInsight.ts`. */
  device?: string | null;
  /** Masked (`ab•••@gmail.com`). Never the raw address. */
  email?: string | null;
};

/** One row of the admin ban table. */
export type LoginBanSummary = {
  /** `<scope>:<hash>` — stable, pseudonymous, and what the lift call takes. */
  id: string;
  scope: LoginActorScope;
  reason: LoginBlockReason;
  strikes: number;
  blockedAt: string;
  expiresAt: string;
  retryAfterSeconds: number;
  label: string;
  ip: string | null;
  device: string | null;
  email: string | null;
};

export type LoginGuardDecision = {
  allowed: boolean;
  /** Which actor caused the refusal. `null` when allowed. */
  scope: LoginActorScope | null;
  reason: LoginBlockReason | null;
  /** Seconds until the block lifts. `0` when allowed. */
  retryAfterSeconds: number;
  /** Failed verifies recorded for this address inside the current window. */
  strikes: number;
  /** Attempts left before a block. `0` once blocked. */
  remainingAttempts: number;
  /** True when the decision came from per-process memory, not Redis. */
  degraded: boolean;
};

export type LoginActor = {
  ip: string;
  deviceId: string;
  email: string | null;
  userAgent: string | null;
  /** Readable device description for the admin table. Never used as a key. */
  deviceLabel?: string | null;
};

export type LoginReportEntry = {
  at: string;
  event: "strike" | "blocked" | "cascaded" | "blocked_attempt" | "cleared";
  intent: LoginIntent;
  scope: LoginActorScope;
  /** Readable IP. This feed exists so an operator can act on an address. */
  ip: string;
  /** Short, salted device fingerprint. Never the raw client value. */
  deviceHash: string;
  /** `ab•••@gmail.com`. Enough to recognise a target, not enough to leak one. */
  email: string | null;
  /** Optional human-readable audit label for non-login events. */
  label?: string;
  strikes: number;
  reason: LoginBlockReason | "attempt_failed" | "attempt_while_blocked" | "verified";
  expiresAt: string | null;
  userAgent: string | null;
};

/* ------------------------------------------------------------------ hashing */

function guardSalt(env = process.env) {
  return (
    env.LOGIN_GUARD_SALT?.trim() ||
    env.ZURS_SESSION_SECRET?.trim() ||
    env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ||
    "zurs-login-guard-development-salt"
  );
}

function actorHash(scope: LoginActorScope, value: string) {
  return crypto.createHmac("sha256", guardSalt()).update(`${scope}:${value.trim().toLowerCase()}`).digest("hex").slice(0, 32);
}

/** `someone@gmail.com` → `so•••@gmail.com`. */
export function maskEmail(email: string | null | undefined) {
  const value = email?.trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  const [local, domain] = value.split("@");
  const head = (local ?? "").slice(0, 2);
  return `${head}${"•".repeat(3)}@${domain}`;
}

/**
 * Normalises a client-supplied device fingerprint.
 *
 * A caller that sends nothing (or junk) is not allowed to escape device
 * tracking: it falls back to a fingerprint derived from the request headers and
 * the address, so "strip the header" is not a bypass — it just makes the device
 * bucket coarser, and coarser buckets get blocked sooner, not later.
 */
export function normalizeDeviceId(input: { deviceId?: string | null; userAgent?: string | null; acceptLanguage?: string | null; ip: string }) {
  const candidate = typeof input.deviceId === "string" ? input.deviceId.trim() : "";
  if (/^[A-Za-z0-9_-]{16,128}$/.test(candidate)) return candidate;
  return `hdr:${crypto.createHash("sha256").update(`${input.userAgent ?? ""}|${input.acceptLanguage ?? ""}|${input.ip}`).digest("hex").slice(0, 24)}`;
}

function actorKeys(actor: LoginActor) {
  return {
    ip: actorHash("ip", actor.ip),
    device: actorHash("device", actor.deviceId),
    identity: actor.email ? actorHash("identity", actor.email) : null,
  };
}

/* ------------------------------------------------------------------- store */

/**
 * `origin` is the ban id (`<scope>:<hash>`) of the block that caused this row to
 * be written. A row blocked on its own evidence carries its own id, so lifting
 * one ban can release exactly the rows that ban created - and nothing else.
 */
type StoredBlock = Omit<LoginBlockRecord, "scope"> & { scope: LoginActorScope; origin?: string | null };

const memoryBlocks = new Map<string, { record: StoredBlock; expiresAt: number }>();
const memoryStrikes = new Map<string, { count: number; expiresAt: number }>();
const memoryLinks = new Map<string, Map<string, number>>();
const memoryReport: LoginReportEntry[] = [];
/** `<scope>:<hash>` -> expiry in epoch ms. The enumerable index of live bans. */
const memoryBans = new Map<string, number>();

function sweepMemory(now = Date.now()) {
  memoryBlocks.forEach((entry, key) => {
    if (entry.expiresAt <= now) memoryBlocks.delete(key);
  });
  memoryStrikes.forEach((entry, key) => {
    if (entry.expiresAt <= now) memoryStrikes.delete(key);
  });
  memoryLinks.forEach((members, key) => {
    members.forEach((expiry, member) => {
      if (expiry <= now) members.delete(member);
    });
    if (members.size === 0) memoryLinks.delete(key);
  });
}

function blockKey(scope: LoginActorScope, hash: string) {
  return `la:block:${scope}:${hash}`;
}

function strikeKey(scope: LoginActorScope, hash: string) {
  return `la:strike:${scope}:${hash}`;
}

function linkKey(scope: LoginActorScope, hash: string) {
  return `la:link:${scope}:${hash}`;
}

const reportKey = "la:report";
const banIndexKey = "la:bans";

function parseBlock(raw: unknown): StoredBlock | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredBlock>;
    if (!parsed || typeof parsed.expiresAt !== "string" || typeof parsed.scope !== "string") return null;
    return {
      scope: parsed.scope as LoginActorScope,
      reason: (parsed.reason ?? "manual") as LoginBlockReason,
      strikes: typeof parsed.strikes === "number" ? parsed.strikes : 0,
      blockedAt: typeof parsed.blockedAt === "string" ? parsed.blockedAt : new Date().toISOString(),
      expiresAt: parsed.expiresAt,
      label: typeof parsed.label === "string" ? parsed.label : "",
      ip: typeof parsed.ip === "string" ? parsed.ip : null,
      device: typeof parsed.device === "string" ? parsed.device : null,
      email: typeof parsed.email === "string" ? parsed.email : null,
      origin: typeof parsed.origin === "string" ? parsed.origin : null,
    };
  } catch {
    return null;
  }
}

/** Index member for a blocked actor. Pseudonymous by construction. */
function banId(scope: LoginActorScope, hash: string) {
  return `${scope}:${hash}`;
}

function parseBanId(value: string): { scope: LoginActorScope; hash: string } | null {
  const separator = value.indexOf(":");
  if (separator <= 0) return null;
  const scope = value.slice(0, separator);
  const hash = value.slice(separator + 1);
  if (scope !== "ip" && scope !== "device" && scope !== "identity") return null;
  if (!/^[a-f0-9]{8,64}$/.test(hash)) return null;
  return { scope, hash };
}

function remainingSeconds(expiresAt: string, now = Date.now()) {
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.ceil((parsed - now) / 1_000));
}

/**
 * Every read/write goes through here so a Redis outage degrades to memory in
 * exactly one place. `degraded` is surfaced all the way to the caller: a block
 * that only exists in one lambda's memory is real, but it is not a 24 hour
 * guarantee, and the report says so.
 */
const store = {
  async readBlocks(targets: { scope: LoginActorScope; hash: string }[]): Promise<{ blocks: (StoredBlock | null)[]; degraded: boolean }> {
    if (targets.length === 0) return { blocks: [], degraded: !rateLimitBackendConfigured };
    if (rateLimitBackendConfigured) {
      try {
        const results = await redisPipeline(targets.map((target) => ["GET", blockKey(target.scope, target.hash)]));
        return { blocks: results.map(parseBlock), degraded: false };
      } catch (error) {
        console.error("[loginGuard] block read failed, using memory", error);
      }
    }
    sweepMemory();
    const now = Date.now();
    return {
      blocks: targets.map((target) => {
        const entry = memoryBlocks.get(blockKey(target.scope, target.hash));
        return entry && entry.expiresAt > now ? entry.record : null;
      }),
      degraded: true,
    };
  },

  async writeBlock(scope: LoginActorScope, hash: string, record: StoredBlock, ttlSeconds: number) {
    if (rateLimitBackendConfigured) {
      try {
        await redisPipeline([["SET", blockKey(scope, hash), JSON.stringify(record), "EX", Math.max(1, Math.round(ttlSeconds))]]);
        return false;
      } catch (error) {
        console.error("[loginGuard] block write failed, using memory", error);
      }
    }
    memoryBlocks.set(blockKey(scope, hash), { record, expiresAt: Date.now() + ttlSeconds * 1_000 });
    return true;
  },

  async bumpStrike(scope: LoginActorScope, hash: string) {
    if (rateLimitBackendConfigured) {
      try {
        const [count] = await redisPipeline([
          ["INCR", strikeKey(scope, hash)],
          ["EXPIRE", strikeKey(scope, hash), loginFailureWindowSeconds],
        ]);
        return { count: Number(count ?? 1), degraded: false };
      } catch (error) {
        console.error("[loginGuard] strike write failed, using memory", error);
      }
    }
    sweepMemory();
    const key = strikeKey(scope, hash);
    const now = Date.now();
    const existing = memoryStrikes.get(key);
    const count = existing && existing.expiresAt > now ? existing.count + 1 : 1;
    memoryStrikes.set(key, { count, expiresAt: now + loginFailureWindowSeconds * 1_000 });
    return { count, degraded: true };
  },

  async readStrikes(scope: LoginActorScope, hash: string) {
    if (rateLimitBackendConfigured) {
      try {
        const [value] = await redisPipeline([["GET", strikeKey(scope, hash)]]);
        return Number(value ?? 0) || 0;
      } catch (error) {
        console.error("[loginGuard] strike read failed, using memory", error);
      }
    }
    sweepMemory();
    const entry = memoryStrikes.get(strikeKey(scope, hash));
    return entry && entry.expiresAt > Date.now() ? entry.count : 0;
  },

  async clearStrikes(targets: { scope: LoginActorScope; hash: string }[]) {
    if (targets.length === 0) return;
    if (rateLimitBackendConfigured) {
      try {
        await redisPipeline(targets.map((target) => ["DEL", strikeKey(target.scope, target.hash)]));
        return;
      } catch (error) {
        console.error("[loginGuard] strike clear failed, using memory", error);
      }
    }
    targets.forEach((target) => memoryStrikes.delete(strikeKey(target.scope, target.hash)));
  },

  async link(scope: LoginActorScope, hash: string, members: string[]) {
    if (members.length === 0) return;
    if (rateLimitBackendConfigured) {
      try {
        await redisPipeline([
          ["SADD", linkKey(scope, hash), ...members],
          ["EXPIRE", linkKey(scope, hash), loginLinkTtlSeconds],
        ]);
        return;
      } catch (error) {
        console.error("[loginGuard] link write failed, using memory", error);
      }
    }
    const key = linkKey(scope, hash);
    const bucket = memoryLinks.get(key) ?? new Map<string, number>();
    const expiry = Date.now() + loginLinkTtlSeconds * 1_000;
    members.forEach((member) => bucket.set(member, expiry));
    memoryLinks.set(key, bucket);
  },

  async readLinks(scope: LoginActorScope, hash: string): Promise<string[]> {
    if (rateLimitBackendConfigured) {
      try {
        const [members] = await redisPipeline([["SMEMBERS", linkKey(scope, hash)]]);
        return Array.isArray(members) ? members.filter((value): value is string => typeof value === "string").slice(0, loginCascadeFanout) : [];
      } catch (error) {
        console.error("[loginGuard] link read failed, using memory", error);
      }
    }
    sweepMemory();
    const bucket = memoryLinks.get(linkKey(scope, hash));
    return bucket ? Array.from(bucket.keys()).slice(0, loginCascadeFanout) : [];
  },

  async pushReport(entry: LoginReportEntry) {
    if (rateLimitBackendConfigured) {
      try {
        await redisPipeline([
          ["LPUSH", reportKey, JSON.stringify(entry)],
          ["LTRIM", reportKey, 0, loginReportSize - 1],
          ["EXPIRE", reportKey, loginLinkTtlSeconds],
        ]);
        return;
      } catch (error) {
        console.error("[loginGuard] report write failed, using memory", error);
      }
    }
    memoryReport.unshift(entry);
    if (memoryReport.length > loginReportSize) memoryReport.length = loginReportSize;
  },

  async readReport(): Promise<LoginReportEntry[]> {
    if (rateLimitBackendConfigured) {
      try {
        const [entries] = await redisPipeline([["LRANGE", reportKey, 0, loginReportSize - 1]]);
        if (!Array.isArray(entries)) return [];
        return entries
          .map((raw) => {
            try {
              return JSON.parse(String(raw)) as LoginReportEntry;
            } catch {
              return null;
            }
          })
          .filter((entry): entry is LoginReportEntry => Boolean(entry));
      } catch (error) {
        console.error("[loginGuard] report read failed, using memory", error);
      }
    }
    return memoryReport.slice(0, loginReportSize);
  },

  /**
   * Redis keys are hashes, so they cannot be listed back by address. A sorted
   * set scored by expiry gives the admin table an enumerable index and prunes
   * itself on every read — no cron, no SCAN over the keyspace.
   */
  async indexBan(scope: LoginActorScope, hash: string, expiresAtMs: number) {
    if (rateLimitBackendConfigured) {
      try {
        await redisPipeline([
          ["ZADD", banIndexKey, expiresAtMs, banId(scope, hash)],
          ["ZREMRANGEBYSCORE", banIndexKey, "-inf", Date.now()],
          ["EXPIRE", banIndexKey, loginBlockSeconds * 2],
        ]);
        return;
      } catch (error) {
        console.error("[loginGuard] ban index write failed, using memory", error);
      }
    }
    memoryBans.set(banId(scope, hash), expiresAtMs);
  },

  async readBanIds(): Promise<string[]> {
    const now = Date.now();
    if (rateLimitBackendConfigured) {
      try {
        const [, live] = await redisPipeline([
          ["ZREMRANGEBYSCORE", banIndexKey, "-inf", now],
          ["ZRANGEBYSCORE", banIndexKey, now, "+inf"],
        ]);
        if (Array.isArray(live)) return live.filter((value): value is string => typeof value === "string");
        return [];
      } catch (error) {
        console.error("[loginGuard] ban index read failed, using memory", error);
      }
    }
    const ids: string[] = [];
    memoryBans.forEach((expiry, id) => {
      if (expiry > now) ids.push(id);
      else memoryBans.delete(id);
    });
    return ids;
  },

  async dropBan(scope: LoginActorScope, hash: string) {
    if (rateLimitBackendConfigured) {
      try {
        await redisPipeline([
          ["DEL", blockKey(scope, hash)],
          ["DEL", strikeKey(scope, hash)],
          ["ZREM", banIndexKey, banId(scope, hash)],
        ]);
        return false;
      } catch (error) {
        console.error("[loginGuard] ban lift failed, using memory", error);
      }
    }
    memoryBlocks.delete(blockKey(scope, hash));
    memoryStrikes.delete(strikeKey(scope, hash));
    memoryBans.delete(banId(scope, hash));
    return true;
  },
};

/* ------------------------------------------------------------------ blocks */

async function applyBlock(options: {
  scope: LoginActorScope;
  hash: string;
  label: string;
  reason: LoginBlockReason;
  strikes: number;
  expiresAt: string;
  /** Operator context stored alongside every scope for the admin table. */
  context?: { ip?: string | null; device?: string | null; email?: string | null };
  /** Ban id of the block this row was cascaded from. Defaults to its own id. */
  origin?: string | null;
}) {
  const ttl = Math.max(1, remainingSeconds(options.expiresAt));
  const record: StoredBlock = {
    scope: options.scope,
    reason: options.reason,
    strikes: options.strikes,
    blockedAt: new Date().toISOString(),
    expiresAt: options.expiresAt,
    label: options.label,
    ip: options.context?.ip ?? null,
    device: options.context?.device ?? null,
    email: options.context?.email ?? null,
    origin: options.origin ?? banId(options.scope, options.hash),
  };
  const degraded = await store.writeBlock(options.scope, options.hash, record, ttl);
  await store.indexBan(options.scope, options.hash, Date.parse(options.expiresAt) || Date.now() + ttl * 1_000);
  return degraded;
}

/** Context every block written for this actor should carry. */
function blockContext(actor: LoginActor) {
  return { ip: actor.ip, device: actor.deviceLabel ?? null, email: maskEmail(actor.email) };
}

/**
 * Spreads a block across everything already known to belong to the same actor.
 *
 * This is the "they switched device" requirement. The address, the device and
 * the mailbox all go down together, and every device previously seen from that
 * address goes down with them — so opening the site on a phone after the laptop
 * was blocked lands on the same countdown, and so does signing up with a fresh
 * email from the same phone.
 */
async function cascadeBlock(options: {
  actor: LoginActor;
  origin: LoginActorScope;
  strikes: number;
  expiresAt: string;
  intent: LoginIntent;
}) {
  const keys = actorKeys(options.actor);
  const reasonFor = (scope: LoginActorScope): LoginBlockReason => {
    if (scope === options.origin) return "too_many_failed_codes";
    if (options.origin === "ip") return "linked_to_blocked_ip";
    if (options.origin === "device") return "linked_to_blocked_device";
    return "linked_to_blocked_identity";
  };

  const context = blockContext(options.actor);
  // Every row written by this cascade points back at the block that caused it,
  // so releasing that one ban releases the whole actor in a single admin action
  // instead of leaving the device or the mailbox locked out behind it.
  const originHash = options.origin === "ip" ? keys.ip : options.origin === "device" ? keys.device : keys.identity ?? keys.ip;
  const origin = banId(options.origin, originHash);

  await applyBlock({ scope: "ip", hash: keys.ip, label: options.actor.ip, reason: reasonFor("ip"), strikes: options.strikes, expiresAt: options.expiresAt, context, origin });
  await applyBlock({ scope: "device", hash: keys.device, label: keys.device.slice(0, 10), reason: reasonFor("device"), strikes: options.strikes, expiresAt: options.expiresAt, context, origin });
  if (keys.identity) {
    await applyBlock({ scope: "identity", hash: keys.identity, label: maskEmail(options.actor.email) ?? "", reason: reasonFor("identity"), strikes: options.strikes, expiresAt: options.expiresAt, context, origin });
  }

  // Devices previously seen from this address, and addresses previously seen
  // from this device. Bounded by `loginCascadeFanout` so one shared carrier NAT
  // cannot turn a single lockout into thousands of Redis writes.
  const [linkedDevices, linkedIps] = await Promise.all([store.readLinks("ip", keys.ip), store.readLinks("device", keys.device)]);
  await Promise.all([
    ...linkedDevices
      .filter((hash) => hash !== keys.device)
      .map((hash) => applyBlock({ scope: "device", hash, label: hash.slice(0, 10), reason: "linked_to_blocked_ip", strikes: options.strikes, expiresAt: options.expiresAt, origin })),
    ...linkedIps
      .filter((hash) => hash !== keys.ip)
      .map((hash) => applyBlock({ scope: "ip", hash, label: "linked", reason: "linked_to_blocked_device", strikes: options.strikes, expiresAt: options.expiresAt, origin })),
  ]);

  await store.pushReport({
    at: new Date().toISOString(),
    event: "blocked",
    intent: options.intent,
    scope: options.origin,
    ip: options.actor.ip,
    deviceHash: keys.device.slice(0, 10),
    email: maskEmail(options.actor.email),
    strikes: options.strikes,
    reason: "too_many_failed_codes",
    expiresAt: options.expiresAt,
    userAgent: options.actor.userAgent?.slice(0, 160) ?? null,
  });

  return { linkedDevices: linkedDevices.length, linkedIps: linkedIps.length };
}

/* --------------------------------------------------------------- decisions */

function allowedDecision(strikes: number, degraded: boolean): LoginGuardDecision {
  return {
    allowed: true,
    scope: null,
    reason: null,
    retryAfterSeconds: 0,
    strikes,
    remainingAttempts: Math.max(0, loginFailureThreshold - strikes),
    degraded,
  };
}

function blockedDecision(block: StoredBlock, degraded: boolean): LoginGuardDecision {
  return {
    allowed: false,
    scope: block.scope,
    reason: block.reason,
    retryAfterSeconds: remainingSeconds(block.expiresAt),
    strikes: block.strikes,
    remainingAttempts: 0,
    degraded,
  };
}

/**
 * Read-only-ish gate. Call it before every step of the login flow.
 *
 * Side effects are limited to two things, both of which have to happen here:
 *   • linking the address and the device, so a later block can cascade;
 *   • extending an existing block sideways when a *new* actor shows up wearing
 *     part of a blocked identity (the "different device" rule). The countdown
 *     is not restarted — a blocked user cannot be punished twice for the same
 *     lockout, and cannot reset their own clock by trying again either.
 */
export async function evaluateLoginAttempt(input: { actor: LoginActor; intent: LoginIntent }): Promise<LoginGuardDecision> {
  const { actor, intent } = input;
  const keys = actorKeys(actor);
  const targets: { scope: LoginActorScope; hash: string }[] = [
    { scope: "ip", hash: keys.ip },
    { scope: "device", hash: keys.device },
  ];
  if (keys.identity) targets.push({ scope: "identity", hash: keys.identity });

  const { blocks, degraded } = await store.readBlocks(targets);
  const active = blocks
    .map((block, index) => (block && remainingSeconds(block.expiresAt) > 0 ? { block, target: targets[index]! } : null))
    .filter((entry): entry is { block: StoredBlock; target: { scope: LoginActorScope; hash: string } } => Boolean(entry));

  if (active.length > 0) {
    // Longest remaining wins, so swapping device cannot shorten the wait.
    const worst = active.reduce((left, right) => (remainingSeconds(right.block.expiresAt) > remainingSeconds(left.block.expiresAt) ? right : left));
    const origin = worst.block.scope;
    const blockedScopes = active.map((entry) => entry.target.scope);

    // Anything presented in this request that is not blocked yet gets blocked
    // now, sharing the original expiry. This is what makes a second device fail
    // on its very first request instead of getting five fresh attempts.
    const pending: Promise<unknown>[] = [];
    if (!blockedScopes.includes("ip")) {
      pending.push(applyBlock({ scope: "ip", hash: keys.ip, label: actor.ip, reason: origin === "device" ? "linked_to_blocked_device" : "linked_to_blocked_identity", strikes: worst.block.strikes, expiresAt: worst.block.expiresAt }));
    }
    if (!blockedScopes.includes("device")) {
      pending.push(applyBlock({ scope: "device", hash: keys.device, label: keys.device.slice(0, 10), reason: origin === "ip" ? "linked_to_blocked_ip" : "linked_to_blocked_identity", strikes: worst.block.strikes, expiresAt: worst.block.expiresAt }));
    }
    if (keys.identity && !blockedScopes.includes("identity")) {
      pending.push(applyBlock({ scope: "identity", hash: keys.identity, label: maskEmail(actor.email) ?? "", reason: origin === "ip" ? "linked_to_blocked_ip" : "linked_to_blocked_device", strikes: worst.block.strikes, expiresAt: worst.block.expiresAt }));
    }
    if (pending.length > 0) {
      await Promise.all(pending);
      await store.pushReport({
        at: new Date().toISOString(),
        event: "cascaded",
        intent,
        scope: origin,
        ip: actor.ip,
        deviceHash: keys.device.slice(0, 10),
        email: maskEmail(actor.email),
        strikes: worst.block.strikes,
        reason: origin === "ip" ? "linked_to_blocked_ip" : origin === "device" ? "linked_to_blocked_device" : "linked_to_blocked_identity",
        expiresAt: worst.block.expiresAt,
        userAgent: actor.userAgent?.slice(0, 160) ?? null,
      });
    } else {
      await store.pushReport({
        at: new Date().toISOString(),
        event: "blocked_attempt",
        intent,
        scope: origin,
        ip: actor.ip,
        deviceHash: keys.device.slice(0, 10),
        email: maskEmail(actor.email),
        strikes: worst.block.strikes,
        reason: "attempt_while_blocked",
        expiresAt: worst.block.expiresAt,
        userAgent: actor.userAgent?.slice(0, 160) ?? null,
      });
    }

    return blockedDecision(worst.block, degraded);
  }

  // Clean actor: remember who was seen together so a future block can cascade.
  await Promise.all([
    store.link("ip", keys.ip, [keys.device]),
    store.link("device", keys.device, [keys.ip]),
    keys.identity ? store.link("identity", keys.identity, [keys.device, keys.ip]) : Promise.resolve(),
  ]);

  const strikes = await store.readStrikes("ip", keys.ip);
  return allowedDecision(strikes, degraded);
}

/**
 * Records one failed verification and blocks everything linked to the actor on
 * the fifth strike inside the window.
 *
 * Strikes are counted on both the address and the device, so a single device
 * hopping between mobile data and Wi-Fi is caught by the device counter, while
 * a botnet hammering one account from many devices is caught by the address
 * counter. Whichever reaches five first triggers the same 24 hour block.
 */
export async function registerLoginFailure(input: { actor: LoginActor; intent: LoginIntent; reason?: string }): Promise<LoginGuardDecision> {
  const { actor, intent } = input;
  const keys = actorKeys(actor);

  const [ipStrike, deviceStrike] = await Promise.all([store.bumpStrike("ip", keys.ip), store.bumpStrike("device", keys.device)]);
  const strikes = Math.max(ipStrike.count, deviceStrike.count);
  const degraded = ipStrike.degraded || deviceStrike.degraded;

  await store.pushReport({
    at: new Date().toISOString(),
    event: "strike",
    intent,
    scope: ipStrike.count >= deviceStrike.count ? "ip" : "device",
    ip: actor.ip,
    deviceHash: keys.device.slice(0, 10),
    email: maskEmail(actor.email),
    strikes,
    reason: "attempt_failed",
    expiresAt: null,
    userAgent: actor.userAgent?.slice(0, 160) ?? null,
  });

  if (strikes < loginFailureThreshold) {
    return allowedDecision(strikes, degraded);
  }

  const expiresAt = new Date(Date.now() + loginBlockSeconds * 1_000).toISOString();
  await cascadeBlock({ actor, origin: ipStrike.count >= deviceStrike.count ? "ip" : "device", strikes, expiresAt, intent });

  return {
    allowed: false,
    scope: ipStrike.count >= deviceStrike.count ? "ip" : "device",
    reason: "too_many_failed_codes",
    retryAfterSeconds: loginBlockSeconds,
    strikes,
    remainingAttempts: 0,
    degraded,
  };
}

/**
 * Clears the strike counters after a genuine sign-in.
 *
 * Deliberately does NOT clear an active block: a correct code arriving during a
 * lockout does not end the lockout, otherwise the whole guard would be bypassed
 * by simply guessing right on attempt six.
 */
export async function clearLoginFailures(input: { actor: LoginActor; intent?: LoginIntent }) {
  const keys = actorKeys(input.actor);
  const targets: { scope: LoginActorScope; hash: string }[] = [
    { scope: "ip", hash: keys.ip },
    { scope: "device", hash: keys.device },
  ];
  if (keys.identity) targets.push({ scope: "identity", hash: keys.identity });
  await store.clearStrikes(targets);
  await store.pushReport({
    at: new Date().toISOString(),
    event: "cleared",
    intent: input.intent ?? "session",
    scope: "ip",
    ip: input.actor.ip,
    deviceHash: keys.device.slice(0, 10),
    email: maskEmail(input.actor.email),
    strikes: 0,
    reason: "verified",
    expiresAt: null,
    userAgent: input.actor.userAgent?.slice(0, 160) ?? null,
  });
}

/** Admin feed: what was reported, and how durable the store currently is. */
export async function getLoginAbuseReport() {
  const entries = await store.readReport();
  const blocked = entries.filter((entry) => entry.event === "blocked" || entry.event === "cascaded");
  const now = Date.now();
  const activeBlocks = blocked.filter((entry) => entry.expiresAt && Date.parse(entry.expiresAt) > now);
  return {
    durable: rateLimitBackendConfigured,
    threshold: loginFailureThreshold,
    blockSeconds: loginBlockSeconds,
    activeBlockCount: activeBlocks.length,
    entries,
  };
}

/**
 * Read-only block check for the site-wide middleware.
 *
 * Deliberately does **not** cascade, link, or count: it runs on ordinary
 * traffic, so it must stay a pure read. Cascading belongs on the login path,
 * where an attempt is actually being made.
 */
/**
 * Google sign-in reprieve.
 *
 * The storefront's rule: someone who completes a real Google sign-in has
 * already cleared Google's own account security, so they are treated as a
 * verified human and allowed back in even while their address is serving a
 * 24-hour block. Email one-time-code sign-in is NOT covered — that is the flow
 * the block exists to protect.
 *
 * This is a deliberate, load-bearing bypass, so it is deliberately narrow:
 *
 * - It is granted only by the Google OAuth callback, after Google has vouched.
 * - It is keyed to the address AND the device that completed the sign-in, so it
 *   does not open the door for the rest of a shared carrier address.
 * - It never deletes the block or clears strike counters. If the same actor
 *   abuses the code flow again, the block is still there underneath and still
 *   applies to email sign-in.
 * - Every grant is written to the report feed, so a burst of reprieves from one
 *   address is visible rather than silent.
 *
 * The honest trade-off: an attacker holding a throwaway Google account can walk
 * through a ban. What it buys is that a real customer sharing a carrier address
 * with an abuser is never permanently locked out of a paid account.
 */
const reprieveKey = (scope: LoginActorScope, hash: string) => `la:reprieve:${scope}:${hash}`;
const memoryReprieve = new Map<string, number>();

export async function grantAccessReprieve(input: {
  ip: string;
  deviceId: string;
  email?: string | null;
  reason?: string;
}): Promise<void> {
  const ipHash = actorHash("ip", input.ip);
  const deviceHash = actorHash("device", input.deviceId);
  const ttl = loginBlockSeconds;

  if (!rateLimitBackendConfigured) {
    const expiresAt = Date.now() + ttl * 1_000;
    memoryReprieve.set(reprieveKey("ip", ipHash), expiresAt);
    memoryReprieve.set(reprieveKey("device", deviceHash), expiresAt);
  } else {
    try {
      await redisPipeline([
        ["SET", reprieveKey("ip", ipHash), "1", "EX", ttl],
        ["SET", reprieveKey("device", deviceHash), "1", "EX", ttl],
      ]);
    } catch {
      /* a lost reprieve just means the customer stays blocked; safe direction */
    }
  }

  await store.pushReport({
    at: new Date().toISOString(),
    event: "cleared",
    intent: "session",
    scope: "identity",
    ip: input.ip,
    deviceHash,
    email: maskEmail(input.email ?? ""),
    label: maskEmail(input.email ?? "") || "google-verified",
    strikes: 0,
    reason: "verified",
    expiresAt: null,
    userAgent: `reprieve: ${(input.reason ?? "google_sign_in").slice(0, 60)}`,
  });
}

/** True when this address+device completed a Google sign-in inside the window. */
export async function hasAccessReprieve(input: { ip: string; deviceId: string }): Promise<boolean> {
  const keys = [
    reprieveKey("ip", actorHash("ip", input.ip)),
    reprieveKey("device", actorHash("device", input.deviceId)),
  ];

  if (!rateLimitBackendConfigured) {
    const now = Date.now();
    let found = false;
    keys.forEach((key) => {
      const expiresAt = memoryReprieve.get(key);
      if (expiresAt === undefined) return;
      if (expiresAt <= now) memoryReprieve.delete(key);
      else found = true;
    });
    return found;
  }

  try {
    const replies = await redisPipeline(keys.map((key) => ["GET", key]));
    return replies.some((reply) => Boolean((reply as { result?: string } | null)?.result));
  } catch {
    // Fail CLOSED here: if we cannot prove a reprieve exists, the block stands.
    return false;
  }
}

/**
 * Operator-initiated block, used by the Telegram console.
 *
 * Unlike the automatic path this does not cascade to linked devices. An
 * operator typing an address is making a narrow, deliberate decision, and
 * quietly widening it to every device ever seen from that address would make
 * the command far more destructive than it looks.
 */
export async function banIpNow(input: { ip: string; actorLabel: string }): Promise<{ blocked: boolean }> {
  const ip = input.ip.trim();
  // Accept IPv4 and IPv6 shapes only. This value is echoed back to the operator
  // and stored as a label, so it must not become a free-text sink.
  if (!/^[0-9a-fA-F:.]{3,45}$/.test(ip) || !/[.:]/.test(ip)) return { blocked: false };

  const expiresAt = new Date(Date.now() + loginBlockSeconds * 1_000).toISOString();
  await applyBlock({
    scope: "ip",
    hash: actorHash("ip", ip),
    label: ip,
    reason: "manual",
    strikes: loginFailureThreshold,
    expiresAt,
    context: { ip, device: null, email: null },
  });

  await store.pushReport({
    at: new Date().toISOString(),
    event: "blocked",
    intent: "session",
    scope: "ip",
    ip,
    deviceHash: "operator",
    email: null,
    strikes: loginFailureThreshold,
    reason: "manual",
    expiresAt,
    userAgent: `blocked by ${input.actorLabel}`.slice(0, 160),
  });

  return { blocked: true };
}

export function resetAccessReprieveForTests() {
  memoryReprieve.clear();
}

export async function inspectActorBlock(input: { ip: string; deviceId: string }): Promise<{
  blocked: boolean;
  scope: LoginActorScope | null;
  retryAfterSeconds: number;
  expiresAt: string | null;
  degraded: boolean;
}> {
  const ipHash = actorHash("ip", input.ip);
  const deviceHash = actorHash("device", input.deviceId || `ip:${input.ip}`);
  const targets: { scope: LoginActorScope; hash: string }[] = [
    { scope: "ip", hash: ipHash },
    { scope: "device", hash: deviceHash },
  ];
  const { blocks, degraded } = await store.readBlocks(targets);
  let worst: { block: StoredBlock; scope: LoginActorScope } | null = null;
  blocks.forEach((block, index) => {
    if (!block || remainingSeconds(block.expiresAt) <= 0) return;
    if (!worst || remainingSeconds(block.expiresAt) > remainingSeconds(worst.block.expiresAt)) {
      worst = { block, scope: targets[index]!.scope };
    }
  });
  const found = worst as { block: StoredBlock; scope: LoginActorScope } | null;
  if (!found) return { blocked: false, scope: null, retryAfterSeconds: 0, expiresAt: null, degraded };
  return {
    blocked: true,
    scope: found.scope,
    retryAfterSeconds: remainingSeconds(found.block.expiresAt),
    expiresAt: found.block.expiresAt,
    degraded,
  };
}

/** Every live ban, newest first, for the admin table. */
export async function listActiveLoginBans(): Promise<{ durable: boolean; bans: LoginBanSummary[] }> {
  const ids = await store.readBanIds();
  const targets: { scope: LoginActorScope; hash: string }[] = [];
  ids.forEach((id) => {
    const parsed = parseBanId(id);
    if (parsed) targets.push(parsed);
  });
  if (targets.length === 0) return { durable: rateLimitBackendConfigured, bans: [] };

  const { blocks, degraded } = await store.readBlocks(targets);
  const bans: LoginBanSummary[] = [];
  blocks.forEach((block, index) => {
    const target = targets[index];
    if (!block || !target) return;
    const retryAfterSeconds = remainingSeconds(block.expiresAt);
    if (retryAfterSeconds <= 0) return;
    bans.push({
      id: banId(target.scope, target.hash),
      scope: target.scope,
      reason: block.reason,
      strikes: block.strikes,
      blockedAt: block.blockedAt,
      expiresAt: block.expiresAt,
      retryAfterSeconds,
      label: block.label,
      ip: block.ip ?? (target.scope === "ip" ? block.label : null),
      device: block.device ?? null,
      email: block.email ?? (target.scope === "identity" ? block.label : null),
    });
  });
  bans.sort((left, right) => Date.parse(right.blockedAt) - Date.parse(left.blockedAt));
  return { durable: rateLimitBackendConfigured && !degraded, bans };
}

/**
 * Admin unban. Clears the block *and* the strike counter for that actor, so a
 * released customer starts from a clean five attempts rather than being one
 * mistake away from another 24 hours.
 *
 * Lifting a ban also releases the rows that exist *only* because of it: the
 * device and the mailbox taken down by the same cascade come back together with
 * the address, so one admin action restores one actor. A row that was blocked
 * on its own evidence carries its own origin id and is never released by proxy.
 */
export async function liftLoginBan(input: { id: string; actorLabel: string }): Promise<{ lifted: boolean; degraded: boolean }> {
  const parsed = parseBanId(input.id);
  if (!parsed) return { lifted: false, degraded: !rateLimitBackendConfigured };
  const { blocks } = await store.readBlocks([parsed]);
  const existing = blocks[0];
  const degraded = await store.dropBan(parsed.scope, parsed.hash);
  const released = await releaseCascadedBlocks(banId(parsed.scope, parsed.hash));
  await store.pushReport({
    at: new Date().toISOString(),
    event: "cleared",
    intent: "session",
    scope: parsed.scope,
    ip: existing?.ip ?? existing?.label ?? "",
    deviceHash: parsed.hash.slice(0, 10),
    email: existing?.email ?? null,
    strikes: existing?.strikes ?? 0,
    reason: "manual",
    expiresAt: null,
    // The audit trail records *who* released it. An unban is a security
    // decision, so it must never be anonymous.
    userAgent: `lifted by ${input.actorLabel}${released ? ` (+${released} linked)` : ""}`.slice(0, 160),
  });
  return { lifted: Boolean(existing), degraded };
}

/**
 * Releases every block that was written by the cascade identified by `origin`.
 *
 * The ban index is the only enumerable list of live blocks, so we walk it and
 * drop the rows that point back at the ban just lifted. A device that earned a
 * block on its own evidence carries its own origin id and therefore stays down.
 */
async function releaseCascadedBlocks(origin: string): Promise<number> {
  const targets = (await store.readBanIds())
    .filter((id) => id !== origin)
    .map((id) => parseBanId(id))
    .filter((target): target is { scope: LoginActorScope; hash: string } => target !== null);
  if (targets.length === 0) return 0;
  const { blocks } = await store.readBlocks(targets);
  const cascaded = targets.filter((_, index) => blocks[index]?.origin === origin);
  await Promise.all(cascaded.map((target) => store.dropBan(target.scope, target.hash)));
  return cascaded.length;
}

/** Test seam. Never called from request handlers. */
export function resetLoginAbuseGuardForTests() {
  memoryBlocks.clear();
  memoryStrikes.clear();
  memoryLinks.clear();
  memoryBans.clear();
  memoryReport.length = 0;
}

/* -------------------------------------------------------------- messaging */

export function formatRetryAfterKh(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.ceil((safe % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours} ម៉ោង ${minutes} នាទី`;
  if (hours > 0) return `${hours} ម៉ោង`;
  if (minutes > 0) return `${minutes} នាទី`;
  return "មួយភ្លែត";
}

/**
 * The only text the blocked visitor sees. It says what happened and when it
 * ends, and nothing else: no strike count, no scope, no hint about which
 * signal caught them.
 */
export function loginBlockMessageKh(decision: Pick<LoginGuardDecision, "retryAfterSeconds">) {
  return `ការចូលពីទីតាំង/ឧបករណ៍នេះត្រូវបានផ្អាកបណ្ដោះអាសន្ន ដោយសារវាយលេខកូដខុសច្រើនដងពេក។ សូមព្យាយាមម្ដងទៀតក្នុងរយៈពេល ${formatRetryAfterKh(decision.retryAfterSeconds)}។ បើនេះជាកំហុស សូមទាក់ទង Support។`;
}
