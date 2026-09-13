import { CircleAlert, Check } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { khmerDiamondCopy } from "@/lib/khmerDiamondCopy";
import { packageClickAlertCopy } from "@/lib/packageClickAlert";

export const packageClickAlertAgreeKh = "យល់ព្រម";

type AlertPackage = {
  label: string;
  amountLabel: string;
  priceLabel: string;
  quantity?: number;
};

export function PackageClickAlert({ open, item, onClose }: { open: boolean; item: AlertPackage | null; onClose: () => void }) {
  const copy = item ? packageClickAlertCopy(item) : null;

  useEffect(() => {
    if (!open || !copy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("refund-dialog-open");
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("refund-dialog-open");
    };
  }, [copy, onClose, open]);

  if (!open || !copy || typeof document === "undefined") return null;

  return createPortal(
    <div className="refund-dialog package-click-alert" role="alertdialog" aria-modal="true" aria-labelledby="package-click-alert-title" aria-describedby="package-click-alert-body">
      <button type="button" className="refund-dialog__backdrop" aria-label={packageClickAlertAgreeKh} onClick={onClose} />
      <section className="refund-dialog__panel">
        <header className="refund-dialog__head">
          <span className="refund-dialog__mark" aria-hidden="true"><CircleAlert className="h-5 w-5" /></span>
          <div className="min-w-0">
            <p className="refund-dialog__eyebrow">PACKAGE NOTE</p>
            <h2 id="package-click-alert-title" className="refund-dialog__title">{khmerDiamondCopy(copy.title)}</h2>
          </div>
        </header>
        <p id="package-click-alert-body" className="refund-dialog__body package-click-alert__body">{copy.body}</p>
        <div className="refund-dialog__summary">
          <span className="refund-dialog__summary-label">កញ្ចប់</span>
          <strong className="refund-dialog__summary-value">{khmerDiamondCopy(copy.title)}</strong>
          {copy.priceLabel ? <span className="refund-dialog__summary-price">{copy.priceLabel}</span> : null}
        </div>
        <div className="refund-dialog__actions package-click-alert__actions">
          <button type="button" className="refund-dialog__agree" onClick={onClose}>
            <Check className="h-4 w-4" />
            {packageClickAlertAgreeKh}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export default PackageClickAlert;
