import StorefrontLayout from "@/components/StorefrontLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { SelectedProduct, useSelectedProduct } from "@/contexts/SelectedProductContext";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { PaymentMethodIcon } from "@/components/PaymentMethodIcon";
import { trpc } from "@/lib/trpc";
import { khqrLogoUrl } from "@/lib/mobileLegendsAssets";
import { BadgeCheck, Check, CheckCircle2, ChevronRight, Clock3, Copy, CreditCard, Download, ExternalLink, FileText, Home, LockKeyhole, PackageCheck, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type LedgerPayment = {
  provider: string;
  status: string;
  amount: string | number;
  currency: "KHR" | "USD";
  qrImageDataUrl: string | null;
  deeplink: string | null;
  expiresAt: Date | string | null;
  paidAt: Date | string | null;
};

type LedgerOrder = {
  id: string;
  orderNumber: string;
  trackingCode: string;
  productName: string;
  subtotal: string | number;
  currency: "KHR" | "USD";
  status: string;
  details?: unknown;
  createdAt?: Date | string;
};

type PaymentMethod = { id: string; name: string; descriptionKh: string; iconUrl: string | null; providerKey: "bakong_khqr" | "manual" };

export default function Checkout() {
  const [location] = useLocation();
  const orderId = location.split("/").pop() ?? "";
  const preview = orderId === "preview";
  const { selectedProduct, selectedPaymentMethodId } = useSelectedProduct();
  const session = trpc.orders.paymentSession.useQuery({ orderId }, { enabled: orderId.length >= 4 && !preview });
  const methods = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000 });
  const [showReceipt, setShowReceipt] = useState(false);
  const payment = session.data?.payment as LedgerPayment | null | undefined;
  const order = session.data?.order as LedgerOrder | undefined;
  const waitingForBakong = payment?.provider === "bakong_khqr" && payment.status === "pending";

  useEffect(() => {
    if (!waitingForBakong) return;
    const timer = window.setInterval(() => { void session.refetch(); }, 10_000);
    return () => window.clearInterval(timer);
  }, [waitingForBakong, session]);

  if (preview) return <PaymentPreview product={selectedProduct} selectedPaymentMethodId={selectedPaymentMethodId} methods={methods.data ?? []} methodsLoading={methods.isLoading} />;
  if (session.isLoading) return <StorefrontLayout><main className="container max-w-3xl pt-7 sm:pt-12"><PaymentLoading /></main></StorefrontLayout>;
  if (session.error || !session.data || !order) return <StorefrontLayout><main className="container max-w-xl pt-7 sm:pt-12"><CheckoutUnavailable /></main></StorefrontLayout>;

  const selectedMethod = resolveSessionMethod(payment, methods.data ?? []);
  const isPaid = payment?.status === "paid";
  const isExpired = payment?.status === "expired" || order.status === "expired";
  const details = readOrderDetails(order.details);

  return <StorefrontLayout><main className="checkout-page container max-w-3xl py-5 pb-28 sm:py-10 sm:pb-16">
    <CheckoutHeader />
    <OrderSummaryCard order={order} details={details} />
    <PaymentMethodCards methods={methods.data ?? []} loading={methods.isLoading} selected={selectedMethod} provider={payment?.provider ?? null} />
    {payment?.provider === "bakong_khqr" ? <KhqrPaymentExperience payment={payment} order={order} selectedMethod={selectedMethod} waiting={waitingForBakong} refreshing={session.isFetching} expired={isExpired} onRefresh={() => void session.refetch()} onViewReceipt={() => setShowReceipt(true)} /> : <PaymentUnavailable />}
    {isPaid ? <SuccessActions onViewReceipt={() => setShowReceipt(true)} /> : null}
    {showReceipt && payment ? <ReceiptDialog order={order} payment={payment} details={details} method={selectedMethod} onClose={() => setShowReceipt(false)} /> : null}
  </main></StorefrontLayout>;
}

function PaymentPreview({ product, selectedPaymentMethodId, methods, methodsLoading }: { product: SelectedProduct | null; selectedPaymentMethodId: string | null; methods: PaymentMethod[]; methodsLoading: boolean }) {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const paymentGate = trpc.payments.gate.useQuery(undefined, { staleTime: 15_000 });
  const createTopup = trpc.orders.createTopup.useMutation();
  const [error, setError] = useState<string | null>(null);
  const method = methods.find((item) => item.id === selectedPaymentMethodId && item.providerKey === "bakong_khqr") ?? methods.find((item) => item.providerKey === "bakong_khqr") ?? null;
  const busy = createTopup.isPending;
  const ready = paymentGate.data?.enabled === true;
  const confirm = async () => {
    if (!product?.playerId || !method) { setError("សូមត្រឡប់ទៅបញ្ជាក់ ID និងជ្រើស KHQR មុនបន្ត។"); return; }
    if (product.requiresVerifiedPlayerName && !product.playerName) { setError("សូមត្រឡប់ទៅ Check ID រហូតទទួលបាន Username មុនពេលបន្តការទូទាត់។"); return; }
    if (!ready) { setError("ការទូទាត់ KHQR មិនទាន់ត្រូវបានបើកទេ។ ទំព័រទូទាត់នេះត្រូវបានរៀបចំរួច ហើយ QR នឹងបង្កើតបានបន្ទាប់ពី admin បើកការទូទាត់។"); return; }
    try {
      setError(null);
      const order = await createTopup.mutateAsync({ packageId: product.id, playerId: product.playerId, zoneId: product.zoneId || undefined, quantity: 1 });
      const linkResponse = await fetch("/api/pay/security/check/key", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
      const link = await linkResponse.json().catch(() => ({})) as { token?: string; code?: string };
      if (!linkResponse.ok || !link.token) throw new Error(link.code === "PAYMENTS_CLOSED" ? "ការទូទាត់ KHQR ត្រូវបានបិទជាបណ្តោះអាសន្ន។" : "មិនអាចបង្កើត link ទូទាត់សុវត្ថិភាពបានទេ។");
      setLocation(`/pay/${encodeURIComponent(link.token)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "មិនអាចបង្កើត KHQR payment session បានទេ។ សូមព្យាយាមម្ដងទៀត។"); }
  };
  if (!product) return <StorefrontLayout><main className="checkout-page container max-w-xl py-7 sm:py-12"><CheckoutUnavailable /></main></StorefrontLayout>;
  return <StorefrontLayout><main className="checkout-page container max-w-3xl py-5 pb-28 sm:py-10 sm:pb-16"><CheckoutHeader /><section className="checkout-preview-hero"><p>KHQR PAYMENT</p><h1>ទំព័រទូទាត់សុវត្ថិភាព</h1><span>ជំហានចុងក្រោយមុនបង្កើត QR</span></section><section className="checkout-order-summary"><div className="checkout-order-summary__eyebrow"><PackageCheck className="h-4 w-4" />ORDER SUMMARY</div><div className="checkout-order-summary__main"><ProviderGameArtwork name={product.gameName} logoUrl={product.gameLogoUrl} priority showCountryFlag={false} className="h-14 w-14 shrink-0 rounded-2xl" iconClassName="h-6 w-6" /><div className="min-w-0 flex-1"><h2 className="checkout-order-summary__title">{product.gameName}</h2><p className="checkout-order-summary__order">{product.label}</p></div><strong className="checkout-order-summary__amount">{product.priceLabel}</strong></div><div className="checkout-order-summary__details"><SummaryDetail label="កញ្ចប់" value={product.amountLabel} />{product.playerName ? <SummaryDetail label="Username" value={product.playerName} /> : <SummaryDetail label="Game ID" value={maskCustomerIdentifier(product.playerId ?? "បានការពារ")} />}<SummaryDetail label="Server ID" value={maskCustomerIdentifier(product.zoneId || "មិនទាមទារ")} /><SummaryDetail label="Quantity" value="1" /></div></section><section className="checkout-methods"><div className="checkout-section-heading"><div><p>PAYMENT METHOD</p><h2>KHQR តែប៉ុណ្ណោះ</h2></div><span>បានជ្រើសរើស</span></div>{methodsLoading ? <div className="checkout-methods__loading"><OutlineLoader size={20} color="#4f46e5" />កំពុងរៀបចំ KHQR…</div> : method ? <article className="checkout-method-card checkout-method-card--selected mt-3"><MethodLogo method={method} /><div><strong>{method.name}</strong><span>{method.descriptionKh}</span></div><span className="checkout-method-card__check"><Check className="h-3.5 w-3.5" /></span></article> : <div className="checkout-methods__loading"><CreditCard className="h-5 w-5" />KHQR មិនទាន់ត្រូវបានបើក</div>}</section><section className="checkout-preview-confirm"><div><LockKeyhole className="h-5 w-5" /><p><strong>បញ្ជាក់ការបញ្ជាទិញ</strong><span>ការបង្កើត QR និង order ពិតកើតឡើងតែបន្ទាប់ពីអ្នកចុចបញ្ជាក់។</span></p></div>{error ? <p className="checkout-preview-confirm__error" role="alert">{error}</p> : null}{!loading && !user ? <a href={`/api/auth/google?returnTo=${encodeURIComponent("/checkout/preview")}`} className="checkout-primary-action">ចូលគណនីដើម្បីបន្ត</a> : <button type="button" disabled={busy || !method} className="checkout-primary-action" onClick={() => void confirm()}>{busy ? <><OutlineLoader size={18} color="#ffffff" />កំពុងបង្កើត QR…</> : "បញ្ជាក់ និងបង្កើត KHQR"}</button>}<button type="button" className="checkout-secondary-action" onClick={() => window.history.back()}>ត្រឡប់ទៅកែ package</button></section></main></StorefrontLayout>;
}


function CheckoutHeader() {
  return <header className="checkout-page__header"><AnimatedBackButton href="/account" className="checkout-page__back"><ChevronRight className="h-4 w-4 rotate-180" />ត្រឡប់ក្រោយ</AnimatedBackButton><div className="checkout-page__secure"><span className="checkout-page__logo-mark">Z</span><span className="font-display text-sm font-extrabold text-slate-950">ZURS.me</span><span className="checkout-page__secure-copy"><LockKeyhole className="h-3.5 w-3.5" />ការទូទាត់មានសុវត្ថិភាព</span></div></header>;
}

function PaymentLoading() {
  return <div className="checkout-page__loading"><OutlineLoader size={34} color="#4f46e5" /><p>កំពុងបើកទំព័រទូទាត់សុវត្ថិភាព…</p></div>;
}

function CheckoutUnavailable() {
  return <section className="checkout-unavailable"><CreditCard className="mx-auto h-7 w-7 text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-900">មិនអាចបើកព័ត៌មានការកម្មង់នេះបានទេ</p><p className="mt-1 text-xs leading-5 text-slate-500">ទំព័រទូទាត់អាចបើកបានតែដោយម្ចាស់ order ប៉ុណ្ណោះ។ សូមត្រឡប់ទៅគណនីរបស់អ្នក ហើយព្យាយាមម្ដងទៀត។</p><Link href="/account" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ទៅកាន់គណនី</Link></section>;
}

function OrderSummaryCard({ order, details }: { order: LedgerOrder; details: Record<string, unknown> }) {
  const customer = accountLabels(details);
  const isAdminTestPurchase = isAdminKhqrTestPurchase(details);
  return <section className="checkout-order-summary" aria-labelledby="checkout-order-title"><div className="checkout-order-summary__eyebrow"><PackageCheck className="h-4 w-4" />ORDER SUMMARY</div><div className="checkout-order-summary__main"><ProviderGameArtwork name={order.productName} priority showCountryFlag={false} className="h-14 w-14 shrink-0 rounded-2xl" iconClassName="h-6 w-6" /><div className="min-w-0 flex-1"><h1 id="checkout-order-title" className="checkout-order-summary__title">{order.productName}</h1><p className="checkout-order-summary__order">#{order.orderNumber}</p></div><strong className="checkout-order-summary__amount">{formatMoney(order.subtotal, order.currency)}</strong></div><div className="checkout-order-summary__details"><SummaryDetail label="Purchase ID" value={order.trackingCode} mono />{isAdminTestPurchase ? <><SummaryDetail label="Product type" value="Admin Test Product" /><SummaryDetail label="Test status" value="Test completed" /></> : <><SummaryDetail label="Game ID" value={customer.playerId} /><SummaryDetail label="Server ID" value={customer.zoneId} /><SummaryDetail label="Quantity" value={customer.quantity} /></>}<SummaryDetail label="USD" value={order.currency === "USD" ? formatMoney(order.subtotal, "USD") : "—"} /><SummaryDetail label="KHR" value={order.currency === "KHR" ? formatMoney(order.subtotal, "KHR") : "តម្លៃ KHR មិនមានក្នុង session នេះ"} /></div><p className="checkout-order-summary__note">ចំនួនទឹកប្រាក់ក្នុង QR និង receipt ត្រូវយកពី payment ledger ដែលបានបង្កើតសម្រាប់ order នេះ។</p></section>;
}

function SummaryDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><span>{label}</span><strong className={mono ? "font-mono" : undefined}>{value}</strong></div>;
}

function PaymentMethodCards({ methods, selected, provider, loading }: { methods: PaymentMethod[]; selected: PaymentMethod | null; provider: string | null; loading: boolean }) {
  const khqrMethods = methods.filter((method) => method.providerKey === "bakong_khqr");
  const cards = khqrMethods.length ? khqrMethods : selected?.providerKey === "bakong_khqr" ? [selected] : [];
  return <section className="checkout-methods" aria-labelledby="checkout-methods-title"><div className="checkout-section-heading"><div><p>PAYMENT METHOD</p><h2 id="checkout-methods-title">KHQR តែប៉ុណ្ណោះ</h2></div><span>បានជ្រើសរើសរួច</span></div>{loading ? <div className="checkout-methods__loading"><OutlineLoader size={20} color="#4f46e5" />កំពុងរៀបចំវិធីបង់ប្រាក់…</div> : cards.length ? <div className="checkout-methods__grid">{cards.map((method) => { const active = selected?.id === method.id || (method.providerKey === "bakong_khqr" && provider === "bakong_khqr"); return <article key={method.id} className={`checkout-method-card ${active ? "checkout-method-card--selected" : ""}`} aria-label={`${method.name}${active ? " បានជ្រើសរើស" : ""}`}><MethodLogo method={method} /><div><strong>{method.name}</strong><span>{method.descriptionKh}</span></div>{active ? <span className="checkout-method-card__check"><Check className="h-3.5 w-3.5" /></span> : <span className="checkout-method-card__locked">បានចាក់សោ</span>}</article>; })}</div> : <div className="checkout-methods__loading"><CreditCard className="h-5 w-5" />មិនទាន់មានវិធីបង់ប្រាក់សកម្ម</div>}<p className="checkout-methods__note">ZURS ទទួលការទូទាត់តាម KHQR តែប៉ុណ្ណោះ។ ដើម្បីរក្សាចំនួនទឹកប្រាក់ និង QR ឲ្យត្រឹមត្រូវ វិធីបង់ប្រាក់មិនអាចប្តូរបានទេ បន្ទាប់ពី session ត្រូវបានបង្កើត។</p></section>;
}

function PaymentUnavailable() {
  return <section className="checkout-khqr"><div className="checkout-section-heading"><div><p>PAYMENT SESSION</p><h2>កំពុងរៀបចំវិធីបង់ប្រាក់</h2></div><span>Pending</span></div><div className="checkout-methods__loading"><CreditCard className="h-5 w-5" />session នេះមិនទាន់មាន QR payment instruction ដែលអាចបង្ហាញបានទេ។</div></section>;
}

function MethodLogo({ method }: { method: PaymentMethod }) {
  return <PaymentMethodIcon method={method} className="checkout-method-card__icon object-contain" />;
}

function KhqrPaymentExperience({ payment, order, selectedMethod, waiting, refreshing, expired, onRefresh, onViewReceipt }: { payment: LedgerPayment; order: LedgerOrder; selectedMethod: PaymentMethod | null; waiting: boolean; refreshing: boolean; expired: boolean; onRefresh: () => void; onViewReceipt: () => void }) {
  const secondsLeft = useCountdown(payment.expiresAt, waiting);
  const paid = payment.status === "paid";
  return <section className={`checkout-khqr ${paid ? "checkout-khqr--paid" : ""}`} aria-live="polite"><div className="checkout-section-heading"><div><p>SECURE QR PAYMENT</p><h2>{paid ? "ការទូទាត់បានបញ្ជាក់" : expired ? "QR ផុតសុពលភាព" : "ទូទាត់តាម QR"}</h2></div>{paid ? <span className="checkout-status checkout-status--paid"><BadgeCheck className="h-4 w-4" />PAID</span> : expired ? <span className="checkout-status checkout-status--expired"><XCircle className="h-4 w-4" />EXPIRED</span> : <span className="checkout-status"><Clock3 className="h-4 w-4" />{formatCountdown(secondsLeft)}</span>}</div><div className="checkout-khqr__body"><div className="checkout-qr-card">{payment.qrImageDataUrl ? <img src={payment.qrImageDataUrl} alt="KHQR payment code" className="checkout-qr-card__image" /> : <OutlineLoader size={38} color="#4f46e5" />}{paid ? <div className="fx-stamp">PAID</div> : null}</div><div className="checkout-khqr__copy"><span className="checkout-khqr__brand"><img src={khqrLogoUrl} alt="KHQR" className="h-5 w-5 object-contain" />{selectedMethod?.name ?? "KHQR"}</span><strong>{formatMoney(payment.amount ?? order.subtotal, payment.currency ?? order.currency)}</strong><p>Merchant: ZURS STORE</p>{paid ? <p className="checkout-khqr__success-copy"><CheckCircle2 className="h-4 w-4" />ការទូទាត់ត្រូវបានផ្ទៀងផ្ទាត់ក្នុង ledger រួចរាល់។</p> : expired ? <p className="checkout-khqr__expired-copy">QR នេះផុតសុពលភាពហើយ។ សូមបង្កើត payment session ថ្មីពី order របស់អ្នក។</p> : <p className="checkout-khqr__waiting-copy"><AnimatedGlyph name="activity" size={18} color="#4f46e5" />កំពុងរង់ចាំការទូទាត់… ប្រព័ន្ធពិនិត្យស្ថានភាពរៀងរាល់ 10 វិនាទី។</p>}</div></div>{payment.deeplink && !paid && !expired ? <a href={payment.deeplink} target="_blank" rel="noreferrer" className="checkout-khqr__deeplink"><ExternalLink className="h-4 w-4" />បើកកម្មវិធីធនាគារ</a> : null}{!paid ? <div className="checkout-khqr__actions"><button type="button" disabled={!waiting || refreshing} onClick={onRefresh} className="checkout-primary-action">{refreshing ? <OutlineLoader size={18} color="#ffffff" /> : <RefreshCw className="h-4 w-4" />}ខ្ញុំបានបង់រួចហើយ</button><button type="button" disabled={!waiting || refreshing} onClick={onRefresh} className="checkout-secondary-action"><RefreshCw className="h-4 w-4" />ពិនិត្យម្ដងទៀត</button><Link href="/account" className="checkout-cancel-action">បោះបង់ការទូទាត់</Link></div> : <SuccessState order={order} onViewReceipt={onViewReceipt} />}</section>;
}

function SuccessState({ order, onViewReceipt }: { order: LedgerOrder; onViewReceipt: () => void }) {
  const isAdminTestPurchase = isAdminKhqrTestPurchase(readOrderDetails(order.details));
  return <section className="checkout-success-state"><div className="checkout-success-state__head"><AnimatedGlyph name="success" size={34} color="#059669" /><div><h2>{isAdminTestPurchase ? "បានទិញ Test Product ជោគជ័យ!" : "ការទូទាត់ជោគជ័យ!"}</h2><p>{isAdminTestPurchase ? "KHQR $0.02 ត្រូវបានបញ្ជាក់ និងបានកត់ត្រាជា Test Product រួចរាល់។" : "ការបញ្ជាទិញរបស់អ្នកកំពុងត្រូវបានដំណើរការ"}</p></div></div><ol className="checkout-success-state__steps"><li className="is-complete"><CheckCircle2 className="h-4 w-4" /><span>Payment received</span></li><li className={order.status === "delivered" ? "is-complete" : "is-pending"}><Clock3 className="h-4 w-4" /><span>{isAdminTestPurchase ? "Test product recorded" : "Processing order"}</span></li><li className={order.status === "delivered" ? "is-complete" : "is-pending"}><PackageCheck className="h-4 w-4" /><span>{isAdminTestPurchase ? "Test completed" : "Completed / Delivered"}</span></li></ol><button type="button" onClick={onViewReceipt} className="checkout-receipt-action"><FileText className="h-4 w-4" />មើលបង្កាន់ដៃ</button></section>;
}

function SuccessActions({ onViewReceipt }: { onViewReceipt: () => void }) {
  return <div className="checkout-success-links"><button type="button" onClick={onViewReceipt}><FileText className="h-4 w-4" />មើលបង្កាន់ដៃ</button><Link href="/order-status"><PackageCheck className="h-4 w-4" />មើលការបញ្ជាទិញរបស់ខ្ញុំ</Link><Link href="/"><Home className="h-4 w-4" />ត្រឡប់ទៅទំព័រដើម</Link></div>;
}

function ReceiptDialog({ order, payment, details, method, onClose }: { order: LedgerOrder; payment: LedgerPayment; details: Record<string, unknown>; method: PaymentMethod | null; onClose: () => void }) {
  const customer = accountLabels(details);
  const isAdminTestPurchase = isAdminKhqrTestPurchase(details);
  const print = () => window.print();
  return <div className="receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-title"><button type="button" className="receipt-dialog__backdrop" onClick={onClose} aria-label="បិទបង្កាន់ដៃ" /><section className="receipt-paper"><header className="receipt-paper__header"><div><span className="checkout-page__logo-mark">Z</span><p>ZURS.me</p></div><button type="button" onClick={onClose} className="receipt-paper__close" aria-label="បិទ">×</button></header><div className="receipt-paper__title"><BadgeCheck className="h-7 w-7" /><div><h2 id="receipt-title">បង្កាន់ដៃទូទាត់</h2><p>Payment Receipt · PAID</p></div></div><div className="receipt-paper__badge">PAID</div><dl><ReceiptLine label="Order ID" value={`#${order.orderNumber}`} /><ReceiptLine label="Purchase ID" value={order.trackingCode} /><ReceiptLine label="Date / Time" value={formatReceiptDate(payment.paidAt ?? order.createdAt)} /><ReceiptLine label="Product" value={order.productName} />{isAdminTestPurchase ? <><ReceiptLine label="Purchase type" value="Admin Test Product" /><ReceiptLine label="Test status" value="Test completed" /></> : <><ReceiptLine label="Game ID" value={customer.playerId} /><ReceiptLine label="Server ID" value={customer.zoneId} /></>}<ReceiptLine label="Payment method" value={method?.name ?? "KHQR"} /><ReceiptLine label="Transaction reference" value="បានការពារក្នុង payment ledger" /><ReceiptLine label="Amount paid" value={formatMoney(payment.amount, payment.currency)} strong /></dl><p className="receipt-paper__support"><ShieldCheck className="h-4 w-4" />ត្រូវការជំនួយ? សូមប្រើប៊ូតុង «ជំនួយ» នៅលើ ZURS.me ឬបើក ticket ក្នុងគណនី។</p><div className="receipt-paper__actions"><button type="button" onClick={print}><Download className="h-4 w-4" />Download / Print Receipt</button><Link href="/order-status" onClick={onClose}><PackageCheck className="h-4 w-4" />មើល order</Link></div></section></div>;
}

function ReceiptLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div><dt>{label}</dt><dd className={strong ? "is-strong" : undefined}>{value}</dd></div>;
}

function useCountdown(expiresAt: Date | string | null, active: boolean) {
  const expiry = useMemo(() => expiresAt ? new Date(expiresAt).getTime() : 0, [expiresAt]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; setNow(Date.now()); const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [active, expiry]);
  return expiry ? Math.max(0, Math.ceil((expiry - now) / 1000)) : 0;
}

function resolveSessionMethod(payment: LedgerPayment | null | undefined, methods: PaymentMethod[]) { return methods.find((method) => method.providerKey === "bakong_khqr" && payment?.provider === "bakong_khqr") ?? methods.find((method) => method.providerKey === "bakong_khqr") ?? null; }
function readOrderDetails(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function isAdminKhqrTestPurchase(details: Record<string, unknown>) { return details.testPurchase === true && details.testProductCode === "admin-khqr-test-002" && details.noProviderFulfillment === true; }
function accountLabels(details: Record<string, unknown>) { const player = typeof details.playerId === "string" ? details.playerId : "បានការពារ"; const zone = typeof details.zoneId === "string" && details.zoneId ? details.zoneId : "មិនទាមទារ"; const quantity = typeof details.quantity === "number" || typeof details.quantity === "string" ? String(details.quantity) : "1"; return { playerId: maskCustomerIdentifier(player), zoneId: maskCustomerIdentifier(zone), quantity }; }
function maskCustomerIdentifier(value: string) { if (["បានការពារ", "មិនទាមទារ"].includes(value) || value.length <= 5) return value; return `${value.slice(0, 2)}•••${value.slice(-3)}`; }
function formatMoney(value: string | number, currency: "KHR" | "USD") { const numeric = Number(value); if (!Number.isFinite(numeric)) return "—"; return currency === "KHR" ? `៛ ${numeric.toLocaleString("km-KH", { maximumFractionDigits: 0 })}` : `$${numeric.toFixed(2)} USD`; }
function formatCountdown(seconds: number) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return `QR នឹងផុតសុពលភាពក្នុង ${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`; }
function formatReceiptDate(value: Date | string | null | undefined) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString("km-KH", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
