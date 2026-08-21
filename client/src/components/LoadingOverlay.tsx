import { AnimatedGlyph } from "@/components/AnimatedGlyph";

export function LoadingOverlay({ open, label }: { open: boolean; label: string }) {
  if (!open) return null;
  return <div className="loading-overlay fixed inset-0 z-[80] grid place-items-center bg-slate-950/20 p-5 backdrop-blur-[2px]" role="status" aria-live="polite" aria-label={label}>
    <div className="glass-panel motion-reveal flex min-w-52 flex-col items-center rounded-3xl px-7 py-6 text-center shadow-2xl shadow-indigo-950/20">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-50 text-indigo-700"><AnimatedGlyph name="activity" size={38} color="#4f46e5" /></div>
      <p className="mt-4 text-sm font-bold text-slate-900">{label}</p>
      <p className="mt-1 text-[11px] text-slate-500">ZURS STORE</p>
    </div>
  </div>;
}
