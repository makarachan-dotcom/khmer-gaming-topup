import { cn } from "@/lib/utils";
import { BarChart3, BadgeCheck, Gamepad2, House, LogIn, ShieldCheck, Store, UserRound } from "lucide-react";
import { ReactNode } from "react";
import { Link, useLocation } from "wouter";

const logoUrl = "/manus-storage/zurs-store-logo_f5574a1d.jpg";

const navigation = [
  { href: "/topup", label: "បញ្ចូលលុយហ្គេម" },
  { href: "/smm", label: "SMM" },
  { href: "/marketplace", label: "ទីផ្សារគណនី" },
];

const mobileNavigation = [
  { href: "/", label: "ទំព័រដើម", icon: House },
  { href: "/topup", label: "Top-up", icon: Gamepad2 },
  { href: "/smm", label: "SMM", icon: BarChart3 },
  { href: "/marketplace", label: "ទីផ្សារ", icon: Store },
  { href: "/account", label: "គណនី", icon: UserRound },
];

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen pb-24 sm:pb-0">
      <header className="sticky top-0 z-50 border-b border-white/75 bg-white/68 shadow-[0_8px_28px_oklch(0.35_0.08_265/0.06)] backdrop-blur-2xl">
        <div className="container flex h-15 items-center justify-between gap-3 sm:h-16">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2.5" aria-label="ZURS STORE home">
            <img src={logoUrl} alt="ZURS STORE logo" className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/90 shadow-sm" />
            <div className="min-w-0 leading-none">
              <p className="truncate font-display text-sm font-extrabold tracking-tight text-slate-950">ZURS STORE</p>
              <p className="mt-1 text-[8px] font-bold tracking-[0.16em] text-indigo-600">GAMING &amp; DIGITAL</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
            {navigation.map((item) => <Link key={item.href} href={item.href} className={cn("rounded-lg px-3.5 py-2 text-sm font-medium transition-colors", location === item.href ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-white/80 hover:text-slate-950")}>{item.label}</Link>)}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link href="/account" className="hidden h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-white/70 sm:inline-flex"><UserRound className="h-4 w-4" />គណនីខ្ញុំ</Link>
            <Link href="/google-sign-in" className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចូលគណនី</Link>
            <div className="glass-status hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold text-emerald-700 sm:flex"><BadgeCheck className="h-3.5 w-3.5" />ZURS</div>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-16 border-t border-white/80 bg-white/70 py-8 backdrop-blur-xl">
        <div className="container flex flex-col justify-between gap-5 text-xs text-slate-500 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3"><img src={logoUrl} alt="ZURS STORE logo" className="h-9 w-9 rounded-xl object-cover" /><div><p className="font-display font-extrabold text-slate-900">ZURS STORE</p><p className="mt-1 khmer-body">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។</p></div></div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50/85 px-3 py-2 text-emerald-800"><ShieldCheck className="h-4 w-4" /><span className="khmer-tight">សេវាកម្មរហ័ស និងមានទំនុកចិត្ត</span></div>
        </div>
      </footer>

      <nav className="liquid-tabbar fixed inset-x-2 bottom-2 z-40 grid grid-cols-5 gap-1 rounded-2xl p-1.5 sm:hidden" aria-label="Mobile primary navigation">
        {mobileNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={cn("flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-bold transition-all", location === href ? "bg-slate-950 text-white shadow-lg shadow-indigo-900/20" : "text-slate-500 hover:bg-white/75 hover:text-indigo-700")}><Icon className="h-4 w-4" /><span className="truncate">{label}</span></Link>)}
      </nav>
    </div>
  );
}
