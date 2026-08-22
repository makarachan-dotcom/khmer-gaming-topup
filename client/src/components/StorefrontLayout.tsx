import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { OutlineLoader } from "@/components/OutlineLoader";
import { trpc } from "@/lib/trpc";
import { animate } from "animejs";
import { ArrowUp, BarChart3, BadgeCheck, ChevronDown, CircleDollarSign, Crown, Eye, EyeOff, House, LogIn, ShieldCheck, Sparkles, Store, UserRound, WalletCards } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";

const navigation = [
  { href: "/smm", label: "SMM" },
  { href: "/marketplace", label: "ទីផ្សារគណនី" },
];

const mobileNavigation = [
  { href: "/", label: "ទំព័រដើម", icon: House, animation: "home" as const },
  { href: "/smm", label: "SMM", icon: BarChart3 },
  { href: "/marketplace", label: "ទីផ្សារ", icon: Store },
  { href: "/account", label: "គណនី", icon: UserRound },
];

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, loading, logout } = useAuth();
  const accountLabel = user?.displayName || user?.name || "គណនីខ្ញុំ";
  const isOwnerAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  const googleSignInHref = `/api/auth/google?returnTo=${encodeURIComponent(location)}`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const wallet = trpc.wallet.summary.useQuery(undefined, { enabled: Boolean(user) });
  const displayedBalance = Number(wallet.data?.balanceKhr ?? 0).toLocaleString("km-KH", { maximumFractionDigits: 2 });
  const balanceCurrency = wallet.data?.currency ?? "KHR";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = shellRef.current?.querySelector("main");
    if (!target) return;
    animate(target, { opacity: [0.82, 1], translateY: [7, 0], duration: 360, ease: "outExpo" });
  }, [location]);

  useEffect(() => {
    const updateScrollTopVisibility = () => setShowScrollTop(window.scrollY > 360);
    updateScrollTopVisibility();
    window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollTopVisibility);
  }, [location]);

  const navigateToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <div ref={shellRef} className="min-h-screen pb-24 sm:pb-0">
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
            {navigation.map((item) => { const Icon = item.href === "/smm" ? BarChart3 : Store; return <Link key={item.href} href={item.href} className={cn("inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-all hover:-translate-y-0.5", location === item.href ? "bg-indigo-50 text-indigo-700 shadow-sm" : "text-slate-600 hover:bg-white/80 hover:text-slate-950")}><Icon className="h-3.5 w-3.5" />{item.label}</Link>; })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user ? <div className="relative"><button type="button" onClick={() => setBalanceVisible((current) => !current)} aria-expanded={balanceVisible} aria-pressed={balanceVisible} aria-label={balanceVisible ? "លាក់សមតុល្យ" : "បង្ហាញសមតុល្យ"} className={cn("balance-control group inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/85 px-2.5 text-emerald-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:px-3", balanceVisible && "balance-control--visible")}><span className="grid h-5 w-5 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm"><WalletCards className="balance-wallet-icon h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[-8deg]" /></span><span className="hidden text-left sm:block"><span className="block text-[8px] font-extrabold tracking-[0.12em] text-emerald-700/80">ZURS BALANCE</span><span className="-mt-0.5 block font-mono text-xs font-extrabold tabular-nums">{wallet.isLoading ? "…" : balanceVisible ? `៛ ${displayedBalance}` : "••••"}</span></span>{balanceVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}<ChevronDown className={cn("hidden h-3 w-3 transition-transform sm:block", balanceVisible && "rotate-180")} /></button>{balanceVisible && <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-3 shadow-xl shadow-slate-950/10"><div className="flex items-start gap-2"><div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CircleDollarSign className="h-4 w-4" /></div><div><p className="text-xs font-extrabold text-slate-900">សមតុល្យ ZURS Wallet</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">សមតុល្យនេះបង្ហាញតែទិន្នន័យ Wallet ដែលបានកត់ត្រាដោយប្រព័ន្ធ។</p></div></div><div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2 text-white"><span className="text-[10px] font-bold text-slate-300">Available</span><span className="font-mono text-sm font-extrabold tabular-nums">៛ {displayedBalance} {balanceCurrency}</span></div><Link href="/wallet" onClick={() => setBalanceVisible(false)} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700">បញ្ចូលប្រាក់</Link></div>}</div> : null}
            <Link href="/account" className="hidden h-9 max-w-48 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-white/70 sm:inline-flex"><UserRound className="h-4 w-4" /><span className="truncate">{accountLabel}</span></Link>
            {isOwnerAdmin ? <Link href="/admin" className="hidden h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 lg:inline-flex"><Crown className="h-3.5 w-3.5" />Admin</Link> : null}
            {loading ? <span className="hidden h-9 items-center gap-1.5 px-2 text-xs font-semibold text-slate-400 sm:inline-flex"><OutlineLoader size={18} color="#64748b" />កំពុងពិនិត្យ…</span> : user ? <button type="button" onClick={() => logout()} className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចេញពីគណនី</button> : <a href={googleSignInHref} className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចូលគណនី</a>}
            <div className="glass-status hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold text-emerald-700 sm:flex"><AnimatedGlyph name="activity" size={18} color="#047857" />ZURS <Sparkles className="h-3 w-3 animate-pulse text-amber-500" /></div>
          </div>
        </div>
      </header>

      {children}

      <footer className="mt-16 border-t border-white/80 bg-white/70 py-8 backdrop-blur-xl">
        <div className="container grid gap-5 text-xs text-slate-500 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="flex items-center gap-3"><img src={logoUrl} alt="ZURS STORE logo" className="h-9 w-9 rounded-xl object-cover" /><div><p className="font-display font-extrabold text-slate-900">ZURS STORE</p><p className="mt-1 khmer-body">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។</p><p className="mt-1 text-[10px] font-semibold text-slate-500">© ZURS STORE · by ZURS STORE</p><div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50/85 px-3 py-2 text-emerald-800"><ShieldCheck className="h-4 w-4" /><span className="khmer-tight">សេវាកម្មរហ័ស និងមានទំនុកចិត្ត</span></div></div></div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500"><Link href="/privacy" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="hover:text-indigo-700">Privacy Policy</Link><Link href="/terms" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="hover:text-indigo-700">Terms of Service</Link></div>
          <div className="hidden sm:block" />
        </div>
      </footer>

      <nav className="liquid-tabbar fixed inset-x-2 bottom-2 z-40 grid grid-cols-4 gap-1 rounded-2xl p-1.5 sm:hidden" aria-label="Mobile primary navigation">
        {mobileNavigation.map(({ href, label, icon: Icon, animation }) => { const active = location === href; return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[9px] font-bold transition-all", active ? "bg-slate-950 text-white shadow-lg shadow-indigo-900/20" : "text-slate-500 hover:bg-white/75 hover:text-indigo-700")}>{active && animation ? <AnimatedGlyph name={animation} size={22} color="#ffffff" /> : <Icon className={cn("h-4 w-4", active && "tab-icon-active")} />}<span className="truncate">{label}</span></Link>; })}
      </nav>
      <button type="button" onClick={navigateToTop} aria-label="ត្រឡប់ទៅខាងលើ" className={cn("fixed right-4 z-[45] grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-slate-950 text-white shadow-lg shadow-slate-950/20 transition-[opacity,transform,background-color] duration-200 hover:-translate-y-1 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:bottom-6", showScrollTop ? "bottom-[5.5rem] opacity-100" : "pointer-events-none bottom-[4.5rem] translate-y-3 opacity-0")}><ArrowUp className="h-5 w-5" strokeWidth={2.25} /></button>
    </div>
  );
}
