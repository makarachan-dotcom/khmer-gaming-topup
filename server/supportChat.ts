import { nanoid } from "nanoid";
import { rateLimitBackendConfigured, redisPipeline } from "./rateLimit";
import {
  supportKvDelete,
  supportKvList,
  supportKvRead,
  supportKvReadEntry,
  supportKvReady,
  supportKvWrite,
  supportKvWriteUntil,
} from "./supportChatStore";

/**
 * Live support chat state.
 *
 * Sessions live in whichever SHARED store this deployment actually has: MySQL
 * first, then Redis, and only then per-instance memory. That order matters.
 * This app runs as Vercel serverless functions, so module-scope memory is not
 * shared between requests; while it was the effective store, a chat opened on
 * one instance was invisible to the very next request and the customer was
 * told "chat not found" forever. See `supportChatStore.ts`.
 *
 * The durable copy of every conversation is still the Telegram thread the
 * operator actually reads, so losing the store loses an in-flight chat but
 * never loses history.
 *
 * The quota is the unusual part. A customer gets ONE support conversation per
 * rolling 24 hours, and the clock only starts when an operator CLOSES a chat.
 * That ordering matters: if opening a chat spent the allowance, a customer
 * whose chat was closed after ten seconds by accident would be locked out for
 * a day through no fault of their own. Charging on close means the allowance
 * is spent only once a conversation has actually been handled.
 */

export const supportDailyLimit = 1;
export const supportQuotaWindowSeconds = 24 * 60 * 60;
export const supportSessionTtlSeconds = 12 * 60 * 60;
export const supportMaxMessages = 120;
export const supportMaxTextLength = 2000;

export type SupportMessageRole = "user" | "admin" | "system";
export type SupportMessageKind = "text" | "image" | "voice";

export type SupportMessage = {
  id: string;
  role: SupportMessageRole;
  kind: SupportMessageKind;
  text: string;
  mediaUrl: string | null;
  at: string;
};

export type SupportSessionStatus = "waiting" | "active" | "closed";

export type SupportSession = {
  id: string;
  userId: number;
  email: string | null;
  displayName: string | null;
  topic: string;
  orderRef: string | null;
  status: SupportSessionStatus;
  openedAt: string;
  closedAt: string | null;
  closedBy: string | null;
  adminTypingUntil: string | null;
  ip: string | null;
  device: string | null;
  messages: SupportMessage[];
};

export type SupportQuotaState = {
  used: number;
  limit: number;
  blocked: boolean;
  resetsInSeconds: number;
};

const sessionKey = (id: string) => `sc:sess:${id}`;
const userKey = (userId: number) => `sc:user:${userId}`;
const quotaKey = (userId: number) => `sc:quota:${userId}`;
const openIndexKey = "sc:open";

const memorySessions = new Map<string, { session: SupportSession; expiresAt: number }>();
const memoryUserActive = new Map<number, string>();
const memoryQuota = new Map<number, { count: number; expiresAt: number }>();

function now() {
  return Date.now();
}

function sweepMemory() {
  const current = now();
  memorySessions.forEach((entry, key) => {
    if (entry.expiresAt <= current) memorySessions.delete(key);
  });
  memoryQuota.forEach((entry, key) => {
    if (entry.expiresAt <= current) memoryQuota.delete(key);
  });
}

/**
 * Which shared store this deployment actually has, resolved once per instance.
 * Picking exactly one tier avoids split-brain, where a session is written to
 * Redis and looked up in MySQL.
 */
let sharedStore: "db" | "redis" | "memory" | null = null;

async function resolveStore(): Promise<"db" | "redis" | "memory"> {
  if (sharedStore) return sharedStore;
  let resolved: "db" | "redis" | "memory" = "memory";
  if (await supportKvReady()) resolved = "db";
  else if (rateLimitBackendConfigured) resolved = "redis";
  sharedStore = resolved;
  if (resolved === "memory") {
    console.warn(
      "[SupportChat] No shared store. Set DATABASE_URL (preferred) or UPSTASH_REDIS_REST_URL. " +
        "On serverless, an in-memory chat is invisible to the next request.",
    );
  }
  return resolved;
}

async function usingDb(): Promise<boolean> {
  return (await resolveStore()) === "db";
}

const store = {
  async readSession(id: string): Promise<SupportSession | null> {
    if (await usingDb()) {
      try {
        const raw = await supportKvRead(sessionKey(id));
        return raw ? (JSON.parse(raw) as SupportSession) : null;
      } catch {
        return null;
      }
    }
    if (!rateLimitBackendConfigured) {
      sweepMemory();
      return memorySessions.get(id)?.session ?? null;
    }
    try {
      const [raw] = await redisPipeline([["GET", sessionKey(id)]]);
      const value = (raw as { result?: string } | null)?.result;
      return value ? (JSON.parse(value) as SupportSession) : null;
    } catch {
      return null;
    }
  },

  async writeSession(session: SupportSession): Promise<boolean> {
    if (await usingDb()) {
      try {
        const stored = await supportKvWrite(
          sessionKey(session.id),
          JSON.stringify(session),
          supportSessionTtlSeconds,
        );
        // The user pointer is what lets a customer resume, and what lists open
        // chats for the operator. Closing a chat retires it.
        if (session.status === "closed") await supportKvDelete(userKey(session.userId));
        else await supportKvWrite(userKey(session.userId), session.id, supportSessionTtlSeconds);
        return stored;
      } catch {
        return false;
      }
    }
    if (!rateLimitBackendConfigured) {
      memorySessions.set(session.id, {
        session,
        expiresAt: now() + supportSessionTtlSeconds * 1000,
      });
      if (session.status === "closed") memoryUserActive.delete(session.userId);
      else memoryUserActive.set(session.userId, session.id);
      return true;
    }
    const payload = JSON.stringify(session);
    const commands: (string | number)[][] = [
      ["SET", sessionKey(session.id), payload, "EX", supportSessionTtlSeconds],
    ];
    if (session.status === "closed") {
      commands.push(["DEL", userKey(session.userId)]);
      commands.push(["ZREM", openIndexKey, session.id]);
    } else {
      commands.push(["SET", userKey(session.userId), session.id, "EX", supportSessionTtlSeconds]);
      commands.push(["ZADD", openIndexKey, Date.parse(session.openedAt), session.id]);
      commands.push(["EXPIRE", openIndexKey, supportSessionTtlSeconds * 2]);
    }
    try {
      await redisPipeline(commands);
      return true;
    } catch {
      // Reported, never swallowed: a caller that believes a session was stored
      // when it was not is precisely what created the dead-end chat.
      return false;
    }
  },

  async readActiveId(userId: number): Promise<string | null> {
    if (await usingDb()) {
      try {
        return await supportKvRead(userKey(userId));
      } catch {
        return null;
      }
    }
    if (!rateLimitBackendConfigured) {
      sweepMemory();
      return memoryUserActive.get(userId) ?? null;
    }
    try {
      const [raw] = await redisPipeline([["GET", userKey(userId)]]);
      return ((raw as { result?: string } | null)?.result as string) ?? null;
    } catch {
      return null;
    }
  },

  async readOpenIds(): Promise<string[]> {
    if (await usingDb()) {
      try {
        /* every live `sc:user:<id>` pointer is an open conversation */
        return (await supportKvList("sc:user:", 100)).map((entry) => entry.value);
      } catch {
        return [];
      }
    }
    if (!rateLimitBackendConfigured) {
      sweepMemory();
      return Array.from(memoryUserActive.values());
    }
    try {
      const [raw] = await redisPipeline([["ZRANGE", openIndexKey, 0, 100]]);
      const value = (raw as { result?: string[] } | null)?.result;
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  },

  async readQuota(userId: number): Promise<{ count: number; ttl: number }> {
    if (await usingDb()) {
      try {
        const entry = await supportKvReadEntry(quotaKey(userId));
        if (!entry) return { count: 0, ttl: 0 };
        const count = Number(entry.value);
        return {
          count: Number.isFinite(count) ? count : 0,
          ttl: Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000)),
        };
      } catch {
        // Fail OPEN, exactly as the Redis path does.
        return { count: 0, ttl: 0 };
      }
    }
    if (!rateLimitBackendConfigured) {
      sweepMemory();
      const entry = memoryQuota.get(userId);
      if (!entry) return { count: 0, ttl: 0 };
      return { count: entry.count, ttl: Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000)) };
    }
    try {
      const [countRaw, ttlRaw] = await redisPipeline([
        ["GET", quotaKey(userId)],
        ["TTL", quotaKey(userId)],
      ]);
      const count = Number((countRaw as { result?: string } | null)?.result ?? 0);
      const ttl = Number((ttlRaw as { result?: number } | null)?.result ?? 0);
      return { count: Number.isFinite(count) ? count : 0, ttl: ttl > 0 ? ttl : 0 };
    } catch {
      // Fail OPEN: if we cannot read the quota we let the customer talk to us.
      // Silencing a paying customer because Redis blinked is the worse error.
      return { count: 0, ttl: 0 };
    }
  },

  async chargeQuota(userId: number): Promise<void> {
    if (await usingDb()) {
      try {
        const entry = await supportKvReadEntry(quotaKey(userId));
        const stored = entry ? Number(entry.value) : 0;
        const count = Number.isFinite(stored) ? stored : 0;
        // Keep the original expiry so the 24h window never slides forward.
        const expiresAt = entry ? entry.expiresAt : now() + supportQuotaWindowSeconds * 1000;
        await supportKvWriteUntil(quotaKey(userId), String(count + 1), expiresAt);
      } catch {
        /* an uncharged quota is a free extra chat, which is the safe direction */
      }
      return;
    }
    if (!rateLimitBackendConfigured) {
      const entry = memoryQuota.get(userId);
      const expiresAt = entry?.expiresAt ?? now() + supportQuotaWindowSeconds * 1000;
      memoryQuota.set(userId, { count: (entry?.count ?? 0) + 1, expiresAt });
      return;
    }
    try {
      await redisPipeline([
        ["INCR", quotaKey(userId)],
        ["EXPIRE", quotaKey(userId), supportQuotaWindowSeconds, "NX"],
      ]);
    } catch {
      /* an uncharged quota is a free extra chat, which is the safe direction */
    }
  },
};

export async function supportQuotaState(userId: number): Promise<SupportQuotaState> {
  const { count, ttl } = await store.readQuota(userId);
  return {
    used: count,
    limit: supportDailyLimit,
    blocked: count >= supportDailyLimit,
    resetsInSeconds: count >= supportDailyLimit ? ttl : 0,
  };
}

export async function getSession(id: string): Promise<SupportSession | null> {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  return store.readSession(id);
}

export async function getActiveSessionForUser(userId: number): Promise<SupportSession | null> {
  const id = await store.readActiveId(userId);
  if (!id) return null;
  const session = await store.readSession(id);
  if (!session || session.status === "closed") return null;
  return session;
}

export type OpenSessionResult =
  | { ok: true; session: SupportSession; resumed: boolean }
  | { ok: false; reason: "quota"; quota: SupportQuotaState }
  | { ok: false; reason: "storage" };

export async function openSupportSession(input: {
  userId: number;
  email: string | null;
  displayName: string | null;
  topic: string;
  orderRef?: string | null;
  ip?: string | null;
  device?: string | null;
}): Promise<OpenSessionResult> {
  // An already-open chat is always resumable and never costs a second slot.
  const existing = await getActiveSessionForUser(input.userId);
  if (existing) return { ok: true, session: existing, resumed: true };

  const quota = await supportQuotaState(input.userId);
  if (quota.blocked) return { ok: false, reason: "quota", quota };

  const session: SupportSession = {
    id: nanoid(12),
    userId: input.userId,
    email: input.email,
    displayName: input.displayName,
    topic: input.topic.slice(0, 200),
    orderRef: input.orderRef?.slice(0, 64) ?? null,
    status: "waiting",
    openedAt: new Date().toISOString(),
    closedAt: null,
    closedBy: null,
    adminTypingUntil: null,
    ip: input.ip ?? null,
    device: input.device ?? null,
    messages: [],
  };
  // Never report success for a session we could not store. Doing so is what
  // stranded customers: the widget showed a live room, and then every
  // follow-up request looked up an id that existed nowhere.
  const persisted = await store.writeSession(session);
  if (!persisted) return { ok: false, reason: "storage" };
  return { ok: true, session, resumed: false };
}

export async function appendMessage(input: {
  sessionId: string;
  role: SupportMessageRole;
  kind: SupportMessageKind;
  text: string;
  mediaUrl?: string | null;
}): Promise<SupportSession | null> {
  const session = await getSession(input.sessionId);
  if (!session || session.status === "closed") return null;

  const message: SupportMessage = {
    id: nanoid(10),
    role: input.role,
    kind: input.kind,
    text: input.text.slice(0, supportMaxTextLength),
    mediaUrl: input.mediaUrl ?? null,
    at: new Date().toISOString(),
  };

  session.messages = session.messages.concat(message).slice(-supportMaxMessages);
  // The first operator message is what turns "waiting" into a live conversation.
  if (input.role === "admin" && session.status === "waiting") session.status = "active";
  if (input.role === "admin") session.adminTypingUntil = null;

  await store.writeSession(session);
  return session;
}

export async function setAdminTyping(sessionId: string, seconds: number): Promise<void> {
  const session = await getSession(sessionId);
  if (!session || session.status === "closed") return;
  session.adminTypingUntil = new Date(now() + Math.min(Math.max(seconds, 0), 120) * 1000).toISOString();
  if (session.status === "waiting") session.status = "active";
  await store.writeSession(session);
}

export async function closeSupportSession(input: {
  sessionId: string;
  closedBy: string;
}): Promise<{ closed: boolean; session: SupportSession | null }> {
  const session = await getSession(input.sessionId);
  if (!session || session.status === "closed") return { closed: false, session };

  session.status = "closed";
  session.closedAt = new Date().toISOString();
  session.closedBy = input.closedBy.slice(0, 120);
  session.adminTypingUntil = null;
  await store.writeSession(session);

  // Charge the daily allowance here, and only here.
  await store.chargeQuota(session.userId);
  return { closed: true, session };
}

export async function listOpenSessions(): Promise<SupportSession[]> {
  const ids = await store.readOpenIds();
  const sessions: SupportSession[] = [];
  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    if (!id) continue;
    const session = await store.readSession(id);
    if (session && session.status !== "closed") sessions.push(session);
  }
  return sessions;
}

export function resetSupportChatForTests() {
  sharedStore = null;
  memorySessions.clear();
  memoryUserActive.clear();
  memoryQuota.clear();
}
