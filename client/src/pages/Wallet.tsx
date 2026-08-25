import { OutlineLoader } from "@/components/OutlineLoader";
import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { ReceiptActionButtons, ReceiptCard } from "@/components/PaymentReceipt";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ChevronLeft, Clock3, ExternalLink, RefreshCw, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

const quickAmounts = { KHR: [100, 1000, 5000, 10000, 20000, 50000], USD: [1, 2, 5, 10, 20, 50] } as const;

function formatKhr(value: string | number) { return Number(value || 0).toLocaleString("km-KH", { maximumFractionDigits: 0 }); }
function formatPaymentAmount(value: string | number, currency: "KHR" | "USD") { return currency === "USD" ? `$${Number(value || 0).toFixed(2)}` : `៛ ${formatKhr(value)}`; }

function useCountdown(expiresAt: Date | string | null | undefined, active: boolean) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!active || !expiresAt) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, expiresAt]);
  const remaining = expiresAt ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000)) : 0;
  return { remaining, label: `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}` };
}

export default function Wallet() {
  const [, setLocation] = useLocation();
  const { user, loading } = useAuth();
  const wallet = trpc.wallet.summary.useQuery(undefined, { enabled: Boolean(user) });
  const availability = trpc.wallet.topupAvailability.useQuery(undefined, { enabled: Boolean(user) });
  const restored = trpc.wallet.activeTopup.useQuery(undefined, { enabled: Boolean(user), refetchInterval: 10_000 });
  const [currency, setCurrency] = useState<"KHR" | "USD">("KHR");
  const [amount, setAmount] = useState("5000");
  const [topupId, setTopupId] = useState<string | null>(null);
  const session = trpc.wallet.topupSession.useQuery({ topupId: topupId ?? "pending" }, { enabled: Boolean(topupId) });
  const begin = trpc.wallet.beginTopup.useMutation({ onSuccess: (topup) => setTopupId(topup.id) });
  const utils = trpc.useUtils();
  const refresh = trpc.wallet.refreshTopup.useMutation({ onSuccess: async () => { await utils.wallet.summary.invalidate(); await utils.wallet.activeTopup.invalidate(); if (topupId) await session.refetch(); } });
  const refetchSession = session.refetch;
  const sessionIsFetching = session.isFetching;
  const active = session.data ?? begin.data ?? restored.data ?? null;
  const status = active?.status;
  const waiting = status === "pending";
  const paid = status === "paid";
  const receipt = trpc.wallet.receipt.useQuery({ topupId: topupId ?? "pending" }, { enabled: Boolean(topupId && paid) });
  const [successOpen, setSuccessOpen] = useState(false);
  const countdown = useCountdown(active?.expiresAt, waiting);
  const numericAmount = Number(amount);
  const validAmount = currency === "KHR" ? Number.isInteger(numericAmount) && numericAmount >= 100 && numericAmount <= 10_000_000 : Number.isFinite(numericAmount) && numericAmount >= 0.01 && numericAmount <= 10_000;
  const canTopup = Boolean(user && availability.data?.available && validAmount && !waiting);

  useEffect(() => {
    if (!topupId && restored.data?.id) setTopupId(restored.data.id);
  }, [topupId, restored.data?.id]);

  useEffect(() => {
    if (!topupId || !waiting) return;
    const timer = window.setInterval(() => {
      if (!sessionIsFetching) {
        void refetchSession().then((result) => {
          if (result.data?.status === "paid") void utils.wallet.summary.invalidate();
        });
      }
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [topupId, waiting, sessionIsFetching, refetchSession, utils]);

  useEffect(() => { if (paid) setSuccessOpen(true); }, [paid]);

  const paymentMessage = useMemo(() => {
    if (!active) return null;
    if (paid) return "បានបន្ថែមសមតុល្យរួចរាល់ បន្ទាប់ពីប្រព័ន្ធផ្ទៀងផ្ទាត់ KHQR។";
    if (status === "expired") return "QR នេះផុតកំណត់ហើយ។ អ្នកអាចបង្កើតការបញ្ចូលប្រាក់ថ្មី។";
    if (status === "failed") return "មិនអាចបន្ត session នេះបានទេ។ សូមបង្កើតការបញ្ចូលប្រាក់ថ្មី។";
    return "ស្កេន KHQR រួចរង់ចាំប្រព័ន្ធពិនិត្យដោយស្វ័យប្រវត្តិ។ សមតុល្យនឹងមិនត្រូវបានបន្ថែមមុនការផ្ទៀងផ្ទាត់ទេ។";
  }, [active, paid, status]);

  const selectCurrency = (next: "KHR" | "USD") => { setCurrency(next); setAmount(String(quickAmounts[next][next === "KHR" ? 2 : 2])); };
  const restart = () => { setTopupId(null); begin.reset(); refresh.reset(); void utils.wallet.activeTopup.invalidate(); };

  return <StorefrontLayout><main className="container py-6 sm:py-10"><section className="mx-auto max-w-4xl"><Link href="/account" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700"><ChevronLeft className="h-4 w-4" />ត្រឡប់ទៅគណនី</Link><div className="mt-4 grid gap-4 lg:grid-cols-[0.86fr_1.14fr]"><aside className="surface rounded-[1.5rem] p-5 sm:p-6"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><WalletCards className="h-5 w-5" /></div><p className="mt-4 text-[10px] font-bold tracking-[0.16em] text-emerald-700">ZURS WALLET</p><h1 className="mt-1 font-display text-2xl font-bold text-slate-950">សមតុល្យរបស់ខ្ញុំ</h1><p className="mt-2 text-xs leading-6 text-slate-500">សមតុល្យបង្ហាញតែបន្ទាប់ពី Bakong KHQR ផ្ទៀងផ្ទាត់ចំនួនទឹកប្រាក់ និងរូបិយប័ណ្ណត្រឹមត្រូវ។</p><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">AVAILABLE BALANCE</p><p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">៛ {loading || wallet.isLoading ? "…" : formatKhr(wallet.data?.balanceKhr ?? "0")}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">KHR · ZURS Wallet</p>{Number(wallet.data?.balanceUsd ?? 0) > 0 ? <p className="mt-3 border-t border-white/10 pt-3 font-mono text-lg font-extrabold tabular-nums">${Number(wallet.data?.balanceUsd ?? 0).toFixed(2)}</p> : null}</div><div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />មិនមានការបន្ថែមសមតុល្យពី QR ឬ claim របស់អ្នកប្រើទេ។ ប្រព័ន្ធត្រូវទទួលលទ្ធផលដែលបានផ្ទៀងផ្ទាត់ពី Bakong ជាមុន។</div></aside><section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">TOP UP BALANCE</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">បញ្ចូលប្រាក់ទៅ ZURS Wallet</h2><p className="mt-2 text-xs leading-6 text-slate-500">QR មួយមានសុពលភាព 5 នាទី។ ខណៈ session កំពុងរង់ចាំ អ្នកមិនអាចបង្កើត QR ថ្មីបានទេ។</p>{!loading && !user ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">សូមចូលគណនីជាមុនសិន ដើម្បីបញ្ចូលប្រាក់ និងរក្សាទុកសមតុល្យរបស់អ្នកដោយសុវត្ថិភាព។</div> : null}{user && availability.data && !availability.data.available ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">មុខងារបញ្ចូលប្រាក់មិនទាន់បើកសម្រាប់អតិថិជនទេ។</div> : null}{!active ? <><div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => selectCurrency("KHR")} className={`h-10 rounded-lg text-xs font-extrabold transition ${currency === "KHR" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>KHR · រៀល</button><button type="button" onClick={() => selectCurrency("USD")} className={`h-10 rounded-lg text-xs font-extrabold transition ${currency === "USD" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>USD · ដុល្លារ</button></div><div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{quickAmounts[currency].map((value) => <button key={value} type="button" onClick={() => setAmount(String(value))} className={`h-10 rounded-xl border text-xs font-bold transition ${amount === String(value) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200"}`}>{formatPaymentAmount(value, currency)}</button>)}</div><label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">ចំនួនទឹកប្រាក់ ({currency})</span><input inputMode="decimal" value={amount} onChange={(event) => setAmount(currency === "KHR" ? event.target.value.replace(/\D/g, "") : event.target.value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1"))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white" /><span className="mt-1.5 block text-[11px] text-slate-500">{currency === "KHR" ? "អប្បបរមា ៛100 · អតិបរមា ៛10,000,000" : "អប្បបរមា $0.01 · អតិបរមា $10,000"} ក្នុងមួយ transaction</span></label><button type="button" disabled={!canTopup || begin.isPending} onClick={() => begin.mutate({ amount, currency })} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{begin.isPending ? <OutlineLoader size={19} color="#64748b" /> : <WalletCards className="h-4 w-4" />}បង្កើត KHQR បញ្ចូលប្រាក់</button>{begin.error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{begin.error.message}</p> : null}</> : <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="font-bold text-slate-700">លេខយោង {active.referenceCode}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${paid ? "bg-emerald-100 text-emerald-700" : status === "expired" || status === "failed" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"}`}>{paid ? "បានបន្ថែម" : status === "expired" ? "ផុតកំណត់" : status === "failed" ? "បរាជ័យ" : "រង់ចាំបង់"}</span></div>{active.qrImageDataUrl && waiting ? <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-gradient-to-b from-indigo-50/70 to-white p-4"><div className="flex w-full items-center justify-between rounded-xl bg-white/90 px-3 py-2 text-xs"><span className="inline-flex items-center gap-1.5 font-bold text-slate-700"><Clock3 className="h-4 w-4 text-indigo-600" />នៅសល់ {countdown.label}</span><span className="text-[10px] font-semibold text-slate-500">Auto-check · 10 វិនាទី</span></div><img src={active.qrImageDataUrl} alt="KHQR for ZURS Wallet top-up" className="mt-4 h-52 w-52 rounded-xl border border-slate-100 bg-white p-1" /><p className="mt-3 text-center text-sm font-extrabold text-slate-900">បង់ {formatPaymentAmount(active.amount, active.currency)}</p>{active.deeplink ? <a href={active.deeplink} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white"><ExternalLink className="h-3.5 w-3.5" />បើកកម្មវិធី Bakong</a> : null}</div> : null}<p className={`mt-4 rounded-xl p-3 text-xs leading-6 ${paid ? "bg-emerald-50 text-emerald-900" : status === "expired" || status === "failed" ? "bg-rose-50 text-rose-900" : "bg-amber-50 text-amber-900"}`}>{paymentMessage}</p>{waiting ? <button type="button" onClick={() => refresh.mutate({ topupId: active.id })} disabled={refresh.isPending || active.manualChecksRemaining <= 0} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{refresh.isPending ? <OutlineLoader size={19} color="#ffffff" /> : <RefreshCw className="h-4 w-4" />}ពិនិត្យការទូទាត់ដោយដៃ {active.manualChecksRemaining}/2</button> : null}{refresh.error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{refresh.error.message}</p> : null}{paid ? <button type="button" onClick={() => setSuccessOpen(true)} className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-extrabold text-emerald-800">មើលបង្កាន់ដៃ</button> : null}{!waiting ? <button type="button" onClick={restart} className="mt-3 inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:border-indigo-200 hover:text-indigo-700">បង្កើតការបញ្ចូលប្រាក់ថ្មី</button> : <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">ប្រព័ន្ធពិនិត្យស្ថានភាពដោយស្វ័យប្រវត្តិរាល់ 10 វិនាទី។ ប៊ូតុងពិនិត្យដោយដៃអាចប្រើបានតែ 2 ដងក្នុង QR នេះ។</p>}</div>}</section></div></section></main><WalletPaymentSuccessDialog open={successOpen} onOpenChange={setSuccessOpen} receipt={receipt.data} loading={receipt.isLoading} onView={() => { setSuccessOpen(false); if (topupId) setLocation(`/wallet/receipt/${encodeURIComponent(topupId)}`); }} /></StorefrontLayout>;
}

function WalletPaymentSuccessDialog({ open, onOpenChange, receipt, loading, onView }: { open: boolean; onOpenChange: (open: boolean) => void; receipt: Parameters<typeof ReceiptCard>[0]["receipt"] | undefined; loading: boolean; onView: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="payment-success-dialog max-h-[90dvh] overflow-y-auto border-0 bg-transparent p-0 shadow-none" showCloseButton={false}><div className="relative overflow-hidden rounded-[1.75rem] bg-white p-5 shadow-2xl"><div aria-hidden="true" className="payment-success-orb payment-success-orb--one" /><div aria-hidden="true" className="payment-success-orb payment-success-orb--two" /><div className="relative"><div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><AnimatedGlyph name="success" size={34} color="#ffffff" /></div><DialogTitle className="mt-4 text-center font-display text-2xl font-extrabold text-slate-950">បញ្ចូលប្រាក់ជោគជ័យ</DialogTitle><DialogDescription className="mt-2 text-center text-xs leading-5 text-slate-600">សមតុល្យ Wallet របស់អ្នកត្រូវបានបន្ថែមបន្ទាប់ពីការផ្ទៀងផ្ទាត់រួចរាល់។</DialogDescription><div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-bold text-emerald-700"><Sparkles className="h-4 w-4" />បញ្ជាក់ដោយប្រព័ន្ធ ZURS</div>{loading ? <div className="mt-5 grid h-48 place-items-center rounded-2xl bg-slate-50"><OutlineLoader size={28} color="#4f46e5" /></div> : receipt ? <div className="mt-5"><ReceiptCard receipt={receipt} compact /><div className="mt-4"><ReceiptActionButtons receipt={receipt} onView={onView} /></div></div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-600">កំពុងរៀបចំបង្កាន់ដៃ…</p>}<button type="button" onClick={() => onOpenChange(false)} className="mt-4 h-10 w-full rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-800">បិទ</button></div></div></DialogContent></Dialog>;
}
