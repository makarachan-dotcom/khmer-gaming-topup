import { useState } from "react";
import { Check, Copy, Eye, EyeOff, KeyRound, Link2, Mail, Ticket } from "lucide-react";
import { ServiceLogo } from "@/components/BrandMark";
import type { PartnerDelivery } from "@shared/partnerDelivery";

const METHOD: Record<PartnerDelivery["method"], { kh: string; en: string }> = {
  COUPON: { kh: "លេខកូដ Coupon", en: "Coupon code" },
  LINK: { kh: "តំណ Activation", en: "Activation link" },
  READY_ACCOUNT: { kh: "គណនីរួចរាល់", en: "Ready account" },
  NOTE: { kh: "ព័ត៌មានសេវា", en: "Service details" },
};

function CopyRow({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(!secret);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; the value is still on screen */
    }
  };
  return (
    <div className="zurs-vault__row">
      <p className="zurs-vault__label">{label}</p>
      <div className="zurs-vault__value">
        <code>{shown ? value : "••••••••••"}</code>
        {secret ? (
          <button type="button" onClick={() => setShown((current) => !current)} aria-label={shown ? "Hide" : "Show"}>
            {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        ) : null}
        <button type="button" onClick={() => void copy()} aria-label="Copy">
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function DeliveryVault({ delivery, productName }: { delivery: PartnerDelivery; productName?: string }) {
  const meta = METHOD[delivery.method];
  return (
    <section className="zurs-vault" aria-label="សេវារបស់អ្នក">
      <header className="zurs-vault__head">
        <span className="zurs-vault__mark">
          <ServiceLogo text={productName || meta.kh} size={28} />
        </span>
        <div className="min-w-0">
          <p className="zurs-vault__kicker">សេវារបស់អ្នក</p>
          <h3>{productName || meta.kh}</h3>
          <p>{meta.kh} · {meta.en}</p>
        </div>
      </header>
      {delivery.method === "COUPON" && delivery.coupon ? (
        <CopyRow label="Coupon" value={delivery.coupon} />
      ) : null}
      {delivery.method === "LINK" && delivery.link ? (
        <>
          <a className="zurs-vault__link" href={delivery.link} target="_blank" rel="noreferrer">
            <Link2 className="h-4 w-4" />បើកតំណ Activation
          </a>
          <CopyRow label="URL" value={delivery.link} />
        </>
      ) : null}
      {delivery.method === "READY_ACCOUNT" ? (
        <>
          {delivery.accountEmail ? <CopyRow label="Email" value={delivery.accountEmail} /> : null}
          {delivery.accountPassword ? <CopyRow label="Password" value={delivery.accountPassword} secret /> : null}
        </>
      ) : null}
      {delivery.note ? <p className="zurs-vault__note">{delivery.note}</p> : null}
      {delivery.instructions ? <p className="zurs-vault__note">{delivery.instructions}</p> : null}
      <p className="zurs-vault__hint">រក្សាទុកព័ត៌មាននេះ។ កុំចែកឲ្យអ្នកដទៃ។</p>
    </section>
  );
}

export function methodIcon(method: PartnerDelivery["method"]) {
  if (method === "COUPON") return <Ticket className="h-4 w-4" />;
  if (method === "LINK") return <Link2 className="h-4 w-4" />;
  if (method === "READY_ACCOUNT") return <Mail className="h-4 w-4" />;
  return <KeyRound className="h-4 w-4" />;
}

export function WaitingDelivery({ productName }: { productName?: string }) {
  return (
    <section className="zurs-vault zurs-vault--wait" aria-label="កំពុងបំពេញសេវា">
      <header className="zurs-vault__head">
        <span className="zurs-vault__mark">
          <ServiceLogo text={productName || "ZURS"} size={28} />
        </span>
        <div className="min-w-0">
          <p className="zurs-vault__kicker">កំពុងបំពេញ</p>
          <h3>{productName || "សេវាឌីជីថល"}</h3>
          <p>Admin នឹងផ្ញើ Coupon / Link / គណនី ក្នុង ៥–១០ នាទី។</p>
        </div>
      </header>
    </section>
  );
}
