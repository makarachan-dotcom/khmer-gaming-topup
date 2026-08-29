import StorefrontLayout from "@/components/StorefrontLayout";
import { CheckCircle2, Clock3, LockKeyhole, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

type LinkState = "loading" | "ready" | "closed" | "expired" | "used" | "error";
type PaymentData = { order: { productName: string; subtotal: string | number; currency: "KHR" | "USD"; orderNumber: string }; payment: { qrImageDataUrl: string | null; expiresAt: string; status: string } };

async function paymentRequest(path: string, init?: RequestInit) {
  const response = await fetch(path, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...init });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

export default function PaymentLink() {
  const [, params] = useRoute("/pay/:token");
  const token = params?.token ?? "";
  const [state, setState] = useState<LinkState>("loading");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void paymentRequest(`/api/pay/${encodeURIComponent(token)}`).then((result) => {
      if (!active) return;
      if (result.ok && result.data.state === "ready") { setExpiresAt(result.data.expiresAt ?? null); setState("ready"); return; }
      setState(result.data.state === "expired" ? "expired" : result.status === 403 ? "closed" : "used");
    }).catch(() => active && setState("error"));
    return () => { active = false; };
  }, [token]);

  const confirmKhqr = async () => {
    setBusy(true);
    const result = await paymentRequest(`/api/pay/${encodeURIComponent(token)}/confirm-method`, { method: "POST", body: JSON.stringify({ method: "khqr" }) });
    setBusy(false);
    if (result.ok) { setPayment(result.data as PaymentData); setState("ready"); return; }
    setState(result.status === 403 ? "closed" : result.data.state === "expired" ? "expired" : "used");
  };
  const cancel = async () => { setBusy(true); await paymentRequest(`/api/pay/${encodeURIComponent(token)}/cancel`, { method: "POST", body: "{}" }); window.location.assign("/checkout/preview"); };

  return <StorefrontLayout><main className="checkout-page container max-w-xl py-6 pb-28 sm:py-12"><section className="checkout-preview-hero"><p>KHQR PAYMENT</p><h1>ទូទាត់សុវត្ថិភាព</h1><span>Link នេះផ្ទៀងផ្ទាត់ដោយ ZURS.me — មិនអាចប្រើឡើងវិញ ឬចែករំលែកបានទេ</span></section>{state === "loading" ? <StateCard icon={<RefreshCw className="animate-spin" />} title="កំពុងផ្ទៀងផ្ទាត់ link…" /> : state === "closed" ? <StateCard icon={<XCircle />} title="ការបង់ប្រាក់ត្រូវបានបិទបណ្តោះអាសន្ន" copy="សូមព្យាយាមម្តងទៀតឆាប់ៗ ឬទាក់ទងផ្នែកជំនួយ" /> : state === "expired" ? <StateCard icon={<Clock3 />} title="Link ផុតកំណត់ហើយ" /> : state === "used" ? <StateCard icon={<XCircle />} title="Link នេះត្រូវបានប្រើរួច ឬបើកនៅឧបករណ៍ផ្សេង" /> : state === "error" ? <StateCard icon={<XCircle />} title="មិនអាចផ្ទៀងផ្ទាត់ link បានទេ" /> : <><section className="checkout-preview-confirm"><div><ShieldCheck className="h-6 w-6" /><p><strong>ការបង់ប្រាក់មានសុវត្ថិភាព</strong><span>KHQR នឹងត្រូវបង្កើតលើ server តែបន្ទាប់ពីបញ្ជាក់។</span></p></div>{payment ? <Khqr payment={payment} /> : <><p className="text-center text-xs font-semibold text-slate-600">Link ផុតកំណត់ក្នុង {formatRemaining(expiresAt)}</p><button type="button" disabled={busy} onClick={() => void confirmKhqr()} className="checkout-primary-action">{busy ? "កំពុងរៀបចំ KHQR…" : "បង្កើត KHQR ដើម្បីបង់ប្រាក់"}</button><button type="button" disabled={busy} onClick={() => void cancel()} className="checkout-secondary-action">ត្រឡប់ទៅជ្រើស package</button></>}</section></>}</main></StorefrontLayout>;
}

function Khqr({ payment }: { payment: PaymentData }) { return <section className="checkout-khqr" aria-live="polite"><div className="checkout-section-heading"><div><p>SECURE QR PAYMENT</p><h2>ស្កេនដើម្បីបង់ប្រាក់</h2></div><span className="checkout-status"><Clock3 className="h-4 w-4" />{formatRemaining(payment.payment.expiresAt)}</span></div><div className="checkout-khqr__body"><div className="checkout-qr-card">{payment.payment.qrImageDataUrl ? <img src={payment.payment.qrImageDataUrl} alt="KHQR payment code" className="checkout-qr-card__image" /> : null}</div><div className="checkout-khqr__copy"><strong>{formatMoney(payment.order.subtotal, payment.order.currency)}</strong><p>Order #{payment.order.orderNumber}</p><p className="checkout-khqr__waiting-copy">កំពុងរង់ចាំការទូទាត់…</p></div></div></section>; }
function StateCard({ icon, title, copy }: { icon: React.ReactNode; title: string; copy?: string }) { return <section className="checkout-unavailable text-center"><div className="mx-auto text-teal-600">{icon}</div><p className="mt-3 text-sm font-bold text-slate-900">{title}</p>{copy ? <p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p> : null}<Link href="/checkout/preview" className="mt-5 inline-flex h-11 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white"><LockKeyhole className="mr-2 h-4 w-4" />ត្រឡប់ទៅ checkout</Link></section>; }
function formatRemaining(value: string | null) { const seconds = value ? Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000)) : 0; return `ផុតកំណត់ក្នុង ${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }
function formatMoney(value: string | number, currency: "KHR" | "USD") { const amount = Number(value); return currency === "KHR" ? `៛ ${amount.toLocaleString("km-KH")}` : `$${amount.toFixed(2)} USD`; }
