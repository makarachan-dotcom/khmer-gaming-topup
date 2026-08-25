import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { LoadingV2 } from "@/components/OutlineLoader";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CreditCard, LockKeyhole, Power, ShieldCheck } from "lucide-react";

const ownerEmail = "chanmakara672@gmail.com";

export default function AdminPayment() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.email?.toLowerCase() !== ownerEmail) return <div className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 text-lg font-bold text-slate-950">Owner access only</h1><p className="mt-2 text-sm leading-6 text-slate-600">មានតែម្ចាស់ ZURS STORE ប៉ុណ្ណោះដែលអាចបើក ឬបិទការទូទាត់សាធារណៈបាន។</p></div></div>;
  return <DashboardLayout><PaymentWorkspace /></DashboardLayout>;
}

function PaymentWorkspace() {
  const control = trpc.admin.paymentControl.useQuery();
  const readiness = trpc.payments.readiness.useQuery();
  const merchantPreflight = trpc.admin.paymentMerchantPreflight.useQuery();
  const latestVerification = trpc.wallet.latestVerification.useQuery(undefined, { staleTime: 15_000, refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const update = trpc.admin.setPaymentControl.useMutation({ onSuccess: () => { utils.admin.paymentControl.invalidate(); utils.payments.readiness.invalidate(); utils.wallet.topupAvailability.invalidate(); } });
  const enabled = control.data?.enabled === true;
  const ready = readiness.data?.ready === true;
  const customerPaymentsAvailable = enabled && ready;
  return <main className="mx-auto max-w-3xl pb-10"><header><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">OWNER SECURITY</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">Payment Control</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">ប៊ូតុងនេះគ្រប់គ្រងការបង្កើត KHQR សាធារណៈសម្រាប់ Wallet និង checkout។ វាមិនរំខានការផ្ទៀងផ្ទាត់ payment session ដែលមានរួចទេ។</p></header>
    <section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className={enabled ? "bg-emerald-50 p-6" : "bg-amber-50 p-6"}><div className="flex items-start gap-3"><span className={enabled ? "grid h-11 w-11 place-items-center rounded-2xl bg-emerald-600 text-white" : "grid h-11 w-11 place-items-center rounded-2xl bg-amber-500 text-white"}>{enabled ? <Power className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}</span><div><p className="text-sm font-extrabold text-slate-950">{customerPaymentsAvailable ? "ការទូទាត់សាធារណៈកំពុងបើក" : enabled ? "Owner switch កំពុងបើក ប៉ុន្តែការទូទាត់នៅតែត្រូវបានទប់ស្កាត់" : "ការទូទាត់សាធារណៈកំពុងបិទ"}</p><p className="mt-1 text-xs leading-5 text-slate-600">{customerPaymentsAvailable ? "អតិថជនអាចបង្កើត KHQR តាម merchant configuration ដែលបានត្រៀមរួច។" : enabled ? "បញ្ចប់ Bakong/KHQR readiness សិន; customer មិនអាចបង្កើត payment session ថ្មីបានទេ។" : "អតិថជនមិនអាចបង្កើត KHQR ឬចាប់ផ្ដើម payment session ថ្មីបានទេ។"}</p></div></div></div><div className="space-y-4 p-6">
      <ReadinessRow icon={<CreditCard className="h-5 w-5 text-indigo-600" />} title="Bakong readiness" detail={readiness.isLoading ? "កំពុងពិនិត្យ…" : ready ? "Ready for an owner-approved activation test" : readiness.data?.reason === "payment_switch_off" ? "Credentials are ready; owner switch remains OFF" : readiness.data?.reason === "merchant_unverified" ? "Merchant preflight has not been verified" : "Merchant configuration is not ready"} badge={ready ? "READY" : "BLOCKED"} positive={ready} />
      <ReadinessRow icon={<ShieldCheck className="h-5 w-5 text-indigo-600" />} title="Merchant preflight" detail={merchantPreflight.isLoading ? "កំពុងពិនិត្យ…" : merchantPreflight.data?.status === "verified" ? "Receiver account បានទទួលស្គាល់ដោយ Bakong" : merchantPreflight.data?.status === "account_not_found" ? "Bakong មិនទទួលស្គាល់ receiver account" : merchantPreflight.data?.status === "configuration_missing" ? "Merchant configuration ខ្វះ" : "Bakong មិនអាចផ្ទៀងផ្ទាត់បានឥឡូវនេះ"} badge={merchantPreflight.data?.status === "verified" ? "VERIFIED" : "CHECK"} positive={merchantPreflight.data?.status === "verified"} />
      <LatestWalletVerification result={latestVerification.data} loading={latestVerification.isLoading} />
      {update.error ? <p className="text-xs text-rose-600">{update.error.message}</p> : null}
      <button type="button" onClick={() => update.mutate({ enabled: !enabled })} disabled={control.isLoading || update.isPending} className={enabled ? "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-40" : "flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-40"}>{update.isPending ? <LoadingV2 size={16} color="#ffffff" className="h-4 w-4" /> : enabled ? <LockKeyhole className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}{enabled ? "បិទការទូទាត់សាធារណៈ" : "បើកការទូទាត់សាធារណៈ"}</button><p className="text-center text-[10px] leading-4 text-slate-500">Owner អាចប្ដូរ switch បានគ្រប់ពេល; customer payment នៅតែត្រូវ readiness gate ទប់ស្កាត់រហូតដល់ Bakong/KHQR ready។</p></div></section></main>;
}

function ReadinessRow({ icon, title, detail, badge, positive }: { icon: React.ReactNode; title: string; detail: string; badge: string; positive: boolean }) {
  return <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center gap-3">{icon}<div><p className="text-xs font-bold text-slate-900">{title}</p><p className="mt-0.5 text-[11px] text-slate-500">{detail}</p></div></div><span className={positive ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800" : "rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"}>{badge}</span></div>;
}

function LatestWalletVerification({ result, loading }: { result: { status: string; amount: string; currency: "KHR" | "USD"; providerStatus: "paid" | "unpaid" | "unavailable"; paidAt: Date | null; creditedAt: Date | null; expiresAt: Date } | null | undefined; loading: boolean }) {
  const outcome = result?.providerStatus === "paid" && result.paidAt && result.creditedAt ? "VERIFIED CREDIT" : result?.providerStatus === "paid" ? "PROVIDER PAID" : result?.providerStatus === "unpaid" ? "NOT FOUND" : "CHECK";
  const detail = loading ? "កំពុងពិនិត្យ safe verification fields…" : !result ? "មិនមាន Wallet session សម្រាប់ផ្ទៀងផ្ទាត់" : `${result.status.toUpperCase()} · ${result.currency === "KHR" ? `៛ ${Number(result.amount).toLocaleString("km-KH")}` : `$${Number(result.amount).toFixed(2)}`} · provider ${result.providerStatus}`;
  return <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-slate-900">Latest Wallet verification</p><p className="mt-0.5 text-[11px] text-slate-500">{detail}</p></div><span className={outcome === "VERIFIED CREDIT" ? "rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800" : "rounded-full bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700"}>{outcome}</span></div>{result ? <p className="mt-2 text-[10px] leading-4 text-slate-500">paidAt: {result.paidAt ? "yes" : "no"} · creditedAt: {result.creditedAt ? "yes" : "no"} · expiry: {new Date(result.expiresAt).toLocaleString()}</p> : null}</div>;
}
