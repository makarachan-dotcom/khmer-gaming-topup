import { OutlineLoader } from "@/components/OutlineLoader";
import StorefrontLayout from "@/components/StorefrontLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, ChevronLeft, ExternalLink, ShieldCheck, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

const quickAmounts = [100, 1000, 5000, 10000, 20000, 50000];

function formatKhr(value: string | number) {
  return Number(value || 0).toLocaleString("km-KH", { maximumFractionDigits: 0 });
}

export default function Wallet() {
  const { user, loading } = useAuth();
  const wallet = trpc.wallet.summary.useQuery(undefined, { enabled: Boolean(user) });
  const availability = trpc.wallet.topupAvailability.useQuery(undefined, { enabled: Boolean(user) });
  const [amount, setAmount] = useState("5000");
  const [topupId, setTopupId] = useState<string | null>(null);
  const session = trpc.wallet.topupSession.useQuery({ topupId: topupId ?? "pending" }, { enabled: Boolean(topupId) });
  const begin = trpc.wallet.beginTopup.useMutation({ onSuccess: (topup) => setTopupId(topup.id) });
  const utils = trpc.useUtils();
  const refresh = trpc.wallet.refreshTopup.useMutation({
    onSuccess: async (result) => {
      await utils.wallet.summary.invalidate();
      if (topupId) await utils.wallet.topupSession.invalidate({ topupId });
    },
  });
  const active = session.data ?? begin.data ?? null;
  const numericAmount = Number(amount);
  const validAmount = Number.isInteger(numericAmount) && numericAmount >= 100 && numericAmount <= 10_000_000;
  const canTopup = Boolean(user && availability.data?.available && validAmount);
  const status = active?.status;
  const paid = status === "paid";

  const paymentMessage = useMemo(() => {
    if (!active) return null;
    if (paid) return "បានបន្ថែមសមតុល្យរួចរាល់ បន្ទាប់ពីប្រព័ន្ធផ្ទៀងផ្ទាត់ KHQR។";
    if (status === "expired") return "QR នេះផុតកំណត់ហើយ។ សូមបង្កើតការបញ្ចូលប្រាក់ថ្មី។";
    return "ស្កេន KHQR រួចចុច ពិនិត្យការទូទាត់។ សមតុល្យនឹងមិនត្រូវបានបន្ថែមមុនការផ្ទៀងផ្ទាត់ទេ។";
  }, [active, paid, status]);

  return <StorefrontLayout><main className="container py-6 sm:py-10"><section className="mx-auto max-w-4xl"><Link href="/account" className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-700"><ChevronLeft className="h-4 w-4" />ត្រឡប់ទៅគណនី</Link><div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]"><aside className="surface rounded-[1.5rem] p-5 sm:p-6"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><WalletCards className="h-5 w-5" /></div><p className="mt-4 text-[10px] font-bold tracking-[0.16em] text-emerald-700">ZURS WALLET</p><h1 className="mt-1 font-display text-2xl font-bold text-slate-950">សមតុល្យរបស់ខ្ញុំ</h1><p className="mt-2 text-xs leading-6 text-slate-500">សមតុល្យត្រូវបានបង្ហាញតែបន្ទាប់ពីការទូទាត់ KHQR ត្រូវបានផ្ទៀងផ្ទាត់ដោយប្រព័ន្ធ។</p><div className="mt-5 rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-400">AVAILABLE BALANCE</p><p className="mt-1 font-mono text-2xl font-extrabold tabular-nums">៛ {loading || wallet.isLoading ? "…" : formatKhr(wallet.data?.balanceKhr ?? "0")}</p><p className="mt-1 text-[10px] font-semibold text-slate-400">KHR · ZURS Wallet</p></div><div className="mt-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[11px] leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />លុយមិនត្រូវបានបន្ថែមពីការបញ្ចូលលេខ ឬការស្កេន QR ប៉ុណ្ណោះទេ។ ប្រព័ន្ធត្រូវទទួលលទ្ធផលផ្ទៀងផ្ទាត់ពី Bakong ជាមុន។</div></aside><section className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">TOP UP BALANCE</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">បញ្ចូលប្រាក់ទៅ ZURS Wallet</h2><p className="mt-2 text-xs leading-6 text-slate-500">ជ្រើសចំនួនទឹកប្រាក់ជារៀល បង្កើត KHQR សម្រាប់តែ transaction នេះ ហើយពិនិត្យស្ថានភាពបន្ទាប់ពីបង់ប្រាក់។</p>{!loading && !user ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">សូមចូលគណនីជាមុនសិន ដើម្បីបញ្ចូលប្រាក់ និងរក្សាទុកសមតុល្យរបស់អ្នកដោយសុវត្ថិភាព។</div> : null}{user && availability.data && !availability.data.available ? <div className="mt-5 rounded-xl bg-amber-50 p-4 text-xs leading-6 text-amber-900">មុខងារបញ្ចូលប្រាក់កំពុងរង់ចាំ verified transaction ledger។ សូមព្យាយាមម្ដងទៀតនៅពេលក្រោយ។</div> : null}{!active ? <><div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5">{quickAmounts.map((value) => <button key={value} type="button" onClick={() => setAmount(String(value))} className={`h-10 rounded-xl border text-xs font-bold transition ${amount === String(value) ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-indigo-200"}`}>៛ {formatKhr(value)}</button>)}</div><label className="mt-4 block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">ចំនួនទឹកប្រាក់ (KHR)</span><input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-bold text-slate-900 outline-none focus:border-indigo-500 focus:bg-white" aria-describedby="wallet-amount-help" /><span id="wallet-amount-help" className="mt-1.5 block text-[11px] text-slate-500">អប្បបរមា ៛100 · អតិបរមា ៛10,000,000 ក្នុងមួយ transaction</span></label><button type="button" disabled={!canTopup || begin.isPending} onClick={() => begin.mutate({ amountKhr: amount })} className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">{begin.isPending ? <OutlineLoader size={19} color="#64748b" /> : <WalletCards className="h-4 w-4" />}បង្កើត KHQR បញ្ចូលប្រាក់</button>{begin.error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{begin.error.message}</p> : null}</> : <div className="mt-5"><div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="font-bold text-slate-700">លេខយោង {active.referenceCode}</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${paid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>{paid ? "បានបន្ថែម" : active.status === "expired" ? "ផុតកំណត់" : "រង់ចាំបង់"}</span></div>{active.qrImageDataUrl && !paid ? <div className="mt-4 flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-4"><img src={active.qrImageDataUrl} alt="KHQR for ZURS Wallet top-up" className="h-52 w-52 rounded-xl border border-slate-100" /><p className="mt-3 text-center text-xs font-bold text-slate-800">បង់ ៛ {formatKhr(active.amountKhr)} តាម KHQR</p>{active.deeplink ? <a href={active.deeplink} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 text-xs font-bold text-indigo-700"><ExternalLink className="h-3.5 w-3.5" />បើកកម្មវិធី Bakong</a> : null}</div> : null}<p className={`mt-4 rounded-xl p-3 text-xs leading-6 ${paid ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-900"}`}>{paymentMessage}</p>{!paid && active.status === "pending" ? <button type="button" onClick={() => refresh.mutate({ topupId: active.id })} disabled={refresh.isPending} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:bg-slate-300">{refresh.isPending ? <OutlineLoader size={19} color="#ffffff" /> : <CheckCircle2 className="h-4 w-4" />}ពិនិត្យការទូទាត់</button> : null}{refresh.error ? <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{refresh.error.message}</p> : null}<button type="button" onClick={() => { setTopupId(null); begin.reset(); }} className="mt-3 w-full text-xs font-bold text-slate-500 hover:text-indigo-700">បង្កើតការបញ្ចូលប្រាក់ថ្មី</button></div>}</section></div></section></main></StorefrontLayout>;
}
