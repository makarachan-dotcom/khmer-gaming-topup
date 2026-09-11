import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Mic, Send, Smile, Square, X } from "lucide-react";
import { formatCountdownKh } from "@/lib/loginGuard";
import SupportOrb, { type SupportOrbMood } from "@/components/SupportOrb";
import { AnimatedEmoji, QUICK_EMOJIS, splitEmojiOnly } from "@/components/AnimatedEmoji";
import { ChatWarmth } from "@/components/ChatWarmth";
import { VerifiedName } from "@/components/VerifiedName";
import {
  SupportChatError,
  baseMimeType,
  blobToDataUrl,
  closeSupportChat,
  fetchSupportState,
  openSupportChat,
  pollSupportChat,
  sendSupportMedia,
  sendSupportText,
  supportAudioMaxBytes,
  supportAudioTypes,
  supportImageMaxBytes,
  supportImageTypes,
  supportTextMaxLength,
  type SupportQuota,
  type SupportSessionView,
} from "@/lib/supportChatClient";

const POLL_MS = 4000;

const TOPICS = [
  "បញ្ហាការទិញ ឬ ការបញ្ចូលប្រាក់",
  "មិនទាន់ទទួលបានទំនិញ",
  "រាយការណ៍បញ្ហាគណនី",
  "ជំនួយទូទៅ",
];

export type SupportChatProps = {
  open: boolean;
  onClose: () => void;
  /** Prefilled when the customer starts from their purchase history. */
  seedTopic?: string | null;
  seedOrderRef?: string | null;
};

/** Media is parked for now: text is the only channel that can actually send. */
const MEDIA_PARKED_HINT = "ឥឡូវនេះគាំទ្រតែសារជាអក្សរ · Text only for now";

/** Shown once the one-chat-per-day allowance is spent, or the chat is closed. */
const TELEGRAM_FALLBACK_TEXT =
  "If you have more questions contact me on telegram but need you wait 10 to 50 minutes";
const TELEGRAM_FALLBACK_URL = "https://t.me/zurs_makara";

function TelegramFallback({ resetsInSeconds }: { resetsInSeconds: number | null }) {
  return (
    <div className="zs-chat__tgcard">
      <p className="zs-chat__tgtext">{TELEGRAM_FALLBACK_TEXT}</p>
      <a className="zs-chat__tg" href={TELEGRAM_FALLBACK_URL} target="_blank" rel="noreferrer">
        <Send size={14} aria-hidden="true" />
        Telegram · @zurs_makara
      </a>
      {resetsInSeconds !== null && resetsInSeconds > 0 ? (
        <p className="zs-chat__quota">អាចឆាតម្ដងទៀតក្នុងរយៈពេល {formatCountdownKh(resetsInSeconds)}</p>
      ) : null}
    </div>
  );
}

function timeOf(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "";
  return new Date(parsed).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function SupportChat({ open, onClose, seedTopic, seedOrderRef }: SupportChatProps) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [session, setSession] = useState<SupportSessionView | null>(null);
  const [quota, setQuota] = useState<SupportQuota | null>(null);
  const [topic, setTopic] = useState(seedTopic || TOPICS[3]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [loadedMedia, setLoadedMedia] = useState<Record<string, boolean>>({});
  const [emojiOpen, setEmojiOpen] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const fail = useCallback((cause: unknown) => {
    if (cause instanceof SupportChatError) {
      setError(cause.message);
      if (cause.quota) setQuota(cause.quota);
      if (cause.code === "SIGN_IN_REQUIRED") setAuthenticated(false);
      // A chat closed by an operator must not keep accepting input.
      if (cause.code === "SESSION_CLOSED") {
        setSession((current) => (current ? { ...current, status: "closed" } : current));
      }
      // The room is gone: expired, or never persisted by the server. Drop back
      // to the topic picker so the customer can start again instead of being
      // stranded in a panel that cannot send anything. The daily allowance is
      // charged only when a chat is CLOSED, so retrying costs them nothing.
      if (cause.code === "SESSION_NOT_FOUND") setSession(null);
      return;
    }
    setError("មានបញ្ហាបណ្តោះអាសន្ន។ សូមព្យាយាមម្ដងទៀត។");
  }, []);

  /* Load quota + any conversation already in progress. */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSupportState()
      .then((state) => {
        if (cancelled) return;
        setAuthenticated(state.authenticated);
        setMemberName(state.displayName?.trim() ? state.displayName.trim() : null);
        setQuota(state.quota);
        setSession(state.session);
      })
      .catch((cause) => {
        if (!cancelled) fail(cause);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, fail]);

  /* Poll for operator replies while the room is live. */
  useEffect(() => {
    if (!open || !session || session.status === "closed") return;
    const id = session.id;
    const timer = window.setInterval(() => {
      pollSupportChat(id)
        .then((result) => setSession(result.session))
        .catch((cause) => {
          // Polling is best-effort: only surface terminal outcomes.
          if (cause instanceof SupportChatError && cause.status >= 400 && cause.status !== 429) fail(cause);
        });
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [open, session, fail]);

  /* Keep the newest message in view. */
  useEffect(() => {
    const node = listRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [session?.messages.length, session?.adminTyping]);

  /* Never leave the microphone hot when the panel closes. */
  useEffect(() => {
    if (open) return;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    setRecording(false);
    setEmojiOpen(false);
  }, [open]);

  const startChat = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await openSupportChat({
        topic: seedOrderRef ? `ជំនួយសម្រាប់ការទិញ ${seedOrderRef}` : topic,
        orderRef: seedOrderRef ?? "",
      });
      setSession(result.session);
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }, [topic, seedOrderRef, fail]);

  const submitText = useCallback(async () => {
    const text = draft.trim();
    if (!session || !text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await sendSupportText(session.id, text.slice(0, supportTextMaxLength));
      setSession(result.session);
      setDraft("");
      setEmojiOpen(false);
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }, [draft, session, busy, fail]);

  const insertEmoji = useCallback((emoji: string) => {
    setDraft((current) => `${current}${emoji}`.slice(0, supportTextMaxLength));
  }, []);

  const sendBlob = useCallback(
    async (blob: Blob, kind: "image" | "voice") => {
      if (!session) return;
      const type = baseMimeType(blob.type) || (kind === "image" ? "image/jpeg" : "audio/webm");
      const allowed = kind === "image" ? supportImageTypes : supportAudioTypes;
      const maxBytes = kind === "image" ? supportImageMaxBytes : supportAudioMaxBytes;

      if (allowed.indexOf(type) < 0) {
        setError("ប្រភេទឯកសារនេះមិនអនុញ្ញាតទេ។");
        return;
      }
      if (blob.size > maxBytes) {
        setError("ឯកសារធំពេក។ សូមបញ្ជូនឯកសារតូចជាងនេះ។");
        return;
      }

      setBusy(true);
      setError(null);
      try {
        const dataUrl = await blobToDataUrl(blob);
        const result = await sendSupportMedia({ sessionId: session.id, kind, dataUrl, contentType: type });
        setSession(result.session);
      } catch (cause) {
        fail(cause);
      } finally {
        setBusy(false);
      }
    },
    [session, fail],
  );

  const toggleRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
      return;
    }
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices) {
      setError("ឧបករណ៍នេះមិនអាចថតសម្លេងបានទេ។");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(stream);
      chunksRef.current = [];
      next.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      next.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: next.mimeType || "audio/webm" });
        chunksRef.current = [];
        if (blob.size > 0) void sendBlob(blob, "voice");
      };
      recorderRef.current = next;
      next.start();
      setRecording(true);
    } catch {
      setError("សូមអនុញ្ញាតការប្រើមីក្រូហ្វូន។");
    }
  }, [sendBlob]);

  const endChat = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      const result = await closeSupportChat(session.id);
      setQuota(result.quota);
      setSession((current) => (current ? { ...current, status: "closed" } : current));
    } catch (cause) {
      fail(cause);
    } finally {
      setBusy(false);
    }
  }, [session, fail]);

  if (!open) return null;

  const messages = session ? session.messages : [];
  const last = messages.length > 0 ? messages[messages.length - 1] : null;
  let mood: SupportOrbMood | null = null;
  if (busy) mood = "busy";
  else if (session && session.status === "waiting") mood = "joining";
  else if (session && session.status === "active" && session.adminTyping) mood = "typing";
  else if (session && session.status === "active" && last && last.role === "user") mood = "waiting";

  return (
    <div className="zs-chat" role="dialog" aria-modal="true" aria-label="ជំនួយផ្ទាល់">
      <div className="zs-chat__scrim" onClick={onClose} />
      <section className="zs-chat__panel">
        <header className="zs-chat__head">
          <span className="zs-chat__dot" aria-hidden="true" />
          <div className="zs-chat__ident">
            <p className="zs-chat__title">ជំនួយផ្ទាល់ Zurs</p>
            <p className="zs-chat__sub">
              {authenticated ? (
                <span className="zs-chat__who">
                  <VerifiedName name={memberName || "ZURS Member"} size={15} className="zs-chat__member" />
                  {session
                    ? session.status === "closed"
                      ? " · ការឆាតបានបិទ"
                      : session.status === "waiting"
                        ? " · កំពុងរង់ចាំក្រុមជំនួយ"
                        : " · ភ្ជាប់ជាមួយក្រុមជំនួយ"
                    : " · សូមស្វាគមន៍"}
                </span>
              ) : session
                ? session.status === "closed"
                  ? "ការឆាតបានបិទ"
                  : session.status === "waiting"
                    ? "កំពុងរង់ចាំក្រុមជំនួយ"
                    : "ភ្ជាប់ជាមួយក្រុមជំនួយ"
                : "ឆ្លើយតបក្នុងពេលធ្វើការ"}
            </p>
          </div>
          {session && session.status !== "closed" ? (
            <button type="button" className="zs-chat__end" onClick={() => void endChat()} disabled={busy}>
              បញ្ចប់
            </button>
          ) : null}
          <button type="button" className="zs-chat__close" onClick={onClose} aria-label="បិទ">
            <X size={18} />
          </button>
        </header>

        <div className="zs-chat__body" ref={listRef}>
          {loading ? (
            <div className="zs-chat__center">
              <SupportOrb mood="busy" />
            </div>
          ) : !authenticated ? (
            <div className="zs-chat__center zs-chat__notice">
              <ChatWarmth mood="signin" />
              <p className="zs-chat__introTitle">សូមចូលគណនីជាមុនសិន</p>
              <p>ការឆាតជាមួយក្រុមជំនួយត្រូវការគណនី ដើម្បីយើងដឹងថាជាអ្នកណា។</p>
              <a className="zs-chat__cta" href="/api/auth/google?returnTo=%2Fchat">
                <span className="zs-chat__point" aria-hidden="true">
                  <AnimatedEmoji emoji="👉" size={22} />
                </span>
                ចូលគណនី
              </a>
            </div>
          ) : !session ? (
            quota && quota.blocked ? (
              <div className="zs-chat__center zs-chat__notice">
                <ChatWarmth mood="quota" />
                <p className="zs-chat__introTitle">អ្នកបានប្រើសិទ្ធិឆាតសម្រាប់ថ្ងៃនេះរួចហើយ</p>
                <TelegramFallback resetsInSeconds={quota.resetsInSeconds} />
              </div>
            ) : (
              <div className="zs-chat__intro">
                <ChatWarmth mood="welcome" />
                <p className="zs-chat__introTitle">ត្រូវការជំនួយអ្វី?</p>
                <p className="zs-chat__introNote">អ្នកអាចឆាតជាមួយក្រុមជំនួយ ១ ដងក្នុងមួយថ្ងៃ។</p>
                {seedOrderRef ? (
                  <p className="zs-chat__seed">ការទិញ {seedOrderRef}</p>
                ) : (
                  <div className="zs-chat__topics">
                    {TOPICS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className={`zs-chat__topic${topic === item ? " is-active" : ""}`}
                        onClick={() => setTopic(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" className="zs-chat__cta" onClick={() => void startChat()} disabled={busy}>
                  {busy ? "កំពុងបើក…" : "ចាប់ផ្ដើមឆាត"}
                </button>
              </div>
            )
          ) : (
            <ul className="zs-chat__list">
              {messages.map((message) => {
                const clusters = message.kind === "text" && message.text ? splitEmojiOnly(message.text) : null;
                if (clusters) {
                  return (
                    <li key={message.id} className={`zs-msg zs-msg--${message.role} zs-msg--emoji`}>
                      <div className="zs-msg__emojiRow">
                        {clusters.map((emoji, index) => (
                          <AnimatedEmoji key={`${message.id}-${index}`} emoji={emoji} size={clusters.length === 1 ? 80 : 56} />
                        ))}
                      </div>
                      <time className="zs-msg__time" dateTime={message.at}>
                        {timeOf(message.at)}
                      </time>
                    </li>
                  );
                }
                return (
                <li key={message.id} className={`zs-msg zs-msg--${message.role} zs-msg--${message.kind}`}>
                  <div className="zs-msg__bubble">
                    {message.kind === "image" && message.mediaUrl ? (
                      <img
                        src={message.mediaUrl}
                        alt={message.text || "រូបភាព"}
                        loading="lazy"
                        className={`zs-msg__img${loadedMedia[message.id] ? " is-loaded" : ""}`}
                        onLoad={() => setLoadedMedia((current) => ({ ...current, [message.id]: true }))}
                      />
                    ) : null}
                    {message.kind === "voice" && message.mediaUrl ? (
                      <audio className="zs-msg__audio" controls preload="metadata" src={message.mediaUrl} />
                    ) : null}
                    {message.text ? <p className="zs-msg__text">{message.text}</p> : null}
                  </div>
                  <time className="zs-msg__time" dateTime={message.at}>
                    {timeOf(message.at)}
                  </time>
                </li>
                );
              })}

              {mood ? (
                <li className="zs-msg zs-msg--orb">
                  <SupportOrb mood={mood} />
                </li>
              ) : null}

              {session.status === "closed" ? (
                <li className="zs-chat__closed">
                  <ChatWarmth mood="closed" />
                  <p>ការឆាតនេះត្រូវបានបិទ។ ការរាយការណ៍លើកក្រោយត្រូវបើកការឆាតថ្មី។</p>
                  <TelegramFallback
                    resetsInSeconds={quota && quota.blocked ? quota.resetsInSeconds : null}
                  />
                </li>
              ) : null}
            </ul>
          )}
        </div>

        {error ? (
          <p className="zs-chat__error" role="alert">
            {error}
          </p>
        ) : null}

        {session && session.status !== "closed" ? (
          <footer className="zs-chat__composer">
            {/* Image, camera and voice are parked until the media pipeline is
              * re-enabled. They stay visible but greyed and genuinely inert, so
              * text is the only thing that can leave this composer. */}
            <label className="zs-chat__soon" title={MEDIA_PARKED_HINT} aria-label={MEDIA_PARKED_HINT}>
              <ImageIcon size={16} aria-hidden="true" />
              <input
                type="file"
                accept="image/*"
                className="zs-chat__soonFile"
                disabled
                onChange={(event) => {
                  const picked = event.target.files && event.target.files[0];
                  if (picked) void sendBlob(picked, "image");
                }}
              />
            </label>
            <label className="zs-chat__soon" title={MEDIA_PARKED_HINT} aria-label={MEDIA_PARKED_HINT}>
              <Camera size={16} aria-hidden="true" />
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="zs-chat__soonFile"
                disabled
                onChange={(event) => {
                  const picked = event.target.files && event.target.files[0];
                  if (picked) void sendBlob(picked, "image");
                }}
              />
            </label>
            <div className="zs-chat__emojipick">
              <button
                type="button"
                className={`zs-chat__emojiBtn${emojiOpen ? " is-open" : ""}`}
                onClick={() => setEmojiOpen((open) => !open)}
                aria-label="Emoji"
                aria-expanded={emojiOpen}
              >
                <Smile size={16} aria-hidden="true" />
              </button>
              {emojiOpen ? (
                <div className="zs-chat__emojiTray" role="listbox" aria-label="Emoji">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="zs-chat__emojiChoice"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <textarea
              className="zs-chat__input"
              rows={1}
              value={draft}
              maxLength={supportTextMaxLength}
              placeholder={recording ? "កំពុងថតសម្លេង…" : "សរសេរសារ…"}
              disabled={busy || recording}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submitText();
                }
              }}
            />
            <button
              type="button"
              className={`zs-chat__mic zs-chat__soon${recording ? " is-live" : ""}`}
              onClick={() => void toggleRecording()}
              disabled
              title={MEDIA_PARKED_HINT}
              aria-label={MEDIA_PARKED_HINT}
            >
              {recording ? <Square size={16} /> : <Mic size={16} />}
            </button>
            <button
              type="button"
              className="zs-chat__send"
              onClick={() => void submitText()}
              disabled={busy || recording || draft.trim().length === 0}
              aria-label="ផ្ញើ"
            >
              <Send size={16} />
            </button>
          </footer>
        ) : null}
      </section>
    </div>
  );
}
