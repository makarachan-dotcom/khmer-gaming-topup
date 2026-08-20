import { cn } from "@/lib/utils";
import { BadgeCheck, ChevronRight, LogIn, Menu, ShieldCheck, UserRound } from "lucide-react";
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";

const navigation = [
  { href: "/topup", label: "បញ្ចូលលុយហ្គេម" },
  { href: "/smm", label: "SMM" },
  { href: "/marketplace", label: "ទីផ្សារគណនី" },
];

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen pb-22 sm:pb-0">
      <header className="sticky top-0 z-50 border-b border-white/80 bg-white/72 shadow-[0_8px_28px_oklch(0.35_0.08_265/0.06)] backdrop-blur-2xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TopUp KH home">
            <div className="brand-placeholder grid h-9 w-9 place-items-center rounded-xl text-[7px] font-bold leading-[1.05] tracking-[0.06em] text-indigo-700" aria-label="Logo placeholder">YOUR<br />LOGO</div>
            <div className="leading-none">
              <p className="font-display text-sm font-bold tracking-tight text-slate-900">TOPUP KH</p>
              <p className="mt-1 text-[9px] font-semibold tracking-[0.14em] text-indigo-600">GAME & DIGITAL</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => (
              <Link key={item.href} href={item.href} className={cn("rounded-lg px-3.5 py-2 text-sm font-medium transition-colors", location === item.href ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950")}>{item.label}</Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/account" className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-white/70"><UserRound className="h-4 w-4" />គណនីខ្ញុំ</Link>
            <Link href="/google-sign-in" className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចូលគណនី</Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="grid h-9 w-9 place-items-center rounded-lg border border-white/90 bg-white/65 text-slate-700 shadow-sm backdrop-blur lg:hidden" aria-expanded={menuOpen} aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
          </div>
        </div>
        {menuOpen && <div className="border-t border-white/80 bg-white/84 px-4 py-3 shadow-xl backdrop-blur-2xl lg:hidden"><nav className="container grid gap-1" aria-label="Mobile navigation">{navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={cn("flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold", location === item.href ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50")}>{item.label}<ChevronRight className="h-4 w-4" /></Link>)}<Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-slate-700"><span>គណនីខ្ញុំ</span><ChevronRight className="h-4 w-4" /></Link><Link href="/google-sign-in" onClick={() => setMenuOpen(false)} className="mt-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-bold text-white"><LogIn className="h-4 w-4" />ចូលដោយ Google</Link></nav></div>}
      </header>
      {children}
      <footer className="mt-16 border-t border-white/80 bg-white/70 py-8 backdrop-blur-xl">
        <div className="container flex flex-col justify-between gap-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div><p className="font-display font-bold text-slate-800">TOPUP KH</p><p className="mt-1 khmer-body">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។</p></div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><ShieldCheck className="h-4 w-4" /><span className="khmer-tight">ការទូទាត់ប្រកបដោយសុវត្ថិភាព</span><img src="/manus-storage/telegram-open-source-emoji_62b099ce.webp" className="h-4 w-4 object-contain" alt="Open-source Telegram emoji" /><BadgeCheck className="h-4 w-4" /></div>
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-white/90 bg-white/82 px-2 py-1.5 shadow-[0_-8px_26px_oklch(0.35_0.08_265/0.08)] backdrop-blur-2xl sm:hidden" aria-label="Mobile quick navigation">
        <Link href="/" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/" ? "text-indigo-700" : "text-slate-500")}>ទំព័រដើម</Link>
        <Link href="/topup" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/topup" ? "text-indigo-700" : "text-slate-500")}>Top-up</Link>
        <Link href="/marketplace" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/marketplace" ? "text-indigo-700" : "text-slate-500")}>ទីផ្សារ</Link>
        <Link href="/account" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/account" ? "text-indigo-700" : "text-slate-500")}>គណនី</Link>
      </nav>
    </div>
  );
}
