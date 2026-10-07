import StorefrontLayout from "@/components/StorefrontLayout";
import { Seo } from "@/components/Seo";
import { useAuth } from "@/_core/hooks/useAuth";
import { SelectedProduct, useSelectedProduct } from "@/contexts/SelectedProductContext";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { ServiceLogo } from "@/components/BrandMark";
import { LangCopy, useLangCopy } from "@/components/LangCopy";
import { CdkUpgradeCard } from "@/components/CdkUpgradeCard";
import { publicCdkStatus } from "@shared/cdkToken";
import { trpc } from "@/lib/trpc";
import { khqrLogoUrl } from "@/lib/mobileLegendsAssets";
import { khmerDiamondCopy } from "@/lib/khmerDiamondCopy";
import { checkoutPackageQuantity } from "@/lib/stackableWeeklyPackages";
import { BakongKhqrCard } from "@/components/BakongKhqrCard";
import { SampeahCelebration } from "@/components/SampeahCelebration";
import PaymentSuccessPipeline from "@/components/PaymentSuccessPipeline";
import { RefundPolicyDialog } from "@/components/RefundPolicyDialog";
import { AlertTriangle, BadgeCheck, CheckCircle2, ChevronRight, Clock3, CreditCard, Download, ExternalLink, FileText, Home, LockKeyhole, PackageCheck, PencilLine, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

const DELIVERY_SUMMARY: Record<string, string> = {
  CDK: "CDK",
  COUPON: "Coupon",
  LINK: "តំណ Activation",
  READY_ACCOUNT: "គណនី",
};

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
  const { selectedProduct } = useSelectedProduct();
  const session = trpc.orders.paymentSession.useQuery({ orderId }, { enabled: orderId.length >= 4 && !preview });
  const refreshPayment = trpc.orders.refreshPayment.useMutation();
  const methods = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000 });
  const [showReceipt, setShowReceipt] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const payment = session.data?.payment as LedgerPayment | null | undefined;
  const order = session.data?.order as LedgerOrder | undefined;
  const waitingForBakong = payment?.provider === "bakong_khqr" && payment.status === "pending";
  const paymentStatus = payment?.status ?? null;
  const previousStatus = useRef<string | null>(null);

  const checkPayment = () => {
    void refreshPayment.mutateAsync({ orderId }).finally(() => { void session.refetch(); });
  };

  useEffect(() => {
    if (!waitingForBakong) return;
    const timer = window.setInterval(checkPayment, 10_000);
    return () => window.clearInterval(timer);
  }, [waitingForBakong, orderId]);

  // Khmer sampeah celebration fires only on the live pending → paid transition,
  // so revisiting an already-paid receipt never replays the popup.
  useEffect(() => {
    if (previousStatus.current && previousStatus.current !== "paid" && paymentStatus === "paid") setCelebrate(true);
    previousStatus.current = paymentStatus;
  }, [paymentStatus]);

  if (preview) return <PaymentPreview product={selectedProduct} />;
  if (session.isLoading) return <StorefrontLayout><Seo noindex /><main className="container max-w-3xl pt-7 sm:pt-12 zp-page"><PaymentLoading /></main></StorefrontLayout>;
  if (session.error || !session.data || !order) return <StorefrontLayout><Seo noindex /><main className="container max-w-xl pt-7 sm:pt-12"><CheckoutUnavailable /></main></StorefrontLayout>;

  const selectedMethod = resolveSessionMethod(payment, methods.data ?? []);
  const isPaid = payment?.status === "paid";
  const isExpired = payment?.status === "expired" || order.status === "expired";
  const details = readOrderDetails(order.details);

  return <StorefrontLayout><Seo noindex /><main className="checkout-page container max-w-3xl py-5 pb-28 sm:py-10 sm:pb-16">
    <CheckoutHeader />
    <OrderSummaryCard order={order} details={details} />
    {payment?.provider === "bakong_khqr" ? <KhqrPaymentExperience payment={payment} order={order} selectedMethod={selectedMethod} waiting={waitingForBakong} refreshing={session.isFetching || refreshPayment.isPending} expired={isExpired} onRefresh={checkPayment} onViewReceipt={() => setShowReceipt(true)} /> : <PaymentUnavailable />}
    {isPaid ? <SuccessActions onViewReceipt={() => setShowReceipt(true)} /> : null}
    {showReceipt && payment ? <ReceiptDialog order={order} payment={payment} details={details} method={selectedMethod} onClose={() => setShowReceipt(false)} /> : null}
    <SampeahCelebration open={celebrate} onClose={() => setCelebrate(false)} />
  </main></StorefrontLayout>;
}

/**
 * Flags a preview that cannot legally become an order yet: a game top-up with
 * no Game ID, or one whose provider demands a verified username that was never
 * resolved. Optional chaining keeps it safe while the checkout context is still
 * being restored from session storage, so the warning renders before the buyer
 * taps confirm instead of failing afterwards.
 */
function needsIdentityRepair(product: SelectedProduct | null) {
  if (product?.kind === "partner") return false;
  if (!product?.playerId) return true;
  return Boolean(product.requiresVerifiedPlayerName && !product.playerName);
}

function PaymentPreview({ product }: { product: SelectedProduct | null }) {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const paymentGate = trpc.payments.gate.useQuery(undefined, { staleTime: 15_000 });
  const pendingCount = trpc.orders.pendingPaymentCount.useQuery(undefined, { enabled: !!user, refetchInterval: 30_000 });
  const createTopup = trpc.orders.createTopup.useMutation();
  const createService = trpc.orders.createService.useMutation();
  const [error, setError] = useState<string | null>(null);
  // Round 9 still applies, it just moved: the no-refund policy is acknowledged
  // here, one tap before the QR and the order actually exist.
  const [refundConsentOpen, setRefundConsentOpen] = useState(false);
  const isPartner = product?.kind === "partner";
  const { lang, setLang } = useLangCopy();
  const partnerInfo = trpc.partner.preview.useQuery(
    { slug: product?.partnerSlug ?? "none", quantity: 1 },
    { enabled: isPartner && Boolean(product?.partnerSlug), staleTime: 60_000, retry: 1 },
  );
  const busy = createTopup.isPending || createService.isPending;
  const ready = paymentGate.data?.enabled === true;
  const pendingLimitReached = (pendingCount.data?.count ?? 0) >= (pendingCount.data?.limit ?? 2);
  const confirm = async () => {
    if (!product) return;
    if (!isPartner) {
      if (!product?.playerId) { setError("សូមត្រឡប់ទៅបញ្ជាក់ ID មុនបន្ត។"); return; }
      if (product.requiresVerifiedPlayerName && !product.playerName) { setError("សូមត្រឡប់ទៅ Check ID រហូតទទួលបាន Username មុនពេលបន្តការទូទាត់។"); return; }
    } else if (!product?.partnerSlug) {
      setError("សូមត្រឡប់ទៅហាង រួចជ្រើសសេវាឌីជីថលម្ដងទៀត។");
      return;
    }
    if (!ready) { setError("ការទូទាត់ KHQR មិនទាន់ត្រូវបានបើកទេ។ ទំព័រទូទាត់នេះត្រូវបានរៀបចំរួច ហើយ QR នឹងបង្កើតបានបន្ទាប់ពី admin បើកការទូទាត់។"); return; }
    if (pendingLimitReached) { setError("អ្នកមានការទូទាត់កំពុងរង់ចាំ ២ រួចហើយ។ សូមបញ្ចប់ការទូទាត់ចាស់ ឬរង់ចាំ QR ផុតកំណត់សិន។"); return; }
    try {
      setError(null);
      const order = isPartner
        ? await createService.mutateAsync({ slug: product.partnerSlug as string, quantity: 1 })
        : await createTopup.mutateAsync({ packageId: product.id, playerId: product.playerId as string, zoneId: product.zoneId || undefined, accountPassword: product.accountPassword || undefined, quantity: checkoutPackageQuantity(product.quantity) });
      const linkResponse = await fetch("/api/pay/security/check/key", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ orderId: order.id }) });
      const link = await linkResponse.json().catch(() => ({})) as { token?: string; code?: string };
      if (!linkResponse.ok || !link.token) throw new Error(link.code === "PAYMENTS_CLOSED" ? "ការទូទាត់ KHQR ត្រូវបានបិទជាបណ្តោះអាសន្ន។" : link.code === "PENDING_PAYMENT_LIMIT" ? "អ្នកមានការទូទាត់កំពុងរង់ចាំ ២ រួចហើយ។ សូមបញ្ចប់ការទូទាត់ចាស់សិន។" : "មិនអាចបង្កើត link ទូទាត់សុវត្ថិភាពបានទេ។");
      setLocation(`/pay/${encodeURIComponent(link.token)}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "មិនអាចបង្កើត KHQR payment session បានទេ។ សូមព្យាយាមម្ដងទៀត។"); }
  };
  if (!product) return <StorefrontLayout><Seo noindex /><main className="checkout-page container max-w-xl py-7 sm:py-12"><CheckoutUnavailable /></main></StorefrontLayout>;
  return <StorefrontLayout><Seo noindex /><main className="checkout-page container max-w-3xl py-5 pb-28 sm:py-10 sm:pb-16">
    <CheckoutHeader />
    <section className="checkout-preview-hero"><p>សង្ខេបការកម្មង់</p><h1>ពិនិត្យ និងបញ្ជាក់ការបញ្ជាទិញ</h1><span>បញ្ជាក់ព័ត៌មានឲ្យបានត្រឹមត្រូវ មុននឹងបន្តទៅ Secure QR Payment — ការទូទាត់តាម KHQR តែប៉ុណ្ណោះ</span></section>
    <section className="checkout-order-summary">
      <div className="checkout-order-summary__eyebrow"><PackageCheck className="h-4 w-4" />សង្ខេបការកម្មង់</div>
      <div className="checkout-order-summary__main">{isPartner ? <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line"><ServiceLogo text={`${product.gameName} ${product.label}`} size={40} /></span> : <ProviderGameArtwork name={product.gameName} logoUrl={product.gameLogoUrl} priority showCountryFlag={false} className="h-14 w-14 shrink-0 rounded-2xl" iconClassName="h-6 w-6" />}<div className="min-w-0 flex-1"><h2 className="checkout-order-summary__title">{product.gameName}</h2><p className="checkout-order-summary__order">{khmerDiamondCopy(product.label)}</p></div><strong className="checkout-order-summary__amount">{product.priceLabel}</strong></div>
      <div className="checkout-order-summary__details">{isPartner ? <><SummaryDetail label="កញ្ចប់" value={khmerDiamondCopy(product.amountLabel)} /><SummaryDetail label="ប្រភេទ" value="សេវាឌីជីថល" /><SummaryDetail label="ការដឹកជញ្ជូន" value={DELIVERY_SUMMARY[product.deliveryType || ""] || product.deliveryType || "Admin បំពេញ"} />{product.durationDays ? <SummaryDetail label="រយៈពេល" value={`${product.durationDays} ថ្ងៃ`} /> : null}<SummaryDetail label="ពេលបំពេញ" value="៥–១០ នាទី" /><SummaryDetail label="បរិមាណ" value="1" /></> : <><SummaryDetail label="កញ្ចប់" value={khmerDiamondCopy(product.amountLabel)} />{product.accountPassword ? <><SummaryDetail label="Username" value={product.playerId ?? "បានការពារ"} /><SummaryDetail label="Password" value="••••••••" /></> : product.playerName ? <SummaryDetail label="Username" value={product.playerName} /> : <SummaryDetail label="Game ID" value={maskCustomerIdentifier(product.playerId ?? "បានការពារ")} />}{product.accountPassword ? null : <SummaryDetail label="Server ID" value={maskCustomerIdentifier(product.zoneId || "មិនទាមទារ")} />}<SummaryDetail label="បរិមាណ" value={String(checkoutPackageQuantity(product.quantity))} /></>}</div>
      <p className="checkout-order-summary__note">{isPartner ? (product.deliveryType === "CDK" ? "បន្ទាប់ពីទូទាត់ KHQR រួច សូម paste token ក្នុងវេបសាយ។ រង់ចាំបន្តិច — plan នឹង upgrade។" : "បន្ទាប់ពីទូទាត់ KHQR រួច ការកម្មង់នឹងចូលផ្ទាំង Admin ហើយត្រូវបានបំពេញក្នុង ៥–១០ នាទី។") : "សូមពិនិត្យ ID និងកញ្ចប់ឲ្យបានត្រឹមត្រូវ។ បន្ទាប់ពីបញ្ជាក់ order និង QR ពិតនឹងត្រូវបង្កើត។"}</p>
    </section>
    {isPartner && (partnerInfo.data?.descriptionKh || partnerInfo.data?.descriptionEn || partnerInfo.data?.description || partnerInfo.data?.instructionsKh || partnerInfo.data?.instructions) ? (
      <section className="mt-3 rounded-2xl border border-line bg-panel p-4">
        <LangCopy kh={partnerInfo.data?.descriptionKh || partnerInfo.data?.description} en={partnerInfo.data?.descriptionEn || partnerInfo.data?.description} labelKh="ព័ត៌មាន" labelEn="Info" lang={lang} onLang={setLang} />
        <LangCopy kh={partnerInfo.data?.instructionsKh || partnerInfo.data?.instructions} en={partnerInfo.data?.instructionsEn || partnerInfo.data?.instructions} labelKh="វិធីប្រើ" labelEn="How to use" lang={lang} onLang={setLang} />
      </section>
    ) : null}
    <section className="checkout-preview-confirm">
      <div><LockKeyhole className="h-5 w-5" /><p><strong>បញ្ជាក់ការបញ្ជាទិញ</strong><span>ការបង្កើត QR និង order ពិតកើតឡើងតែបន្ទាប់ពីអ្នកចុចបញ្ជាក់។ ការទូទាត់ធ្វើឡើងតាម KHQR ដែលបានជ្រើសរើសរួច។</span></p></div>
      {pendingLimitReached ? <p className="checkout-pending-block" role="alert"><AlertTriangle className="h-4 w-4" />អ្នកមានការទូទាត់កំពុងរង់ចាំ ២ រួចហើយ — មិនអាចបង្កើតការទូទាត់ថ្មីលើសពី ២ បានទេ។ សូមបញ្ចប់ ឬរង់ចាំ QR ចាស់ផុតកំណត់សិន។</p> : null}
      {needsIdentityRepair(product) ? <p className="checkout-preview-confirm__error" role="alert"><AlertTriangle className="h-4 w-4" />សូមត្រឡប់ទៅបញ្ជាក់ ID និងឈ្មោះគណនី មុនបន្ត។</p> : null}
      {error ? <p className="checkout-preview-confirm__error" role="alert">{error}</p> : null}
      {!loading && !user ? <a href={`/api/auth/google?returnTo=${encodeURIComponent("/checkout/preview")}`} className="checkout-primary-action">ចូលគណនីដើម្បីបន្ត</a> : <div className="checkout-confirm-actions">
        <button type="button" disabled={busy || pendingLimitReached} className="checkout-primary-action" onClick={() => setRefundConsentOpen(true)}>{busy ? <><OutlineLoader size={18} color="currentColor" />កំពុងបង្កើត QR…</> : <><CheckCircle2 className="h-4 w-4" />បញ្ជាក់ និងបង្កើត KHQR</>}</button>
        <button type="button" disabled={busy} className="checkout-secondary-action" onClick={() => window.history.back()}><PencilLine className="h-4 w-4" />កែប្រែការបញ្ជាទិញ</button>
      </div>}
    </section>
    <RefundPolicyDialog
      open={refundConsentOpen}
      productLabel={product.label}
      priceLabel={product.priceLabel}
      onAgree={() => { setRefundConsentOpen(false); void confirm(); }}
      onDecline={() => setRefundConsentOpen(false)}
    />
  </main></StorefrontLayout>;
}


function CheckoutHeader() {
  const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";
  return <header className="checkout-page__header"><AnimatedBackButton href="/account" className="checkout-page__back"><ChevronRight className="h-4 w-4 rotate-180" />ត្រឡប់ក្រោយ</AnimatedBackButton><div className="checkout-page__secure"><img src={logoUrl} alt="ZURS logo" className="checkout-page__logo-img" /><span className="font-display text-sm font-extrabold text-ink">ZURS.me</span><span className="checkout-page__secure-copy"><LockKeyhole className="h-3.5 w-3.5" />ការទូទាត់មានសុវត្ថិភាព</span></div></header>;
}

function PaymentLoading() {
  return <div className="checkout-page__loading"><OutlineLoader size={34} color="#38bdf8" /><p>កំពុងបើកទំព័រទូទាត់សុវត្ថិភាព…</p></div>;
}

function CheckoutUnavailable() {
  return <section className="checkout-unavailable"><CreditCard className="mx-auto h-7 w-7 text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-900">មិនអាចបើកព័ត៌មានការកម្មង់នេះបានទេ</p><p className="mt-1 text-xs leading-5 text-slate-500">ទំព័រទូទាត់អាចបើកបានតែដោយម្ចាស់ order ប៉ុណ្ណោះ។ សូមត្រឡប់ទៅគណនីរបស់អ្នក ហើយព្យាយាមម្ដងទៀត។</p><Link href="/account" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ទៅកាន់គណនី</Link></section>;
}

function OrderSummaryCard({ order, details }: { order: LedgerOrder; details: Record<string, unknown> }) {
  const customer = accountLabels(details);
  const isAdminTestPurchase = isAdminKhqrTestPurchase(details);
  const partner = details.kind === "partner_service" || details.adminQueue === "partner_service";
  return <section className="checkout-order-summary" aria-labelledby="checkout-order-title"><div className="checkout-order-summary__eyebrow"><PackageCheck className="h-4 w-4" />សង្ខេបការកម្មង់</div><div className="checkout-order-summary__main">{partner ? <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-line"><ServiceLogo text={order.productName} size={40} /></span> : <ProviderGameArtwork name={order.productName} priority showCountryFlag={false} className="h-14 w-14 shrink-0 rounded-2xl" iconClassName="h-6 w-6" />}<div className="min-w-0 flex-1"><h1 id="checkout-order-title" className="checkout-order-summary__title">{khmerDiamondCopy(order.productName)}</h1><p className="checkout-order-summary__order">#{order.orderNumber}</p></div><strong className="checkout-order-summary__amount">{formatMoney(order.subtotal, order.currency)}</strong></div><div className="checkout-order-summary__details"><SummaryDetail label="Purchase ID" value={order.trackingCode} mono />{isAdminTestPurchase ? <><SummaryDetail label="Product type" value="Admin Test Product" /><SummaryDetail label="Test status" value="Test completed" /></> : partner ? <><SummaryDetail label="ប្រភេទ" value="សេវាឌីជីថល" /><SummaryDetail label="ការដឹកជញ្ជូន" value={DELIVERY_SUMMARY[String(details.partnerDeliveryType || "")] || String(details.partnerDeliveryType || "Admin")} /><SummaryDetail label="ពេលបំពេញ" value={details.partnerDeliveryType === "CDK" ? "Paste token · upgrade" : "៥–១០ នាទី"} /><SummaryDetail label="បរិមាណ" value={customer.quantity} /></> : <><SummaryDetail label="Game ID" value={customer.playerId} /><SummaryDetail label="Server ID" value={customer.zoneId} /><SummaryDetail label="បរិមាណ" value={customer.quantity} /></>}<SummaryDetail label="USD" value={order.currency === "USD" ? formatMoney(order.subtotal, "USD") : "—"} /><SummaryDetail label="KHR" value={order.currency === "KHR" ? formatMoney(order.subtotal, "KHR") : "តម្លៃ KHR មិនមានក្នុង session នេះ"} /></div><p className="checkout-order-summary__note">{partner ? (details.partnerDeliveryType === "CDK" ? "បន្ទាប់ពីទូទាត់ សូម paste token។ រង់ចាំបន្តិច — plan នឹង upgrade។" : "បន្ទាប់ពីទូទាត់ Admin បំពេញសេវាក្នុង ៥–១០ នាទី។") : "ចំនួនទឹកប្រាក់ក្នុង QR និង receipt ត្រូវយកពី payment ledger ដែលបានបង្កើតសម្រាប់ order នេះ។"}</p></section>;
}

function SummaryDetail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div><span>{label}</span><strong className={mono ? "font-mono" : undefined}>{value}</strong></div>;
}

function PaymentUnavailable() {
  return <section className="checkout-khqr"><div className="checkout-section-heading"><div><p>PAYMENT SESSION</p><h2>កំពុងរៀបចំវិធីបង់ប្រ���ក់</h2></div><span>Pending</span></div><div className="checkout-methods__loading"><CreditCard className="h-5 w-5" />session នេះមិនទាន់មាន QR payment instruction ដែលអាចបង្ហាញបានទេ។</div></section>;
}

function KhqrPaymentExperience({ payment, order, selectedMethod, waiting, refreshing, expired, onRefresh, onViewReceipt }: { payment: LedgerPayment; order: LedgerOrder; selectedMethod: PaymentMethod | null; waiting: boolean; refreshing: boolean; expired: boolean; onRefresh: () => void; onViewReceipt: () => void }) {
  const secondsLeft = useCountdown(payment.expiresAt, waiting);
  const paid = payment.status === "paid";
  const money = splitMoney(payment.amount ?? order.subtotal, payment.currency ?? order.currency);
  return <section className={`checkout-khqr ${paid ? "checkout-khqr--paid" : ""}`} aria-live="polite">
    <div className="checkout-section-heading"><div><p>SECURE QR PAYMENT</p><h2>{paid ? "ការទូទាត់បានបញ្ជាក់" : expired ? "QR ផុតសុពលភាព" : "ស្កេនដើម្បីបង់ប្រាក់"}</h2></div>{paid ? <span className="checkout-status checkout-status--paid"><BadgeCheck className="h-4 w-4" />PAID</span> : expired ? <span className="checkout-status checkout-status--expired"><XCircle className="h-4 w-4" />EXPIRED</span> : <span className="checkout-status"><Clock3 className="h-4 w-4" />{formatCountdown(secondsLeft)}</span>}</div>
    <div className="checkout-khqr__body">
      <BakongKhqrCard merchantName="ZURS STORE" amountLabel={money.amount} currencyLabel={money.currency} paid={paid} footer={<>ស្កេនជាមួយ ABA, Bakong, Wing, ACLEDA ឬ app KHQR ណាមួយ</>} qr={<div className="checkout-qr-card">{payment.qrImageDataUrl ? <img src={payment.qrImageDataUrl} alt="KHQR payment code" className="checkout-qr-card__image" /> : <OutlineLoader size={38} color="#38bdf8" />}{paid ? <div className="fx-stamp">PAID</div> : null}</div>} />
      <div className="checkout-khqr__copy"><span className="checkout-khqr__brand"><img src={khqrLogoUrl} alt="KHQR" className="h-5 w-5 object-contain" />{selectedMethod?.name ?? "KHQR"}</span>{paid ? <p className="checkout-khqr__success-copy"><CheckCircle2 className="h-4 w-4" />ការទូទាត់ត្រូវបានផ្ទៀងផ្ទាត់ក្នុង ledger រួចរាល់។</p> : expired ? <p className="checkout-khqr__expired-copy">QR នេះផុតសុពលភាពហើយ។ សូមបង្កើត payment session ថ្មីពី order របស់អ្នក។</p> : <p className="checkout-khqr__waiting-copy"><AnimatedGlyph name="activity" size={18} color="#38bdf8" />កំពុងរង់ចាំការទូទាត់… ប្រព័ន្ធពិនិត្យស្ថានភាពរៀងរាល់ 10 វិនាទី។</p>}</div>
    </div>
    {!paid ? (
      <div className="checkout-khqr__actions">
        {payment.deeplink && !expired ? <a href={payment.deeplink} target="_blank" rel="noreferrer" className="checkout-primary-action"><ExternalLink className="h-4 w-4" />បើកកម្មវិធីធនាគារ</a> : null}
        <button type="button" disabled={!waiting || refreshing} onClick={onRefresh} className={payment.deeplink && !expired ? "checkout-secondary-action" : "checkout-primary-action"}>
          {refreshing ? <OutlineLoader size={18} color="currentColor" /> : <RefreshCw className="h-4 w-4" />}ខ្ញុំបានបង់រួចហើយ — ពិនិត្យ
        </button>
        <Link href="/account" className="checkout-cancel-action">បោះបង់ការទូទាត់</Link>
      </div>
    ) : <SuccessState order={order} onViewReceipt={onViewReceipt} onRefresh={onRefresh} />}
  </section>;
}

function SuccessState({ order, onViewReceipt, onRefresh }: { order: LedgerOrder; onViewReceipt: () => void; onRefresh?: () => void }) {
  const details = readOrderDetails(order.details);
  const isAdminTestPurchase = isAdminKhqrTestPurchase(details);
  const playerId = typeof details.playerId === "string" ? details.playerId : null;
  const cdk = publicCdkStatus(details, order.status);
  return <section className="checkout-success-state"><div className="checkout-success-state__head"><AnimatedGlyph name="success" size={34} color="#34d399" /><div><h2>{isAdminTestPurchase ? "បានទិញ Test Product ជោគជ័យ!" : "ការទូទាត់ជោគជ័យ!"}</h2><p>{isAdminTestPurchase ? "KHQR $0.02 ត្រូវបានបញ្ជាក់ និងបានកត់ត្រាជា Test Product រួចរាល់។" : cdk ? "Paste token របស់អ្នក រួចរង់ចាំបន្តិច — plan នឹង upgrade។" : "ការបញ្ជាទិញរបស់អ្នកកំពុងត្រូវបានដំណើរការ"}</p></div></div><PaymentSuccessPipeline status={order.status} productName={order.productName} isTest={isAdminTestPurchase} playerId={playerId} orderRef={order.orderNumber} />{cdk ? <CdkUpgradeCard orderId={order.id} status={order.status} cdk={cdk} productName={order.productName} onUpdated={onRefresh} /> : null}<button type="button" onClick={onViewReceipt} className="checkout-receipt-action"><FileText className="h-4 w-4" />មើលបង្កាន់ដៃ</button></section>;
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

function resolveSessionMethod(_payment: LedgerPayment | null | undefined, methods: PaymentMethod[]) { return methods.filter((method) => method.providerKey === "bakong_khqr")[0] ?? null; }
function readOrderDetails(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function isAdminKhqrTestPurchase(details: Record<string, unknown>) { return details.testPurchase === true && details.noProviderFulfillment === true; }
function accountLabels(details: Record<string, unknown>) { const player = typeof details.playerId === "string" ? details.playerId : "បានការពារ"; const zone = typeof details.zoneId === "string" && details.zoneId ? details.zoneId : "មិនទាមទារ"; const quantity = typeof details.quantity === "number" || typeof details.quantity === "string" ? String(details.quantity) : "1"; return { playerId: maskCustomerIdentifier(player), zoneId: maskCustomerIdentifier(zone), quantity }; }
function maskCustomerIdentifier(value: string) { if (["បានការពារ", "មិនទាមទារ"].includes(value) || value.length <= 5) return value; return `${value.slice(0, 2)}•••${value.slice(-3)}`; }
function splitMoney(value: string | number, currency: "KHR" | "USD") { const numeric = Number(value); if (!Number.isFinite(numeric)) return { amount: "—", currency }; return currency === "KHR" ? { amount: `៛ ${numeric.toLocaleString("km-KH", { maximumFractionDigits: 0 })}`, currency: "KHR" } : { amount: `$${numeric.toFixed(2)}`, currency: "USD" }; }
function formatMoney(value: string | number, currency: "KHR" | "USD") { const numeric = Number(value); if (!Number.isFinite(numeric)) return "—"; return currency === "KHR" ? `៛ ${numeric.toLocaleString("km-KH", { maximumFractionDigits: 0 })}` : `$${numeric.toFixed(2)} USD`; }
function formatCountdown(seconds: number) { const minutes = Math.floor(seconds / 60); const remainder = seconds % 60; return `QR នឹងផុតសុពលភាពក្នុង ${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`; }
function formatReceiptDate(value: Date | string | null | undefined) { const date = value ? new Date(value) : null; return date && Number.isFinite(date.getTime()) ? date.toLocaleString("km-KH", { dateStyle: "medium", timeStyle: "short" }) : "—"; }
