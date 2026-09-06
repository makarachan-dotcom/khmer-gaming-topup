import { Reveal } from "@/components/Reveal";
import StorefrontLayout from "@/components/StorefrontLayout";
import { Seo } from "@/components/Seo";
import { ChevronLeft, CirclePause, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "wouter";

/**
 * Wallet is intentionally paused while ZURS uses direct KHQR checkout.
 * Keep this route as a safe, reversible customer-facing notice rather than
 * deleting the route or touching wallet ledger history.
 */
export default function Wallet() {
  return <StorefrontLayout><Seo noindex /><main className="container py-6 sm:py-10 zp-page"><Reveal as="section" index={0}><section className="mx-auto max-w-2xl"><Link href="/account" className="zbtn zbtn--ghost zbtn--sm transition-colors hover:text-slate-700"><ChevronLeft className="h-4 w-4" />ត្រឡប់ទៅគណនី</Link><article className="mt-4 overflow-hidden rounded-[1.5rem] border border-slate-200 bg-slate-100/85 p-5 shadow-sm sm:p-8"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-200 text-slate-500"><WalletCards className="h-5 w-5" /></div><div><p className="text-[10px] font-bold tracking-[0.16em] text-slate-500">ZURS WALLET</p><h1 className="mt-1 font-display text-2xl font-bold text-slate-700 sm:text-3xl">Wallet បិទជាបណ្តោះអាសន្ន</h1><p className="mt-2 text-xs leading-6 text-slate-500 sm:text-sm">មុខងារ Wallet និងការបញ្ចូលប្រាក់ត្រូវបានផ្អាកជាបណ្តោះអាសន្ន។ សមតុល្យ និងប្រវត្តិដែលមានស្រាប់មិនត្រូវបានលុប ឬកែប្រែទេ។</p></div></div><div className="mt-6 rounded-2xl border border-slate-200 bg-white/70 p-4"><div className="flex items-start gap-2"><CirclePause className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" /><div><p className="text-xs font-extrabold text-slate-700">ទូទាត់តាម KHQR ដោយផ្ទាល់</p><p className="mt-1 text-xs leading-5 text-slate-500">សម្រាប់ការទិញកញ្ចប់ហ្គេម សូមជ្រើសកញ្ចប់ ហើយបន្តទៅទំព័រ payment preview ដើម្បីបង្កើត KHQR តែមួយគត់។</p></div></div></div><div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-200/70 p-3 text-[11px] leading-5 text-slate-600"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />Wallet នឹងអាចបើកប្រើឡើងវិញពេលក្រោយ។ នៅពេលនេះ មិនមាន Wallet balance, top-up QR ឬ Wallet transaction ថ្មីត្រូវបានបង្កើតទេ។</div><Link href="/topup" className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl zbtn zbtn--primary transition hover:bg-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2">បន្តទូទាត់តាម KHQR</Link></article></section></Reveal></main></StorefrontLayout>;
}
