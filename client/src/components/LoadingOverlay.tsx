import { OutlineLoader } from "@/components/OutlineLoader";

export function LoadingOverlay({ open, label }: { open: boolean; label: string }) {
  if (!open) return null;
  return <div className="loading-overlay pointer-events-none fixed inset-0 z-[80] grid place-items-center p-5" role="status" aria-live="polite" aria-label={label}>
    <div className="motion-reveal flex min-w-40 flex-col items-center text-center">
      <OutlineLoader size={46} color="#0f172a" />
      <p className="mt-3 text-sm font-bold text-slate-950">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-slate-600">ZURS STORE</p>
    </div>
  </div>;
}
