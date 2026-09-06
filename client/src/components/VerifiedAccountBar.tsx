import { CheckCircle2, PencilLine } from "lucide-react";
import { RefObject } from "react";

function masked(value: string) { return value.length > 4 ? `•••${value.slice(-4)}` : "•••"; }

type VerifiedAccountBarProps = {
  playerName: string;
  fields: Record<string, string>;
  onEdit: () => void;
  anchorRef?: RefObject<HTMLElement | null>;
  collapsed: boolean;
  /** Round 9: public Telegram profile picture, when the handle was verified. */
  photoUrl?: string | null;
};

export function VerifiedAccountBar({ playerName, fields, onEdit, anchorRef, collapsed, photoUrl }: VerifiedAccountBarProps) {
  const ids = Object.entries(fields).filter(([key]) => /id|user|account|player|zone|server/i.test(key));
  const visibleValues = (ids.length ? ids : Object.entries(fields)).slice(0, 2);
  const summary = visibleValues.length ? visibleValues.map(([, value]) => masked(value)).join(" · ") : "ID ដែលបានបញ្ជាក់";

  return <aside ref={anchorRef} className={`verified-account-card identity-flow-card ${collapsed ? "identity-flow-card--visible" : "identity-flow-card--hidden"} mt-4 flex items-center justify-between gap-3 rounded-2xl p-3 sm:p-3.5`} aria-label="Verified account summary">
    {photoUrl ? <img src={photoUrl} alt={playerName} className="tg-profile__avatar" loading="lazy" decoding="async" referrerPolicy="no-referrer" /> : <span className="verified-account-card__mark" aria-hidden="true"><CheckCircle2 className="h-5 w-5" /></span>}
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold tracking-[0.12em] text-emerald-700">គណនីបានបញ្ជាក់</p>
      <p className="truncate text-sm font-extrabold text-slate-950">{playerName}</p>
      <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{summary}</p>
    </div>
    <button type="button" onClick={onEdit} className="identity-change-button inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-extrabold"><PencilLine className="h-4 w-4" />ប្ដូរ ID</button>
  </aside>;
}
