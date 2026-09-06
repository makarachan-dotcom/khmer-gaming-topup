import { trpc } from "@/lib/trpc";
import { toWebsiteMediaUrl } from "@/lib/mediaUrl";
import { subscribeToPublicAssetChanges } from "@/lib/publicAssetBroadcast";
import { Clock3, Headset, MessageCircle, Timer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type ContactAdmin = {
  id: string;
  displayName: string;
  telegramUsername: string;
  workingHoursStart: string;
  workingHoursEnd: string;
  replyTimeText: string;
  photoUrl: string | null;
  isVisible: boolean;
};

function minutesFromTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function isAdminWorkingNow(start: string, end: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Phnom_Penh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const current = hour * 60 + minute;
  const startMinutes = minutesFromTime(start);
  const endMinutes = minutesFromTime(end);
  if (startMinutes === endMinutes) return true;
  return startMinutes < endMinutes ? current >= startMinutes && current < endMinutes : current >= startMinutes || current < endMinutes;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase()).join("") || "A";
}

/**
 * Avatar that NEVER shows the browser's broken-image glyph.
 * If the photo URL 404s/502s (e.g. stale storage), we fall back to initials.
 * This was the cause of the floating "?" circles in the support sheet.
 */
function ContactAdminAvatar({ admin, online }: { admin: ContactAdmin; online: boolean }) {
  const [failed, setFailed] = useState(false);
  const src = admin.photoUrl ? toWebsiteMediaUrl(admin.photoUrl) : null;
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="contact-admin-avatar" aria-hidden="true">
      <div className="contact-admin-avatar__clip">
        {src && !failed ? (
          <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        ) : (
          <span className="contact-admin-avatar__initials">{initials(admin.displayName)}</span>
        )}
      </div>
      <span className={`contact-admin-status-dot ${online ? "contact-admin-status-dot--online" : ""}`} />
    </div>
  );
}

function ContactAdminSheet({ open, onClose, paymentBarVisible }: { open: boolean; onClose: () => void; paymentBarVisible: boolean }) {
  const utils = trpc.useUtils();
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const admins = trpc.support.contactAdmins.useQuery(undefined, { enabled: mounted, staleTime: 0, refetchInterval: 5_000 });

  useEffect(() => subscribeToPublicAssetChanges((area) => { if (area === "contact-admins") void utils.support.contactAdmins.invalidate(); }), [utils]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const frame = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(frame);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), 280);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  // Lock background scroll while the sheet is open (prevents the storefront from
  // scrolling underneath on iOS and the sheet content jumping around).
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const cards = useMemo(() => (admins.data ?? []).filter((admin) => admin.isVisible) as ContactAdmin[], [admins.data]);
  if (!mounted) return null;

  return (
    <div className={`contact-admin-layer ${visible ? "contact-admin-layer--open" : ""} ${paymentBarVisible ? "contact-admin-layer--payment" : ""}`} role="presentation">
      <div className="contact-admin-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <section className="contact-admin-sheet" role="dialog" aria-modal="true" aria-labelledby="contact-admin-heading">
        <div className="contact-admin-sheet__handle" aria-hidden="true" />
        <header className="contact-admin-sheet__header">
          <div className="min-w-0">
            <p className="zurs-eyebrow">ZURS SUPPORT</p>
            <h2 id="contact-admin-heading" className="contact-admin-sheet__title">ជំនួយពី Admin</h2>
            <p className="contact-admin-sheet__lead">ជ្រើសរើស Admin ម្នាក់ ហើយបន្តទៅ Telegram ដោយផ្ទាល់។ ម៉ោងធ្វើការគិតតាមម៉ោងកម្ពុជា។</p>
          </div>
          <button type="button" onClick={onClose} className="contact-admin-sheet__close" aria-label="បិទផ្ទាំងទំនាក់ទំនង"><X className="h-5 w-5" /></button>
        </header>
        <div className="contact-admin-sheet__list">
          {admins.isLoading ? (
            <>
              <div className="contact-admin-card contact-admin-card--skeleton" aria-hidden="true" />
              <div className="contact-admin-card contact-admin-card--skeleton" aria-hidden="true" />
            </>
          ) : cards.length ? (
            cards.map((admin, index) => <ContactAdminCard key={admin.id} admin={admin} index={index} />)
          ) : (
            <div className="contact-admin-empty">មិនទាន់មាន Admin សម្រាប់ទំនាក់ទំនងទេ។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។</div>
          )}
        </div>
      </section>
    </div>
  );
}

function ContactAdminCard({ admin, index }: { admin: ContactAdmin; index: number }) {
  const online = isAdminWorkingNow(admin.workingHoursStart, admin.workingHoursEnd);
  const username = admin.telegramUsername.replace(/^@+/, "");
  return (
    <article className="contact-admin-card" style={{ ["--i" as string]: index }}>
      <div className="contact-admin-card__identity">
        <ContactAdminAvatar admin={admin} online={online} />
        <div className="min-w-0 flex-1">
          <h3 className="contact-admin-card__name">{admin.displayName}</h3>
          <p className={`contact-admin-card__state ${online ? "is-online" : ""}`}>
            <span className="contact-admin-card__pulse" aria-hidden="true" />
            {online ? "កំពុង online" : "ក្រៅម៉ោងធ្វើការ"}
          </p>
        </div>
      </div>
      <dl className="contact-admin-card__meta">
        <div>
          <dt><Clock3 className="h-3.5 w-3.5" /> ម៉ោងធ្វើការ</dt>
          <dd>{admin.workingHoursStart} – {admin.workingHoursEnd}</dd>
        </div>
        <div>
          <dt><Timer className="h-3.5 w-3.5" /> ឆ្លើយតបជាធម្មតា</dt>
          <dd>{admin.replyTimeText}</dd>
        </div>
      </dl>
      <a className="contact-admin-telegram" href={`https://t.me/${encodeURIComponent(username)}`} target="_blank" rel="noreferrer" aria-label={`Telegram @${username}`}>
        <MessageCircle className="h-4 w-4 shrink-0" />
        <span className="truncate">Telegram: @{username}</span>
      </a>
    </article>
  );
}

export function ContactAdminControl({ paymentBarVisible, hideOnMobile = false }: { paymentBarVisible: boolean; hideOnMobile?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`contact-admin-fab ${paymentBarVisible ? "contact-admin-fab--payment" : ""} ${hideOnMobile ? "contact-admin-fab--hide-mobile" : ""}`} aria-label="ទំនាក់ទំនង Admin" aria-haspopup="dialog" aria-expanded={open}>
        <Headset className="h-4.5 w-4.5" strokeWidth={2.15} />
        <span className="contact-admin-fab__label">ជំនួយ</span>
      </button>
      <ContactAdminSheet open={open} onClose={() => setOpen(false)} paymentBarVisible={paymentBarVisible} />
    </>
  );
}
