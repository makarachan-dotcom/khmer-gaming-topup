import DashboardLayout from "@/components/DashboardLayout";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCheck,
  Clock,
  Globe,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  MonitorSmartphone,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Tag,
  UserRound,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

/**
 * Operator console for the customer support chat.
 *
 * The page is built around one number: how long a customer waits for a human.
 * The inbox sorts by it, a thread opens on one click, the composer sends on
 * Enter, and a reply is painted before the request lands.
 *
 * WHY THIS PAGE NEVER RENDERS BLANK
 *
 * The first version gated itself on `useAuth().user.role`, and an operator who
 * was a legitimate admin but whose session payload did not carry `role` got a
 * refusal card with nothing to act on — indistinguishable from a broken page.
 * The gate now lives on the server, which is the only place that can actually
 * decide it, and every failure state here says what happened and what to do:
 *
 *   401  -> the session expired; sign in again
 *   403  -> signed in as the wrong account, and we name it
 *   404  -> the running deployment predates the admin API; ship the build
 *   429  -> polling too fast; it backs off and says so
 *   5xx  -> the server errored; retry is one tap
 *
 * `storeReady: false` gets its own banner, because an unreachable database
 * produces an empty inbox that looks exactly like a quiet afternoon.
 *
 * Talks to `/api/admin/support/*`, which `ipBanGuard` exempts, so an operator
 * whose own address was swept up in a cascade can still answer the customer
 * asking to be released. Each endpoint checks the admin role itself.
 */

type ChatMessage = {
  id: string;
  role: "user" | "admin" | "system";
  kind: "text" | "image" | "voice";
  text: string;
  mediaUrl: string | null;
  at: string;
};

type ChatBase = {
  id: string;
  status: "waiting" | "active" | "closed";
  topic: string;
  orderRef: string | null;
  openedAt: string;
  closedAt: string | null;
  adminTyping: boolean;
  userId: number;
  email: string | null;
  displayName: string | null;
  ip: string | null;
  device: string | null;
  closedBy: string | null;
  adminSeenAt: string | null;
  unread: number;
  lastMessageAt: string;
  lastMessage: { role: string; kind: string; text: string } | null;
  waitingSeconds: number;
};

type ChatSummary = ChatBase & { messageCount: number };
type Chat = ChatBase & { messages: ChatMessage[] };

type InboxPayload = {
  chats: ChatSummary[];
  waiting: number;
  open: number;
  unread: number;
  storeReady: boolean;
  viewer: { email: string | null; role: string | null };
  at: string;
};

/** Everything that can stop the console working, in words an operator can act on. */
type Problem = {
  kind: "signin" | "forbidden" | "stale" | "rate" | "server" | "network";
  title: string;
  detail: string;
  hint?: string;
};

type Filter = "all" | "waiting" | "closed";

/** Answers an operator types twenty times a day. One tap, then edit or send. */
const quickReplies = [
  "សូមអភ័យទោស ខ្ញុំកំពុងពិនិត្យបញ្ហារបស់អ្នក សូមរង់ចាំបន្តិច។",
  "សូមផ្ញើលេខអូដ័រ (Order ID) មកខ្ញុំផង។",
  "ខ្ញុំបានដោះការផ្អាកឧបករណ៍របស់អ្នករួចរាល់ សូមចូលម្ដងទៀត។",
  "បញ្ហារបស់អ្នកត្រូវបានដោះស្រាយរួចរាល់។ សូមព្យាយាមម្ដងទៀត។",
  "សូមអរគុណសម្រាប់ការរង់ចាំ។ តើមានអ្វីចង់បន្ថែមទៀតទេ?",
];

const statusLabel: Record<ChatBase["status"], string> = {
  waiting: "រង់ចាំចម្លើយ",
  active: "កំពុងជជែក",
  closed: "បិទ",
};

const filterLabel: Record<Filter, string> = {
  all: "ទាំងអស់",
  waiting: "រង់ចាំ",
  closed: "បិទរួច",
};

function waitLabel(seconds: number) {
  if (seconds <= 0) return "";
  if (seconds < 60) return `${seconds} វិនាទី`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} នាទី`;
  return `${Math.floor(minutes / 60)} ម៉ោង ${minutes % 60} នាទី`;
}

function clockLabel(iso: string) {
  const stamp = Date.parse(iso);
  if (!Number.isFinite(stamp)) return "";
  return new Date(stamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function customerName(chat: ChatBase) {
  return chat.displayName?.trim() || chat.email?.split("@")[0] || `អតិថិជន #${chat.userId}`;
}

type Reply = { ok: boolean; status: number; data: Record<string, unknown> };

/** One fetch wrapper so every caller sees the same shape, including on a network drop. */
async function request(path: string, init?: RequestInit): Promise<Reply> {
  try {
    const response = await fetch(path, {
      credentials: "include",
      headers: init?.body ? { "Content-Type": "application/json" } : undefined,
      ...init,
    });
    let data: Record<string, unknown> = {};
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      /* an HTML error page or an empty body: the status still tells the story */
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

/** Turns a failed reply into something the operator can act on. */
function describeProblem(reply: Reply): Problem {
  const signedInAs = typeof reply.data.signedInAs === "string" ? reply.data.signedInAs : null;
  switch (reply.status) {
    case 0:
      return {
        kind: "network",
        title: "ភ្ជាប់អ៊ីនធឺណិតមិនបាន",
        detail: "មិនអាចទាក់ទងទៅ server បានទេ។ សូមពិនិត្យបណ្ដាញរបស់អ្នក។",
      };
    case 401:
      return {
        kind: "signin",
        title: "សូមចូលគណនីម្ដងទៀត",
        detail: "Session របស់អ្នកផុតកំណត់ហើយ។",
        hint: "ចុច Refresh រួចចូលគណនី Admin ម្ដងទៀត។",
      };
    case 403:
      return {
        kind: "forbidden",
        title: "គណនីនេះមិនមែន Admin ទេ",
        detail: signedInAs
          ? `អ្នកកំពុងចូលដោយ ${signedInAs}។ សូមចេញ រួចចូលដោយគណនី Admin។`
          : "សូមចេញពីគណនីនេះ រួចចូលដោយគណនី Admin។",
      };
    case 404:
      return {
        kind: "stale",
        title: "Build នៅ server មិនទាន់មាន API នេះ",
        detail: "ទំព័រនេះដំណើរការ ប៉ុន្តែ /api/admin/support/chats មិនទាន់ត្រូវបាន deploy ទេ។",
        hint: "សូម push កូដថ្មីទៅ main រួចរង់ចាំ Vercel deploy ឲ្យរួច។",
      };
    case 429:
      return {
        kind: "rate",
        title: "ស្នើសុំញឹកញាប់ពេក",
        detail: "សូមរង់ចាំមួយភ្លែត ប្រព័ន្ធនឹងព្យាយាមម្ដងទៀតដោយស្វ័យប្រវត្តិ។",
      };
    default:
      return {
        kind: "server",
        title: "Server មានបញ្ហា",
        detail: `ស្ថានភាព ${reply.status || "unknown"}។ សូមព្យាយាមម្ដងទៀត។`,
      };
  }
}

export default function AdminSupportChat() {
  // No client-side role gate on purpose: see the note at the top of the file.
  return (
    <DashboardLayout>
      <SupportConsole />
    </DashboardLayout>
  );
}

function SupportConsole() {
  const [inbox, setInbox] = useState<ChatSummary[]>([]);
  const [meta, setMeta] = useState<Omit<InboxPayload, "chats"> | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [booted, setBooted] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [chat, setChat] = useState<Chat | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [threadNotice, setThreadNotice] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const typingSentAt = useRef(0);

  /* ------------------------------------------------------------- inbox --- */

  const loadInbox = useCallback(async (quiet: boolean) => {
    if (!quiet) setRefreshing(true);
    const reply = await request("/api/admin/support/chats");
    if (reply.ok) {
      const payload = reply.data as unknown as InboxPayload;
      setInbox(Array.isArray(payload.chats) ? payload.chats : []);
      setMeta({
        waiting: payload.waiting ?? 0,
        open: payload.open ?? 0,
        unread: payload.unread ?? 0,
        storeReady: payload.storeReady !== false,
        viewer: payload.viewer ?? { email: null, role: null },
        at: payload.at ?? new Date().toISOString(),
      });
      setProblem(null);
    } else {
      const next = describeProblem(reply);
      // A rate limit is transient; keep the rows already on screen.
      if (next.kind !== "rate") setInbox([]);
      setProblem(next);
    }
    setBooted(true);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadInbox(false);
  }, [loadInbox]);

  useEffect(() => {
    // Back off when the console is refused or offline: hammering a 403 helps
    // nobody, and a 429 would make the recovery slower.
    const blocked = problem && problem.kind !== "rate";
    const every = blocked ? 30_000 : 5_000;
    const timer = window.setInterval(() => void loadInbox(true), every);
    return () => window.clearInterval(timer);
  }, [loadInbox, problem]);

  /* ------------------------------------------------------------ thread --- */

  const loadThread = useCallback(async (id: string, markSeen: boolean) => {
    const reply = await request(`/api/admin/support/chats/${encodeURIComponent(id)}${markSeen ? "?seen=1" : ""}`);
    if (reply.ok) {
      setChat(reply.data.chat as Chat);
      setThreadNotice(null);
      return;
    }
    if (reply.status === 404) {
      setThreadNotice("ការជជែកនេះលែងមានទៀតហើយ (ផុតកំណត់ ឬត្រូវបានលុប)។");
      setChat(null);
      return;
    }
    setProblem(describeProblem(reply));
  }, []);

  useEffect(() => {
    if (!openId) return;
    void loadThread(openId, true);
    const timer = window.setInterval(() => void loadThread(openId, false), 3_000);
    return () => window.clearInterval(timer);
  }, [openId, loadThread]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [chat?.messages.length, openId]);

  /* Unread count in the browser tab, so a reply is not missed on another tab. */
  useEffect(() => {
    const base = "ការជជែកជំនួយ · ZURS";
    const total = meta?.unread ?? 0;
    document.title = total > 0 ? `(${total}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [meta?.unread]);

  /* ------------------------------------------------------------ actions -- */

  const pingTyping = useCallback((id: string) => {
    const now = Date.now();
    if (now - typingSentAt.current < 4_000) return;
    typingSentAt.current = now;
    void request("/api/admin/support/typing", {
      method: "POST",
      body: JSON.stringify({ sessionId: id, seconds: 8 }),
    });
  }, []);

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || !chat || sending) return;

    // Paint it first. An operator should never wait on a round trip to see
    // what they just typed.
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "admin",
      kind: "text",
      text,
      mediaUrl: null,
      at: new Date().toISOString(),
    };
    setChat({ ...chat, messages: [...chat.messages, optimistic], status: chat.status === "waiting" ? "active" : chat.status });
    setDraft("");
    setSending(true);

    const reply = await request("/api/admin/support/reply", {
      method: "POST",
      body: JSON.stringify({ sessionId: chat.id, text }),
    });
    setSending(false);

    if (reply.ok) {
      setChat(reply.data.chat as Chat);
      void loadInbox(true);
      return;
    }

    // Roll back and hand the words back to the operator rather than losing them.
    setChat((current) =>
      current ? { ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) } : current,
    );
    setDraft(text);
    if (reply.status === 409) setThreadNotice("ការជជែកនេះត្រូវបានបិទរួចហើយ។");
    else if (reply.status === 413) setThreadNotice("សារវែងពេក។ សូមកាត់ឲ្យខ្លីជាងនេះ។");
    else setThreadNotice(describeProblem(reply).detail);
  }, [chat, draft, loadInbox, sending]);

  const closeChat = useCallback(async () => {
    if (!chat) return;
    const reply = await request("/api/admin/support/close", {
      method: "POST",
      body: JSON.stringify({ sessionId: chat.id }),
    });
    if (reply.ok && reply.data.chat) setChat(reply.data.chat as Chat);
    void loadInbox(true);
  }, [chat, loadInbox]);

  const banIp = useCallback(async () => {
    if (!chat?.ip) return;
    if (!window.confirm(`ផ្អាក IP ${chat.ip} រយៈពេល ២៤ ម៉ោង?`)) return;
    const reply = await request("/api/admin/login-bans/ban", {
      method: "POST",
      body: JSON.stringify({ ip: chat.ip, hours: 24 }),
    });
    if (reply.ok) setThreadNotice(`បានផ្អាក IP ${chat.ip} រយៈពេល ២៤ ម៉ោង។`);
    else if (reply.status === 409) setThreadNotice("គណនីនេះត្រូវបានការពារ មិនអាចផ្អាកបានទេ។");
    else setThreadNotice(describeProblem(reply).detail);
  }, [chat]);

  /* -------------------------------------------------------------- view --- */

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inbox.filter((row) => {
      if (filter === "waiting" && row.status !== "waiting") return false;
      if (filter === "closed" && row.status !== "closed") return false;
      if (!needle) return true;
      return [row.email, row.displayName, row.topic, row.orderRef, row.ip, String(row.userId)]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle));
    });
  }, [inbox, filter, search]);

  const showList = !openId;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">ការជជែកជំនួយ</h1>
            <p className="mt-1 text-sm text-slate-500">
              ឆ្លើយតបអតិថិជនផ្ទាល់ — រង់ចាំយូរជាងគេឡើងលើមុន
              {meta ? ` · ធ្វើបច្ចុប្បន្នភាព ${clockLabel(meta.at)}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {meta && meta.waiting > 0 ? (
              <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-900">
                រង់ចាំ {meta.waiting}
              </span>
            ) : null}
            {meta && meta.unread > 0 ? (
              <span className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white">
                សារថ្មី {meta.unread}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void loadInbox(false)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              ផ្ទុកឡើងវិញ
            </button>
          </div>
        </header>

        {problem ? <ProblemCard problem={problem} onRetry={() => void loadInbox(false)} /> : null}

        {meta && !meta.storeReady ? (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-6 text-amber-900">
              មូលដ្ឋានទិន្នន័យមិនអាចភ្ជាប់បានទេ ដូច្នេះបញ្ជីនេះអាចទទេ។ សូមពិនិត្យ <code className="rounded bg-amber-100 px-1">DATABASE_URL</code> នៅ Vercel។
            </p>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <section className={`${showList ? "block" : "hidden"} lg:block`}>
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="space-y-3 border-b border-slate-100 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ស្វែងរក អ៊ីមែល / លេខអូដ័រ / IP"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
                  />
                </div>
                <div className="flex gap-1.5">
                  {(Object.keys(filterLabel) as Filter[]).map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFilter(key)}
                      className={`h-9 flex-1 rounded-lg text-xs font-bold transition ${
                        filter === key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {filterLabel[key]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="max-h-[calc(100dvh-19rem)] overflow-y-auto">
                {!booted ? (
                  <div className="grid place-items-center p-10 text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : rows.length === 0 ? (
                  <EmptyInbox hasProblem={Boolean(problem)} filtered={inbox.length > 0} />
                ) : (
                  rows.map((row) => (
                    <InboxRow key={row.id} row={row} active={row.id === openId} onOpen={() => setOpenId(row.id)} />
                  ))
                )}
              </div>
            </div>
          </section>

          <section className={`${showList ? "hidden" : "block"} lg:block`}>
            {chat ? (
              <Thread
                chat={chat}
                draft={draft}
                sending={sending}
                notice={threadNotice}
                scrollRef={scrollRef}
                onBack={() => {
                  setOpenId(null);
                  setChat(null);
                  setThreadNotice(null);
                }}
                onDraft={(value) => {
                  setDraft(value);
                  if (value.trim()) pingTyping(chat.id);
                }}
                onSend={() => void send()}
                onClose={() => void closeChat()}
                onBanIp={() => void banIp()}
              />
            ) : (
              <div className="grid h-[60vh] place-items-center rounded-2xl border border-dashed border-slate-200 bg-white text-center">
                <div className="px-6">
                  <MessageSquare className="mx-auto h-9 w-9 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {threadNotice ?? "ជ្រើសរើសការជជែកមួយ ដើម្បីឆ្លើយតប"}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- parts --- */

function ProblemCard({ problem, onRetry }: { problem: Problem; onRetry: () => void }) {
  const tone =
    problem.kind === "forbidden" || problem.kind === "signin"
      ? { border: "border-rose-200", bg: "bg-rose-50", text: "text-rose-900", icon: "text-rose-600" }
      : { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-900", icon: "text-amber-600" };
  const Icon = problem.kind === "forbidden" || problem.kind === "signin" ? ShieldAlert : AlertTriangle;

  return (
    <div className={`mt-4 flex flex-wrap items-start gap-3 rounded-2xl border ${tone.border} ${tone.bg} p-4`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone.icon}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-bold ${tone.text}`}>{problem.title}</p>
        <p className={`mt-1 text-sm leading-6 ${tone.text}`}>{problem.detail}</p>
        {problem.hint ? <p className={`mt-1 text-xs leading-5 ${tone.text} opacity-80`}>{problem.hint}</p> : null}
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
      >
        ព្យាយាមម្ដងទៀត
      </button>
    </div>
  );
}

function EmptyInbox({ hasProblem, filtered }: { hasProblem: boolean; filtered: boolean }) {
  return (
    <div className="grid place-items-center p-10 text-center">
      <Inbox className="h-8 w-8 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-700">
        {hasProblem ? "មិនអាចផ្ទុកបញ្ជីបានទេ" : filtered ? "គ្មានលទ្ធផលត្រូវនឹងការស្វែងរក" : "មិនទាន់មានការជជែកទេ"}
      </p>
      {!hasProblem && !filtered ? (
        <p className="mt-1 text-xs leading-5 text-slate-500">ការជជែកថ្មីនឹងលេចឡើងទីនេះដោយស្វ័យប្រវត្តិ។</p>
      ) : null}
    </div>
  );
}

function InboxRow({ row, active, onOpen }: { row: ChatSummary; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full gap-3 border-b border-slate-100 p-3 text-left transition ${
        active ? "bg-indigo-50" : "hover:bg-slate-50"
      }`}
    >
      <div
        className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-black text-white ${
          row.status === "waiting" ? "bg-amber-500" : row.status === "active" ? "bg-indigo-600" : "bg-slate-400"
        }`}
      >
        {customerName(row).slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-bold text-slate-900">{customerName(row)}</p>
          <span className="shrink-0 text-[11px] text-slate-400">{clockLabel(row.lastMessageAt)}</span>
        </div>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {row.lastMessage?.kind === "image"
            ? "📷 រូបភាព"
            : row.lastMessage?.kind === "voice"
              ? "🎤 សារជាសំឡេង"
              : row.lastMessage?.text || row.topic || "—"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              row.status === "waiting"
                ? "bg-amber-100 text-amber-800"
                : row.status === "active"
                  ? "bg-indigo-100 text-indigo-800"
                  : "bg-slate-100 text-slate-600"
            }`}
          >
            {statusLabel[row.status]}
          </span>
          {row.waitingSeconds > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700">
              <Clock className="h-3 w-3" />
              {waitLabel(row.waitingSeconds)}
            </span>
          ) : null}
          {row.unread > 0 ? (
            <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black text-white">{row.unread}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function Thread({
  chat,
  draft,
  sending,
  notice,
  scrollRef,
  onBack,
  onDraft,
  onSend,
  onClose,
  onBanIp,
}: {
  chat: Chat;
  draft: string;
  sending: boolean;
  notice: string | null;
  scrollRef: React.MutableRefObject<HTMLDivElement | null>;
  onBack: () => void;
  onDraft: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
  onBanIp: () => void;
}) {
  const closed = chat.status === "closed";

  return (
    <div className="flex h-[calc(100dvh-13rem)] flex-col rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 p-3">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-900">{customerName(chat)}</p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {chat.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {chat.email}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" />#{chat.userId}
            </span>
            {chat.device ? (
              <span className="inline-flex items-center gap-1">
                <MonitorSmartphone className="h-3 w-3" />
                {chat.device}
              </span>
            ) : null}
            {chat.ip ? (
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {chat.ip}
              </span>
            ) : null}
            {chat.orderRef ? (
              <span className="inline-flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {chat.orderRef}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {chat.ip ? (
            <button
              type="button"
              onClick={onBanIp}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-200 px-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-50"
            >
              <Ban className="h-3.5 w-3.5" />
              ផ្អាក IP
            </button>
          ) : null}
          {!closed ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
            >
              <XCircle className="h-3.5 w-3.5" />
              បិទ
            </button>
          ) : null}
          <Link
            href="/admin/login-bans"
            className="hidden h-9 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 sm:inline-flex"
          >
            ការផ្អាក
          </Link>
        </div>
      </div>

      {notice ? (
        <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">{notice}</p>
      ) : null}

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-4">
        {chat.messages.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        {chat.messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-400">មិនទាន់មានសារទេ</p>
        ) : null}
      </div>

      {closed ? (
        <p className="border-t border-slate-100 p-4 text-center text-xs font-semibold text-slate-500">
          ការជជែកនេះត្រូវបានបិទ{chat.closedBy ? ` ដោយ ${chat.closedBy}` : ""}។
        </p>
      ) : (
        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => onDraft(reply)}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                {reply.length > 34 ? `${reply.slice(0, 34)}…` : reply}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(event) => onDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends. An operator answering forty chats should not
                // have to reach for the mouse.
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onSend();
                }
              }}
              rows={1}
              placeholder="សរសេរចម្លើយ… (Enter ផ្ញើ · Shift+Enter ចុះបន្ទាត់)"
              className="max-h-32 min-h-[3rem] flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:bg-white"
            />
            <button
              type="button"
              onClick={onSend}
              disabled={!draft.trim() || sending}
              className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              ផ្ញើ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  if (message.role === "system") {
    return (
      <p className="mx-auto max-w-md rounded-lg bg-slate-200/70 px-3 py-1.5 text-center text-[11px] font-semibold text-slate-600">
        {message.text}
      </p>
    );
  }

  const mine = message.role === "admin";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-6 shadow-sm ${
          mine ? "bg-indigo-600 text-white" : "bg-white text-slate-900"
        }`}
      >
        {message.kind === "image" && message.mediaUrl ? (
          <a href={message.mediaUrl} target="_blank" rel="noreferrer">
            <img src={message.mediaUrl} alt="" className="max-h-64 rounded-lg" />
          </a>
        ) : message.kind === "voice" && message.mediaUrl ? (
          <audio controls src={message.mediaUrl} className="w-56" />
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.text}</p>
        )}
        <span className={`mt-1 block text-right text-[10px] ${mine ? "text-indigo-100" : "text-slate-400"}`}>
          {clockLabel(message.at)}
          {mine ? <CheckCheck className="ml-1 inline h-3 w-3" /> : null}
        </span>
      </div>
    </div>
  );
}
