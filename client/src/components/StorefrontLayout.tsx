import { startLogin } from "@/const";
import { cn } from "@/lib/utils";
import { BadgeCheck, ChevronRight, LogIn, Menu, ShieldCheck, UserRound } from "lucide-react";
import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "./ui/button";

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
      <header className="sticky top-0 z-50 border-b border-white/70 bg-white/82 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="TopUp KH home">
            <div className="grid h-9 w-9 place-items-center rounded-xl border border-dashed border-indigo-300 bg-indigo-50 text-[8px] font-bold tracking-wide text-indigo-700">LOGO</div>
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
            <Link href="/account" className="hidden sm:block"><Button variant="ghost" size="sm" className="h-9 gap-1.5 text-slate-700"><UserRound className="h-4 w-4" />គណនីខ្ញុំ</Button></Link>
            <Button onClick={() => startLogin()} size="sm" className="hidden h-9 gap-1.5 rounded-lg bg-slate-950 px-3.5 text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចូលគណនី</Button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-700 lg:hidden" aria-expanded={menuOpen} aria-label="Open navigation"><Menu className="h-4 w-4" /></button>
          </div>
        </div>
        {menuOpen && <div className="border-t border-slate-100 bg-white px-4 py-3 lg:hidden"><nav className="container grid gap-1" aria-label="Mobile navigation">{navigation.map((item) => <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} className={cn("flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold", location === item.href ? "bg-indigo-50 text-indigo-700" : "text-slate-700 hover:bg-slate-50")}>{item.label}<ChevronRight className="h-4 w-4" /></Link>)}<Link href="/account" onClick={() => setMenuOpen(false)} className="flex items-center justify-between rounded-xl px-3 py-3 text-sm font-semibold text-slate-700"><span>គណនីខ្ញុំ</span><ChevronRight className="h-4 w-4" /></Link><Button onClick={() => startLogin()} className="mt-2 bg-slate-950 text-white">ចូលគណនី</Button></nav></div>}
      </header>
      {children}
      <footer className="mt-16 border-t border-slate-200 bg-white/75 py-8">
        <div className="container flex flex-col justify-between gap-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div><p className="font-display font-bold text-slate-800">TOPUP KH</p><p className="mt-1 khmer-body">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។</p></div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800"><ShieldCheck className="h-4 w-4" /><span className="khmer-tight">ការទូទាត់ប្រកបដោយសុវត្ថិភាព</span><img src="/manus-storage/telegram-open-source-emoji_62b099ce.webp" className="h-4 w-4 object-contain" alt="Open-source Telegram emoji" /><BadgeCheck className="h-4 w-4" /></div>
        </div>
      </footer>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-slate-200 bg-white/95 px-2 py-1.5 backdrop-blur sm:hidden" aria-label="Mobile quick navigation">
        <Link href="/" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/" ? "text-indigo-700" : "text-slate-500")}>ទំព័រដើម</Link>
        <Link href="/topup" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/topup" ? "text-indigo-700" : "text-slate-500")}>Top-up</Link>
        <Link href="/marketplace" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/marketplace" ? "text-indigo-700" : "text-slate-500")}>ទីផ្សារ</Link>
        <Link href="/account" className={cn("rounded-lg py-1.5 text-center text-[10px] font-semibold", location === "/account" ? "text-indigo-700" : "text-slate-500")}>គណនី</Link>
      </nav>
    </div>
  );
}
