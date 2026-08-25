import { CheckCircle2, PencilLine } from "lucide-react";

function masked(value: string) { return value.length > 4 ? `•••${value.slice(-4)}` : "•••"; }

export function VerifiedAccountBar({ playerName, fields, onEdit }: { playerName: string; fields: Record<string, string>; onEdit: () => void }) {
  const ids = Object.entries(fields).filter(([key]) => /id|user|account|player|zone|server/i.test(key));
  const visibleValues = (ids.length ? ids : Object.entries(fields)).slice(0, 2);
  const summary = visibleValues.length ? visibleValues.map(([, value]) => masked(value)).join(" · ") : "ID ដែលបានបញ្ជាក់";
  return <aside className="fixed left-1/2 top-[calc(env(safe-area-inset-top)+4.3rem)] z-[70] flex w-[min(calc(100vw-1.25rem),38rem)] -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-white/90 px-3 py-2.5 shadow-xl shadow-slate-900/10 backdrop-blur-xl" aria-label="Verified account summary"><div className="min-w-0"><p className="flex items-center gap-1 text-[10px] font-bold tracking-[0.12em] text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />បានបញ្ជាក់</p><p className="truncate text-sm font-extrabold text-slate-950">{playerName}</p><p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{summary}</p></div><button type="button" onClick={onEdit} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-extrabold text-white"><PencilLine className="h-4 w-4" />កែ ID</button></aside>;
}
