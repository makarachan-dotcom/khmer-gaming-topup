import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { OutlineLoader } from "@/components/OutlineLoader";
import { PaymentMethods } from "@/components/PaymentMethods";
import { trpc } from "@/lib/trpc";
import { khqrLogoUrl } from "@/lib/mobileLegendsAssets";
import { ClipboardCheck, ClipboardList, CreditCard, ExternalLink, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Link, useLocation } from "wouter";

export default function Checkout() {
  const [location] = useLocation();
  const orderId = location.split("/").pop() ?? "";
  const session = trpc.orders.paymentSession.useQuery({ orderId }, { enabled: orderId.length >= 4 });
  const refresh = trpc.orders.refreshPayment.useMutation({ onSuccess: () => session.refetch() });
  const payment = session.data?.payment;
  const waitingForBakong = payment?.provider === "bakong_khqr" && payment.status === "pending";

  useEffect(() => {
    if (!waitingForBakong || refresh.isPending) return;
    const timer = window.setInterval(() => refresh.mutate({ orderId }), 10_000);
    return () => window.clearInterval(timer);
  }, [waitingForBakong, refresh.isPending, orderId]);

  const amount = session.data ? `${session.data.order.currency === "USD" ? "$" : "៛ "}${Number(session.data.order.subtotal).toFixed(session.data.order.currency === "USD" ? 2 : 0)}` : "";
  return <StorefrontLayout><main className="container max-w-xl pt-7 sm:pt-12"><AnimatedBackButton href="/account" className="text-xs font-bold text-indigo-700">ត្រឡប់ទៅគណនីរបស់ខ្ញុំ</AnimatedBackButton>{session.isLoading ? <div className="mt-6 grid h-64 place-items-center rounded-2xl border border-slate-200 bg-white"><OutlineLoader size={30} color="#4f46e5" /></div> : session.error || !session.data ? <div className="glass-panel mt-6 rounded-2xl p-6 text-center"><CreditCard className="mx-auto h-7 w-7 text-indigo-600" /><p className="mt-3 text-sm font-bold text-slate-900">មិនអាចបើកព័ត៌មានការកម្មង់នេះបានទេ</p><p className="mt-1 text-xs leading-5 text-slate-500">សូមត្រឡប់ទៅគណនីរបស់អ្នក ហើយព្យាយាមម្តងទៀត។</p><Link href="/account" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ទៅកាន់គណនី</Link></div> : <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/40"><div className="bg-slate-950 p-5 text-white"><div className="flex items-center gap-2 text-indigo-200"><CreditCard className="h-4 w-4" /><span className="text-xs font-bold tracking-[0.12em]">PAYMENT</span></div><h1 className="mt-3 font-display text-2xl font-bold">{session.data.order.productName}</h1><p className="mt-1 text-xs text-slate-400">{session.data.order.orderNumber}</p><p className="mt-5 font-display text-3xl font-bold">{amount}</p></div><div className="p-5"><div className="flex items-start gap-3 rounded-xl bg-indigo-50 p-4 text-xs leading-6 text-indigo-950"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" /><p><strong>សូមរក្សាទុក Purchase ID របស់អ្នក។</strong> អ្នកអាចប្រើលេខនេះដើម្បីពិនិត្យ log ស្ថានភាពពិត ឬរាយការណ៍បញ្ហា។</p></div><div className="mt-4 rounded-xl border border-indigo-100 bg-white p-3"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-500">PURCHASE ID</p><p className="mt-1 font-mono text-xs font-bold text-indigo-700">{session.data.order.trackingCode}</p></div>{payment?.provider === "bakong_khqr" ? <BakongPaymentPanel payment={payment} waiting={waitingForBakong} pending={refresh.isPending} onRefresh={() => refresh.mutate({ orderId })} /> : <PaymentMethods />}<Link href="/order-status" className="mt-5 flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white"><ClipboardList className="h-4 w-4" />ពិនិត្យស្ថានភាព និង Ticket</Link></div></section>}</main></StorefrontLayout>;
}

function BakongPaymentPanel({ payment, waiting, pending, onRefresh }: { payment: { status: string; qrImageDataUrl: string | null; deeplink: string | null; expiresAt: Date | string | null }; waiting: boolean; pending: boolean; onRefresh: () => void }) {
  if (payment.status === "paid") return <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4"><div className="flex items-center gap-2 text-sm font-bold text-emerald-900"><AnimatedGlyph name="success" size={20} color="#059669" />ការទូទាត់ត្រូវបានផ្ទៀងផ្ទាត់រួចរាល់</div><p className="mt-2 text-xs leading-5 text-emerald-800">ប្រព័ន្ធបានទទួលការបញ្ជាក់ពី Bakong រួចហើយ និងកំពុងដំណើរការសេវារបស់អ្នក។</p></div>;
  return <section className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl bg-white shadow-sm"><img src={khqrLogoUrl} alt="KHQR" className="h-5 w-5 object-contain" /></span><div><p className="text-sm font-bold text-slate-950">ទូទាត់តាម Bakong KHQR</p><p className="mt-0.5 text-[11px] text-slate-500">Scan QR ដោយកម្មវិធីធនាគារ ឬ Bakong របស់អ្នក។</p></div></div>{payment.qrImageDataUrl ? <div className="mt-4 grid place-items-center rounded-2xl bg-white p-4 shadow-sm"><img src={payment.qrImageDataUrl} alt="Bakong KHQR payment code" className="h-52 w-52 max-w-full rounded-xl object-contain" /></div> : <div className="mt-4 grid h-52 place-items-center rounded-2xl bg-white"><OutlineLoader size={34} color="#4f46e5" /></div>}{payment.deeplink ? <a href={payment.deeplink} target="_blank" rel="noreferrer" className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white text-xs font-bold text-indigo-800"><ExternalLink className="h-3.5 w-3.5" />បើកកម្មវិធី Bakong</a> : null}<button type="button" disabled={!waiting || pending} onClick={onRefresh} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-55">{pending ? <OutlineLoader size={18} color="#ffffff" /> : <ClipboardCheck className="h-4 w-4" />}ពិនិត្យការទូទាត់</button><p className="mt-3 text-center text-[11px] leading-5 text-slate-500">ប្រព័ន្ធពិនិត្យស្ថានភាពដោយស្វ័យប្រវត្តិរាល់ 10 វិនាទី។ ការបញ្ជាទិញនឹងបន្តតែបន្ទាប់ពី Bakong បញ្ជាក់ចំនួនទឹកប្រាក់ និងរូបិយប័ណ្ណត្រូវគ្នា។</p></section>;
}
