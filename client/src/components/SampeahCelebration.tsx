import { useEffect } from "react";

const petalGlyphs = ["❀", "✿", "❁", "✾", "❃"] as const;
const celebrationDurationMs = 10_000;

/**
 * Khmer sampeah (សំពះ) payment-success celebration. A full-screen popup with
 * bowing sampeah hands, falling jasmine petals, and golden rings — shown for
 * ten seconds after a payment is confirmed, then dismissed automatically.
 */
export function SampeahCelebration({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(onClose, celebrationDurationMs);
    return () => window.clearTimeout(timer);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="sampeah-celebration" role="dialog" aria-modal="true" aria-label="ការទូទាត់ជោគជ័យ">
      <div className="sampeah-celebration__backdrop" aria-hidden />
      <div className="sampeah-celebration__petals" aria-hidden>
        {Array.from({ length: 16 }, (_, index) => (
          <span key={index} className="sampeah-petal" style={{ "--petal-index": index } as React.CSSProperties}>
            {petalGlyphs[index % petalGlyphs.length]}
          </span>
        ))}
      </div>
      <section className="sampeah-card">
        <span className="sampeah-card__ring" aria-hidden />
        <span className="sampeah-card__ring sampeah-card__ring--outer" aria-hidden />
        <div className="sampeah-card__hands" aria-hidden>🙏</div>
        <p className="sampeah-card__kbach" aria-hidden>❖ ❖ ❖</p>
        <h2>អរគុណច្រើន!</h2>
        <p className="sampeah-card__copy">ការទូទាត់របស់អ្នកត្រូវបានបញ្ជាក់ដោយជោគជ័យ។<br />ZURS សូមសំពះអរគុណយ៉ាងជ្រាលជ្រៅ 🙏</p>
        <span className="sampeah-card__badge">PAYMENT CONFIRMED</span>
        <span className="sampeah-card__timer" style={{ "--sampeah-duration": `${celebrationDurationMs}ms` } as React.CSSProperties} aria-hidden />
        <button type="button" className="sampeah-card__close" onClick={onClose}>បិទ</button>
      </section>
    </div>
  );
}
