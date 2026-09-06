import { AlertTriangle, Check, MessagesSquare, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Round 9: the buyer must acknowledge the no-refund policy BEFORE the checkout
 * screen opens. The dialog also offers a direct route into live support, because
 * the whole point of the warning is that an unsure buyer should ask first.
 */
export const refundPolicyTitleKh = "សេវាកម្មឌីជីថល · គ្មាន Refund";
export const refundPolicyBodyKh =
  "សេវាកម្មឌីជីថលមិនអាចប្ដូរប្រាក់វិញបានទេ គ្មានករណី refund ទេ។ បើអ្នកមិនច្បាស់ត្រង់ប្រការណាមួយ សូមឆាតជាមួយ support ផ្ទាល់មុននឹងបន្ត។";
export const refundPolicyAgreeKh = "យល់ព្រម";
export const refundPolicyDeclineKh = "មិនយល់ព្រម";
export const refundPolicySupportKh = "ឆាតសួរ Support";
export const refundPolicySupportHref = "/chat?topic=refund";

export type RefundPolicyDialogProps = {
  open: boolean;
  productLabel?: string | null;
  priceLabel?: string | null;
  onAgree: () => void;
  onDecline: () => void;
};

export function RefundPolicyDialog({ open, productLabel, priceLabel, onAgree, onDecline }: RefundPolicyDialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDecline();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Round 10: the bottom action bar and the mobile tab bar slide away while this
    // step is open, so the bar visibly becomes the BEFORE PAYMENT dialog instead
    // of a second card appearing underneath it.
    document.body.classList.add("refund-dialog-open");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("refund-dialog-open");
    };
  }, [onDecline, open]);

  if (!open || typeof document === "undefined") return null;

  // Round 10: portalled to <body>. Rendered inside the storefront shell it was
  // captured by ".zurs-dotted-shell > :not(.zurs-particle-field) { position: relative;
  // z-index: 1 }" in index.css, which out-specified position: fixed and dropped the
  // dialog into the page flow below the footer where buyers never noticed it.
  return createPortal(
    <div className="refund-dialog" role="dialog" aria-modal="true" aria-labelledby="refund-dialog-title">
      <button type="button" className="refund-dialog__backdrop" aria-label={refundPolicyDeclineKh} onClick={onDecline} />
      <section className="refund-dialog__panel">
        <header className="refund-dialog__head">
          <span className="refund-dialog__mark" aria-hidden="true"><AlertTriangle className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="refund-dialog__eyebrow">BEFORE PAYMENT</p>
            <h2 id="refund-dialog-title" className="refund-dialog__title">{refundPolicyTitleKh}</h2>
          </div>
        </header>

        <p className="refund-dialog__body">{refundPolicyBodyKh}</p>

        {productLabel ? (
          <div className="refund-dialog__summary">
            <span className="refund-dialog__summary-label">កញ្ចប់</span>
            <strong className="refund-dialog__summary-value">{productLabel}</strong>
            {priceLabel ? <span className="refund-dialog__summary-price">{priceLabel}</span> : null}
          </div>
        ) : null}

        <a className="refund-dialog__support" href={refundPolicySupportHref}>
          <MessagesSquare className="h-4 w-4" />
          {refundPolicySupportKh}
        </a>

        <div className="refund-dialog__actions">
          <button type="button" className="refund-dialog__decline" onClick={onDecline}>
            <X className="h-4 w-4" />
            {refundPolicyDeclineKh}
          </button>
          <button type="button" className="refund-dialog__agree" onClick={onAgree}>
            <Check className="h-4 w-4" />
            {refundPolicyAgreeKh}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default RefundPolicyDialog;
