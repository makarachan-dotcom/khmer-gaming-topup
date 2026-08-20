import StorefrontLayout from "@/components/StorefrontLayout";
import { trpc } from "@/lib/trpc";
import { ArrowRight, CircleDollarSign, Gamepad2, HeartHandshake, ShieldCheck, Sparkles, TrendingUp, UsersRound } from "lucide-react";
import { Link } from "wouter";

const emoji = {
  gamepad: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/RDtUjAOwCGqQQWNR.svg",
  diamond: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/DwbIkeuSyFFKbYEk.svg",
  sparkles: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kXzBrYNIYeExUoGY.svg",
};

const quickLinks = [
  { href: "/topup", icon: Gamepad2, label: "បញ្ចូលលុយហ្គេម", copy: "ងាយស្រួល និងរហ័ស" },
  { href: "/smm", icon: TrendingUp, label: "Social Boost", copy: "សម្រាប់គណនីរបស់អ្នក" },
  { href: "/marketplace", icon: UsersRound, label: "ទីផ្សារគណនី", copy: "ទិញ លក់ និងដូរ" },
];

export default function Home() {
  const listings = trpc.marketplace.list.useQuery();

  return <StorefrontLayout><main>
    <section className="container pt-4 sm:pt-12">
      <div className="premium-shine relative overflow-hidden rounded-[1.25rem] bg-slate-950 px-4 py-6 text-white shadow-2xl shadow-indigo-900/20 sm:rounded-[2rem] sm:px-10 sm:py-12">
        <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-indigo-500/40 blur-3xl" /><div className="absolute bottom-0 left-1/4 h-32 w-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
        <div className="glass-orb absolute right-[12%] top-[15%] grid h-10 w-10 place-items-center rounded-xl sm:h-13 sm:w-13"><img src={emoji.diamond} alt="" aria-hidden="true" className="emoji-asset h-6 w-6 sm:h-8 sm:w-8" /></div>
        <div className="glass-orb float-emoji float-emoji--slow bottom-[15%] right-[5%] grid h-8 w-8 place-items-center rounded-full sm:h-10 sm:w-10"><img src={emoji.sparkles} alt="" aria-hidden="true" className="emoji-asset h-5 w-5 sm:h-6 sm:w-6" /></div>
        <div className="relative grid items-end gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="max-w-2xl"><div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-indigo-100"><Sparkles className="h-3.5 w-3.5 text-amber-300" />ZURS STORE • GAMING &amp; DIGITAL</div><h1 className="font-display text-[1.8rem] font-bold leading-[1.14] tracking-tight sm:text-5xl">លេងឱ្យសប្បាយ។<br /><span className="text-indigo-300">ទូទាត់ដោយ</span> ទំនុកចិត្ត។</h1><p className="mt-3 max-w-xl text-[13px] leading-6 text-slate-300 sm:mt-4 sm:text-base sm:leading-7">កន្លែងតែមួយសម្រាប់សេវាកម្មហ្គេម, Social Boost និងទីផ្សារគណនី ដែលរៀបចំឱ្យខ្លី ច្បាស់ និងងាយប្រើតាមទូរស័ព្ទ។</p><div className="mt-5 flex flex-wrap gap-2.5"><Link href="/topup" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-3.5 text-xs font-bold text-slate-950 transition-transform hover:-translate-y-0.5 active:scale-[0.97]">សេវាហ្គេម <ArrowRight className="h-4 w-4" /></Link><Link href="/marketplace" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-white/10">ស្វែងរកទីផ្សារ</Link></div></div>
          <div className="grid grid-cols-2 gap-2 sm:max-w-sm lg:ml-auto"><HeroMetric icon={ShieldCheck} label="ប្រើងាយ" value="សម្រាប់អ្នកលេង" /><HeroMetric icon={CircleDollarSign} label="ទំនុកចិត្ត" value="ព័ត៌មានច្បាស់លាស់" /></div>
        </div>
      </div>
    </section>

    <section className="container mt-3 grid gap-2 sm:mt-7 sm:grid-cols-3">{quickLinks.map(({ href, icon: Icon, label, copy }) => <Link key={href} href={href} className="group surface flex items-center gap-2.5 rounded-xl p-3 transition-all hover:-translate-y-0.5 hover:shadow-lg"><div className="grid h-9 w-9 place-items-center rounded-lg bg-indigo-50 text-indigo-700"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-[13px] font-bold text-slate-900">{label}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{copy}</p></div><ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link>)}</section>

    <section className="container mt-9 grid gap-4 sm:mt-16 lg:grid-cols-[1.08fr_0.92fr]">
      <div className="glass-panel relative overflow-hidden rounded-[1.5rem] p-6 sm:p-8"><img src={emoji.gamepad} alt="" aria-hidden="true" className="emoji-asset float-emoji absolute right-7 top-6 h-8 w-8" /><div className="flex items-center gap-2 text-indigo-700"><Gamepad2 className="h-5 w-5" /><span className="text-xs font-bold tracking-[0.12em]">GAMING SERVICES</span></div><h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-950">សេវាកម្មសម្រាប់អ្នកលេង</h2><p className="mt-3 max-w-lg text-sm leading-7 text-slate-600">ចូលទៅកាន់ផ្នែកហ្គេមរបស់អ្នក ដើម្បីពិនិត្យមើលសេវាកម្មដែលមាន និងរៀបចំការកម្មង់បានយ៉ាងងាយស្រួល។</p><Link href="/topup" className="mt-6 inline-flex h-10 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-[0.97]">ទៅកាន់សេវាហ្គេម <ArrowRight className="h-4 w-4" /></Link></div>
      <div className="surface relative overflow-hidden rounded-[1.5rem] p-6 sm:p-8"><img src={emoji.sparkles} alt="" aria-hidden="true" className="emoji-asset float-emoji float-emoji--slow absolute right-7 top-6 h-7 w-7" /><div className="flex items-center gap-2 text-fuchsia-700"><HeartHandshake className="h-5 w-5" /><span className="text-xs font-bold tracking-[0.12em]">ACCOUNT MARKETPLACE</span></div><h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-950">លក់ ទិញ ឬដូរគណនី</h2><div className="mt-4 space-y-3">{listings.isLoading ? <><div className="h-14 animate-pulse rounded-xl bg-slate-100" /><div className="h-14 animate-pulse rounded-xl bg-slate-100" /></> : listings.data?.length ? listings.data.slice(0, 2).map((listing) => <div key={listing.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3"><p className="text-sm font-bold text-slate-800">{listing.title}</p><p className="mt-0.5 text-xs text-slate-500">{listing.rankLevel}</p></div>) : <p className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">ការផ្សាយថ្មីនឹងបង្ហាញនៅទីនេះ។</p>}</div><Link href="/marketplace" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-indigo-700">ចូលទៅកាន់ទីផ្សារ <ArrowRight className="h-4 w-4" /></Link></div>
    </section>

    <section className="container mt-12 grid gap-3 sm:mt-16 sm:grid-cols-3"><Trust icon={ShieldCheck} title="ប្រើដោយទំនុកចិត្ត" copy="ការកម្មង់ និងព័ត៌មានសំខាន់ៗត្រូវបានរៀបចំឱ្យងាយតាមដាន។" /><Trust icon={TrendingUp} title="សេវាកម្មគ្រប់គ្រាន់" copy="ហ្គេម Social Boost និងទីផ្សារគណនីនៅកន្លែងតែមួយ។" /><Trust icon={UsersRound} title="ទីផ្សារមានការគ្រប់គ្រង" copy="ការផ្សាយថ្មីត្រូវឆ្លងកាត់ការពិនិត្យសិន។" /></section>
  </main></StorefrontLayout>;
}

function HeroMetric({ icon: Icon, label, value }: { icon: typeof ShieldCheck; label: string; value: string }) { return <div className="rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur"><Icon className="h-5 w-5 text-emerald-300" /><p className="mt-5 text-xs text-slate-300">{label}</p><p className="mt-1 font-display text-lg font-bold">{value}</p></div>; }
function Trust({ icon: Icon, title, copy }: { icon: typeof ShieldCheck; title: string; copy: string }) { return <div className="flex gap-3 p-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-4 w-4" /></div><div><h3 className="text-sm font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{copy}</p></div></div>; }
