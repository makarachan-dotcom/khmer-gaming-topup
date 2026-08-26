import { trpc } from "@/lib/trpc";
import { Headset, MessageCircle, X } from "lucide-react";
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

function ContactAdminSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);
  const admins = trpc.support.contactAdmins.useQuery(undefined, { enabled: mounted, staleTime: 30_000, refetchInterval: 15_000 });

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

  const cards = useMemo(() => (admins.data ?? []).filter((admin) => admin.isVisible) as ContactAdmin[], [admins.data]);
  if (!mounted) return null;

  return (
    <div className={`contact-admin-layer ${visible ? "contact-admin-layer--open" : ""}`} role="presentation">
      <div className="contact-admin-backdrop" aria-hidden="true" onMouseDown={onClose} />
      <section className="contact-admin-sheet" role="dialog" aria-modal="true" aria-labelledby="contact-admin-heading">
        <div className="contact-admin-sheet__handle" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="zurs-eyebrow">ZURS SUPPORT</p>
            <h2 id="contact-admin-heading" className="mt-1 font-display text-2xl font-bold text-slate-950">ជំនួយពី Admin</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">ជ្រើសរើស Admin ម្នាក់ ហើយបន្តទៅ Telegram ដោយផ្ទាល់។ ម៉ោងធ្វើការគិតតាមម៉ោងកម្ពុជា។</p>
          </div>
          <button type="button" onClick={onClose} className="contact-admin-sheet__close" aria-label="បិទផ្ទាំងទំនាក់ទំនង"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 space-y-3">
          {admins.isLoading ? <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs font-semibold text-slate-500">កំពុងរៀបចំព័ត៌មាន Admin…</div> : cards.length ? cards.map((admin) => <ContactAdminCard key={admin.id} admin={admin} />) : <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs leading-5 text-slate-500">មិនទាន់មាន Admin សម្រាប់ទំនាក់ទំនងទេ។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។</div>}
        </div>
      </section>
    </div>
  );
}

function ContactAdminCard({ admin }: { admin: ContactAdmin }) {
  const online = isAdminWorkingNow(admin.workingHoursStart, admin.workingHoursEnd);
  const username = admin.telegramUsername.replace(/^@+/, "");
  return (
    <article className="contact-admin-card">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="contact-admin-avatar">
          {admin.photoUrl ? <img src={admin.photoUrl} alt={admin.displayName} className="h-full w-full object-cover" /> : <span>{initials(admin.displayName)}</span>}
          <span className={`contact-admin-status-dot ${online ? "contact-admin-status-dot--online" : ""}`} aria-label={online ? "កំពុង online" : "ក្រៅម៉ោង"} />
        </div>
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold text-slate-950">{admin.displayName}</h3>
          <p className={`mt-0.5 text-[11px] font-bold ${online ? "text-emerald-700" : "text-slate-500"}`}>{online ? "កំពុង online" : "ក្រៅម៉ោងធ្វើការ"}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-1.5 text-[11px] leading-5 text-slate-600">
        <p><span className="font-bold text-slate-800">ម៉ោងធ្វើការ៖</span> {admin.workingHoursStart} – {admin.workingHoursEnd}</p>
        <p><span className="font-bold text-slate-800">ឆ្លើយតបជាធម្មតា៖</span> {admin.replyTimeText}</p>
      </div>
      <a className="contact-admin-telegram" href={`https://t.me/${encodeURIComponent(username)}`} target="_blank" rel="noreferrer" aria-label={`Telegram @${username}`}>
        <MessageCircle className="h-4 w-4" />
        <span className="truncate">Telegram: @{username}</span>
      </a>
    </article>
  );
}

export function ContactAdminControl({ paymentBarVisible }: { paymentBarVisible: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`contact-admin-fab ${paymentBarVisible ? "contact-admin-fab--payment" : ""}`} aria-label="ទំនាក់ទំនង Admin" aria-haspopup="dialog" aria-expanded={open}>
        <Headset className="h-4.5 w-4.5" strokeWidth={2.15} />
        <span className="contact-admin-fab__label">ជំនួយ</span>
      </button>
      <ContactAdminSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
