import { OutlineLoader } from "@/components/OutlineLoader";

export function LoadingOverlay({ open, label }: { open: boolean; label: string }) {
  if (!open) return null;
  return <div className="loading-overlay fixed inset-0 z-[80] grid place-items-center p-5" role="status" aria-live="polite" aria-label={label}>
    <div className="motion-reveal flex min-w-40 flex-col items-center text-center drop-shadow-[0_3px_8px_rgba(15,23,42,0.16)]">
      <OutlineLoader size={46} color="#4f46e5" />
      <p className="mt-3 text-sm font-bold text-slate-950">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-600">ZURS STORE</p>
    </div>
  </div>;
}
