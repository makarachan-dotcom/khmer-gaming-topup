import { Check, CreditCard, Info, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

type SelectedPackage = {
  label: string;
  amountLabel: string;
  priceLabel: string;
  gameName: string;
  gameLogoUrl?: string;
};

type PaymentMethod = {
  id: string;
  name: string;
  descriptionKh: string;
  iconUrl: string | null;
  providerKey: "bakong_khqr" | "manual";
};

export function PaymentMethodGate({ product, open, onOpenChange }: { product: SelectedPackage | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const methodsQuery = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000, refetchInterval: 15_000 });
  const gateQuery = trpc.payments.gate.useQuery(undefined, { staleTime: 15_000, refetchInterval: 15_000 });
  const methods = methodsQuery.data ?? [];
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [paymentScreen, setPaymentScreen] = useState(false);
  const selectedMethod = useMemo(() => methods.find((method) => method.id === selectedMethodId) ?? null, [methods, selectedMethodId]);
  const paymentsEnabled = gateQuery.data?.enabled === true;

  useEffect(() => {
    if (!open) {
      setSelectedMethodId(null);
      setShowInfo(false);
      setPaymentScreen(false);
    }
  }, [open]);

  useEffect(() => {
    if (selectedMethodId && !methods.some((method) => method.id === selectedMethodId)) setSelectedMethodId(null);
  }, [methods, selectedMethodId]);

  if (!open || !product) return null;

  const close = () => onOpenChange(false);
  const advance = () => {
    if (!selectedMethod) return;
    if (!paymentsEnabled) {
      setShowInfo(true);
      return;
    }
    setShowInfo(false);
    setPaymentScreen(true);
  };

  return <div className="payment-method-gate" role="dialog" aria-modal="true" aria-labelledby="payment-gate-title">
    <button type="button" className="payment-method-gate__backdrop" aria-label="បិទផ្ទាំងជ្រើសវិធីបង់ប្រាក់" onClick={close} />
    <section className="payment-method-gate__panel">
      <header className="payment-method-gate__header">
        <div><p className="payment-method-gate__eyebrow">CHECKOUT GATE</p><h2 id="payment-gate-title">{paymentScreen ? "ពិនិត្យព័ត៌មានការទូទាត់" : "ជ្រើសរើសវិធីបង់ប្រាក់"}</h2></div>
        <button type="button" className="payment-method-gate__close" aria-label="បិទ" onClick={close}><X className="h-5 w-5" /></button>
      </header>

      {!paymentScreen ? <>
        <p className="payment-method-gate__copy">ជ្រើសរើសវិធីបង់ប្រាក់មួយជាមុនសិន។ ការកំណត់នេះមិនផ្លាស់ប្តូរតម្លៃ ឬកញ្ចប់ដែលអ្នកបានជ្រើសទេ។</p>
        <div className="payment-method-gate__methods" aria-label="ជម្រើសវិធីបង់ប្រាក់">
          {methodsQuery.isLoading ? <MethodPlaceholder /> : methods.length ? methods.map((method) => <button key={method.id} type="button" onClick={() => { setSelectedMethodId(method.id); setShowInfo(false); }} className={`payment-method-option ${selectedMethodId === method.id ? "payment-method-option--selected" : ""}`} aria-pressed={selectedMethodId === method.id}>
            <MethodIcon method={method} />
            <span className="payment-method-option__copy"><strong>{method.name}</strong><span>{method.descriptionKh}</span></span>
            <span className="payment-method-option__check" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
          </button>) : <MethodPlaceholder empty />}
        </div>

        {selectedMethod ? <div className="payment-method-gate__advance-row">
          <div className="payment-method-gate__chosen"><Check className="h-4 w-4" /><span>{selectedMethod.name} ត្រូវបានជ្រើសរើស</span></div>
          <button type="button" onClick={advance} aria-disabled={!paymentsEnabled} className={`payment-fast-forward ${paymentsEnabled ? "payment-fast-forward--active" : "payment-fast-forward--muted"}`} title={paymentsEnabled ? "បន្តទៅការទូទាត់" : "ការបង់ប្រាក់កំពុងត្រូវបានរៀបចំ"}>
            <span className="sr-only">បន្តទៅការទូទាត់</span><span className="payment-fast-forward__chevrons" aria-hidden="true"><i /><i /><i /></span>
          </button>
        </div> : <p className="payment-method-gate__hint">សូមជ្រើសរើសវិធីបង់ប្រាក់ ដើម្បីបង្ហាញប៊ូតុងបន្ត។</p>}
        {showInfo ? <div className="payment-method-gate__info" role="status"><Info className="h-4 w-4" /><span>ការបង់ប្រាក់កំពុងត្រូវបានរៀបចំ — សូមរង់ចាំបន្តិច</span></div> : null}
      </> : <PaymentReview product={product} method={selectedMethod} onBack={() => setPaymentScreen(false)} />}
    </section>
  </div>;
}

function PaymentReview({ product, method, onBack }: { product: SelectedPackage; method: PaymentMethod | null; onBack: () => void }) {
  return <div className="payment-method-gate__review"><div className="payment-method-gate__review-card"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><CreditCard className="h-5 w-5" /></span><div><p className="text-xs font-extrabold text-slate-950">{product.gameName}</p><p className="mt-0.5 text-[11px] text-slate-600">{product.label}</p></div><strong>{product.priceLabel}</strong></div><div className="payment-method-gate__review-line"><span>កញ្ចប់</span><strong>{product.amountLabel}</strong></div><div className="payment-method-gate__review-line"><span>វិធីបង់ប្រាក់</span><strong>{method?.name ?? "—"}</strong></div><div className="payment-method-gate__review-info"><Info className="h-4 w-4" /><p>ព័ត៌មានកញ្ចប់ និងវិធីបង់ប្រាក់ត្រូវបានរក្សាទុកក្នុង payment gate។ ការបង្កើត payment session ពិតនៅតែគោរព payment processor និង security readiness ដែលមានស្រាប់។</p></div><button type="button" className="payment-method-gate__back" onClick={onBack}>ប្ដូរវិធីបង់ប្រាក់</button></div>;
}

function MethodIcon({ method }: { method: PaymentMethod }) {
  if (method.iconUrl) return <img src={method.iconUrl} alt="" className="payment-method-option__icon object-contain" loading="lazy" decoding="async" />;
  return <span className="payment-method-option__icon"><CreditCard className="h-5 w-5" /></span>;
}

function MethodPlaceholder({ empty = false }: { empty?: boolean }) {
  return <div className="payment-method-option payment-method-option--placeholder" aria-live="polite"><span className="payment-method-option__icon"><CreditCard className="h-5 w-5" /></span><span className="payment-method-option__copy"><strong>{empty ? "មិនទាន់មានវិធីបង់ប្រាក់" : "កំពុងរៀបចំវិធីបង់ប្រាក់…"}</strong><span>{empty ? "Admin អាចបន្ថែម ឬបើកប្រើវិធីបង់ប្រាក់ពី dashboard។" : "សូមរង់ចាំបន្តិច"}</span></span></div>;
}
