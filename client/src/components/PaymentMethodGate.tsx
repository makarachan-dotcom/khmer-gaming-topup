import { Check, ChevronRight, CreditCard, Info, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";
import { SelectedProduct, useSelectedProduct } from "@/contexts/SelectedProductContext";

type PaymentMethod = {
  id: string;
  name: string;
  descriptionKh: string;
  iconUrl: string | null;
  providerKey: "bakong_khqr" | "manual";
};

export function PaymentMethodPreselect() {
  const methodsQuery = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000, refetchInterval: 15_000 });
  const { selectedPaymentMethodId, setSelectedPaymentMethodId } = useSelectedProduct();
  const methods = ((methodsQuery.data ?? []) as PaymentMethod[]).filter((method) => method.providerKey === "bakong_khqr");
  const selectedMethod = methods.find((method) => method.id === selectedPaymentMethodId) ?? null;

  // Round 9: as soon as KHQR is chosen this whole block collapses into a single
  // line, so the packages sit directly beneath it and the buyer never has to
  // scroll back up to pick a payment method again.
  if (selectedMethod) return <div className="pm-chosen-bar">
    <span className="pm-chosen-bar__mark" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
    <span className="pm-chosen-bar__text">បង់ប្រាក់តាម {selectedMethod.name}</span>
    <button type="button" onClick={() => setSelectedPaymentMethodId(null)} className="pm-chosen-bar__change">ប្ដូរ</button>
  </div>;

  return <section className="payment-method-preselect" aria-labelledby="payment-method-preselect-title">
    <div className="payment-method-preselect__header">
      <div>
        <p className="payment-method-gate__eyebrow">ជំហានទី 2</p>
        <h3 id="payment-method-preselect-title">ជ្រើសរើសវិធីបង់ប្រាក់</h3>
      </div>
    </div>
    <div className="payment-method-preselect__methods" aria-label="ជម្រើសវិធីបង់ប្រាក់">
      {methodsQuery.isLoading ? <MethodPlaceholder /> : methods.length ? methods.map((method) => <button key={method.id} type="button" onClick={() => setSelectedPaymentMethodId(method.id)} className={`payment-method-option ${selectedPaymentMethodId === method.id ? "payment-method-option--selected" : ""}`} aria-pressed={selectedPaymentMethodId === method.id}>
        <MethodIcon method={method} />
        <span className="payment-method-option__copy"><strong>{method.name}</strong><span>{method.descriptionKh}</span></span>
        <span className="payment-method-option__check" aria-hidden="true"><Check className="h-3.5 w-3.5" /></span>
      </button>) : <MethodPlaceholder empty />}
    </div>
    <p className="payment-method-preselect__notice">ZURS ទទួលការទូទាត់តាម KHQR ប៉ុណ្ណោះ។ គ្មានវិធីបង់ប្រាក់ផ្សេងត្រូវបានបើកសម្រាប់អតិថិជនទេ។</p>
    <p className="payment-method-preselect__hint">{selectedMethod ? "KHQR នឹងត្រូវប្រើនៅពេលអ្នកជ្រើសកញ្ចប់ និងបន្ត checkout។" : "សូមជ្រើស KHQR មុនជ្រើសកញ្ចប់។"}</p>
  </section>;
}

export function PaymentMethodGate({ product, open, onOpenChange }: { product: SelectedProduct | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [, setLocation] = useLocation();
  const methodsQuery = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000, refetchInterval: 15_000 });
  const gateQuery = trpc.payments.gate.useQuery(undefined, { staleTime: 15_000, refetchInterval: 15_000 });
  const createTopup = trpc.orders.createTopup.useMutation();
  const beginPayment = trpc.orders.beginPayment.useMutation();
  const methods = ((methodsQuery.data ?? []) as PaymentMethod[]).filter((method) => method.providerKey === "bakong_khqr");
  const { selectedPaymentMethodId, setSelectedPaymentMethodId, clearSelectedProduct } = useSelectedProduct();
  const [showInfo, setShowInfo] = useState(false);
  const [paymentScreen, setPaymentScreen] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const selectedMethod = useMemo(() => methods.find((method) => method.id === selectedPaymentMethodId) ?? null, [methods, selectedPaymentMethodId]);
  const paymentsEnabled = gateQuery.data?.enabled === true;
  const busy = createTopup.isPending || beginPayment.isPending;

  useEffect(() => {
    if (!open) {
      setShowInfo(false);
      setPaymentScreen(false);
      setCheckoutError(null);
    }
  }, [open]);

  useEffect(() => {
    if (selectedPaymentMethodId && !methods.some((method) => method.id === selectedPaymentMethodId)) setSelectedPaymentMethodId(null);
  }, [methods, selectedPaymentMethodId, setSelectedPaymentMethodId]);

  if (!open || !product) return null;

  const close = () => onOpenChange(false);
  const advance = () => {
    if (!selectedMethod) return;
    if (!paymentsEnabled) {
      setShowInfo(true);
      return;
    }
    setShowInfo(false);
    setCheckoutError(null);
    setPaymentScreen(true);
  };
  const confirmCheckout = async () => {
    if (!selectedMethod || !product.playerId) {
      setCheckoutError("មិនអាចបញ្ជាក់ Player ID សម្រាប់បង្កើត order បានទេ។ សូមត្រឡប់ទៅកែ ID ហើយជ្រើសកញ្ចប់ម្ដងទៀត។");
      return;
    }
    if (selectedMethod.providerKey !== "bakong_khqr") {
      setCheckoutError("វិធីបង់ប្រាក់នេះកំពុងត្រូវបានរៀបចំ។ សូមជ្រើស KHQR ឬរង់ចាំ admin បើកការគាំទ្រសិន។");
      return;
    }
    try {
      setCheckoutError(null);
      const order = await createTopup.mutateAsync({ packageId: product.id, playerId: product.playerId, zoneId: product.zoneId || undefined, accountPassword: product.accountPassword || undefined, quantity: 1 });
      const session = await beginPayment.mutateAsync({ orderId: order.id });
      clearSelectedProduct();
      close();
      setLocation(`/checkout/${session.order.id}`);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "មិនអាចបង្កើត payment session បានទេ។ សូមព្យាយាមម្ដងទៀត។");
    }
  };

  return <div className="payment-method-gate" role="dialog" aria-modal="true" aria-labelledby="payment-gate-title">
    <button type="button" className="payment-method-gate__backdrop" aria-label="បិទផ្ទាំងពិនិត្យការទូទាត់" onClick={close} />
    <section className="payment-method-gate__panel">
      <header className="payment-method-gate__header">
        <div><p className="payment-method-gate__eyebrow">CHECKOUT GATE</p><h2 id="payment-gate-title">{paymentScreen ? "បញ្ជាក់ការទូទាត់" : "ពិនិត្យវិធីបង់ប្រាក់"}</h2></div>
        <button type="button" className="payment-method-gate__close" aria-label="បិទ" onClick={close}><X className="h-5 w-5" /></button>
      </header>

      {paymentScreen ? <PaymentReview product={product} method={selectedMethod} busy={busy} error={checkoutError} onBack={() => setPaymentScreen(false)} onConfirm={() => void confirmCheckout()} /> : selectedMethod ? <div className="payment-method-gate__summary">
        <p className="payment-method-gate__copy">វិធីបង់ប្រាក់ត្រូវបានជ្រើសរួចមុន package។ សូមពិនិត្យព័ត៌មាន ហើយបន្តនៅពេលហាងបានបើកការទូទាត់។</p>
        <PaymentSummary product={product} method={selectedMethod} />
        <div className="payment-method-gate__advance-row">
          <div className="payment-method-gate__chosen"><Check className="h-4 w-4" /><span>{selectedMethod.name} ត្រូវបានជ្រើសរើស</span></div>
          <button type="button" onClick={advance} disabled={!paymentsEnabled} className="zbtn zbtn--primary" title={paymentsEnabled ? "បន្តទៅការទូទាត់" : "ការបង់ប្រាក់កំពុងត្រូវបានរៀបចំ"}>
            បន្តទៅការទូទាត់<ChevronRight />
          </button>
        </div>
        {!paymentsEnabled || showInfo ? <div className="payment-method-gate__info" role="status"><Info className="h-4 w-4" /><span>ការបង់ប្រាក់កំពុងត្រូវបានរៀបចំ — សូមរង់ចាំបន្តិច</span></div> : null}
      </div> : <div className="payment-method-gate__missing" role="status"><Info className="h-4 w-4" /><div><strong>មិនទាន់ជ្រើសវិធីបង់ប្រាក់</strong><p>សូមបិទផ្ទាំងនេះ ហើយជ្រើសវិធីបង់ប្រាក់នៅខាងលើកញ្ចប់ មុនបន្ត។</p></div></div>}
    </section>
  </div>;
}

function PaymentSummary({ product, method }: { product: SelectedProduct; method: PaymentMethod }) {
  return <div className="payment-method-gate__review">
    <div className="payment-method-gate__review-card"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-50 text-cyan-700"><CreditCard className="h-5 w-5" /></span><div><p className="text-xs font-extrabold text-slate-950">{product.gameName}</p><p className="mt-0.5 text-[11px] text-slate-600">{product.label}</p></div><strong>{product.priceLabel}</strong></div>
    <div className="payment-method-gate__review-line"><span>កញ្ចប់</span><strong>{product.amountLabel}</strong></div>
    <div className="payment-method-gate__review-line"><span>វិធីបង់ប្រាក់</span><strong>{method.name}</strong></div>
  </div>;
}

function PaymentReview({ product, method, busy, error, onBack, onConfirm }: { product: SelectedProduct; method: PaymentMethod | null; busy: boolean; error: string | null; onBack: () => void; onConfirm: () => void }) {
  return <div className="payment-method-gate__review"><PaymentSummary product={product} method={method ?? { id: "", name: "—", descriptionKh: "", iconUrl: null, providerKey: "manual" }} /><div className="payment-method-gate__review-info"><Info className="h-4 w-4" /><p>បន្ទាប់ពីអ្នកបញ្ជាក់ ប្រព័ន្ធនឹងបង្កើត QR payment session សម្រាប់ order នេះ រួចបើកទំព័រទូទាត់សុវត្ថិភាព។</p></div>{error ? <div className="payment-method-gate__info payment-method-gate__info--error" role="alert"><Info className="h-4 w-4" /><span>{error}</span></div> : null}<button type="button" disabled={busy} className="payment-method-gate__confirm" onClick={onConfirm}>{busy ? "កំពុងបង្កើត QR សុវត្ថិភាព…" : "បញ្ជាក់ និងបន្តទៅទំព័រទូទាត់"}</button><button type="button" disabled={busy} className="payment-method-gate__back" onClick={onBack}>ត្រឡប់ទៅពិនិត្យ</button></div>;
}

function MethodIcon({ method }: { method: PaymentMethod }) {
  return <PaymentMethodIcon method={method} className="payment-method-option__icon object-contain" />;
}

function MethodPlaceholder({ empty = false }: { empty?: boolean }) {
  return <div className="payment-method-option payment-method-option--placeholder" aria-live="polite"><span className="payment-method-option__icon"><CreditCard className="h-5 w-5" /></span><span className="payment-method-option__copy"><strong>{empty ? "KHQR មិនទាន់ត្រូវបានបើក" : "កំពុងរៀបចំ KHQR…"}</strong><span>{empty ? "Admin ត្រូវបើក KHQR ពី payment dashboard មុន។" : "សូមរង់ចាំបន្តិច"}</span></span></div>;
}
