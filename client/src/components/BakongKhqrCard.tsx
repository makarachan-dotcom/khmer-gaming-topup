import { ReactNode } from "react";

/**
 * Official Bakong KHQR card presentation. Mirrors the National Bank of
 * Cambodia's KHQR layout: red header with the italic KHQR wordmark and a
 * folded corner, merchant name, prominent amount, a dashed ticket divider
 * with side notches, then the QR itself. Purely presentational — the QR
 * image and money figures always come from the payment ledger.
 */
export function BakongKhqrCard({ merchantName, amountLabel, currencyLabel, qr, paid = false, footer }: {
  merchantName: string;
  amountLabel: string;
  currencyLabel: string;
  qr: ReactNode;
  paid?: boolean;
  footer?: ReactNode;
}) {
  return (
    <div className={`bakong-card ${paid ? "bakong-card--paid" : ""}`}>
      <span className="bakong-card__fold" aria-hidden />
      <div className="bakong-card__header">
        <span className="bakong-card__logo">KHQR</span>
        <span className="bakong-card__dot" aria-hidden />
      </div>
      <div className="bakong-card__body">
        <p className="bakong-card__merchant">{merchantName}</p>
        <p className="bakong-card__amount">
          <strong>{amountLabel}</strong>
          <span>{currencyLabel}</span>
        </p>
        <div className="bakong-card__divider" aria-hidden />
        <div className="bakong-card__qr">{qr}</div>
        {footer ? <p className="bakong-card__hint">{footer}</p> : null}
      </div>
    </div>
  );
}
