import StorefrontLayout from "@/components/StorefrontLayout";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { Link } from "wouter";

const sparklesEmoji = "/manus-storage/sparkles_49998449.svg";

export default function Account() {
  return <StorefrontLayout><main className="container grid min-h-[calc(100vh-13rem)] place-items-center py-6 sm:py-10"><section className="glass-panel relative w-full max-w-2xl overflow-hidden rounded-[1.5rem] p-5 sm:p-9"><img src={sparklesEmoji} alt="" aria-hidden="true" className="emoji-asset float-emoji absolute right-8 top-7 h-7 w-7" /><div className="relative max-w-lg"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">MY ZURS</p><h1 className="mt-2 font-display text-2xl font-bold leading-tight text-slate-950 sm:text-4xl">គណនីរបស់អ្នក</h1><p className="mt-3 text-xs leading-6 text-slate-600 sm:text-sm sm:leading-7">ចូលគណនីរបស់អ្នក ដើម្បីរក្សាទុកព័ត៌មាន និងគ្រប់គ្រងសកម្មភាពរបស់អ្នកជាមួយ ZURS STORE។</p><div className="mt-5 rounded-xl border border-white/90 bg-white/65 p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><UserRound className="h-5 w-5" /></div><div><p className="text-sm font-bold text-slate-900">ZURS Member</p><p className="mt-0.5 text-xs text-slate-500">ចូលគណនីរបស់អ្នកដើម្បីបន្ត។</p></div></div><div className="mt-4 flex items-center gap-2 text-xs text-emerald-800"><ShieldCheck className="h-4 w-4" />ប្រើប្រាស់បានងាយស្រួល និងមានទំនុកចិត្ត</div></div><Link href="/google-sign-in" className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ចូលគណនី <ArrowRight className="h-4 w-4" /></Link></div></section></main></StorefrontLayout>;
}
