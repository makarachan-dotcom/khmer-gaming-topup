import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { trpc } from "@/lib/trpc";
import { animate } from "animejs";
import { ArrowUp, ChevronDown, CircleDollarSign, Crown, Eye, EyeOff, House, LogIn, ShieldCheck, UserRound, WalletCards } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";

export function isProtectedMediaTarget(target: EventTarget | null) {
  return typeof Element !== "undefined" && target instanceof Element && Boolean(target.closest("img, video"));
}

const mobileNavigation = [
  { href: "/", label: "ទំព័រដើម", icon: House, animation: "home" as const },
  { href: "/account", label: "គណនី", icon: UserRound },
];

const particleSlots = [
  ["6%", "9%", "2px", "-1.1s"], ["15%", "31%", "1px", "-3.7s"], ["24%", "17%", "2px", "-5.2s"],
  ["38%", "8%", "1px", "-2.4s"], ["49%", "27%", "2px", "-6.3s"], ["61%", "13%", "1px", "-4.6s"],
  ["74%", "36%", "2px", "-7.1s"], ["87%", "16%", "1px", "-2.9s"], ["93%", "47%", "2px", "-5.8s"],
  ["9%", "62%", "1px", "-6.7s"], ["31%", "73%", "2px", "-3.1s"], ["55%", "64%", "1px", "-7.5s"],
  ["69%", "81%", "2px", "-1.8s"], ["82%", "68%", "1px", "-4.1s"], ["45%", "91%", "1px", "-6.0s"],
  ["4%", "45%", "1px", "-4.9s"], ["18%", "84%", "2px", "-2.2s"], ["27%", "48%", "1px", "-6.9s"],
  ["41%", "39%", "1px", "-1.4s"], ["58%", "46%", "2px", "-5.5s"], ["72%", "56%", "1px", "-3.4s"],
  ["89%", "76%", "2px", "-7.4s"], ["96%", "29%", "1px", "-2.6s"],
] as const;

export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}

function StorefrontShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const { selectedProduct } = useSelectedProduct();
  const accountLabel = user?.displayName || user?.name || "គណនីខ្ញុំ";
  const isOwnerAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  const googleSignInHref = `/api/auth/google?returnTo=${encodeURIComponent(location)}`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(false);
  const wallet = trpc.wallet.summary.useQuery(undefined, { enabled: Boolean(user) });
  const displayedBalance = Number(wallet.data?.balanceKhr ?? 0).toLocaleString("km-KH", { maximumFractionDigits: 2 });
  const balanceCurrency = wallet.data?.currency ?? "KHR";
  const activeMobileTabIndex = Math.max(0, mobileNavigation.findIndex((item) => item.href === location));

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

  useEffect(() => {
    const blockMediaAction = (event: Event) => {
      if (isProtectedMediaTarget(event.target)) event.preventDefault();
    };
    const blockPageSave = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") event.preventDefault();
    };
    document.addEventListener("contextmenu", blockMediaAction, true);
    document.addEventListener("dragstart", blockMediaAction, true);
    document.addEventListener("copy", blockMediaAction, true);
    window.addEventListener("keydown", blockPageSave, true);
    return () => {
      document.removeEventListener("contextmenu", blockMediaAction, true);
      document.removeEventListener("dragstart", blockMediaAction, true);
      document.removeEventListener("copy", blockMediaAction, true);
      window.removeEventListener("keydown", blockPageSave, true);
    };
  }, []);

  const navigateToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });

  return (
    <div ref={shellRef} className="zurs-dotted-shell min-h-screen pb-20 sm:pb-0">
      <div className="zurs-particle-field" aria-hidden="true">{particleSlots.map(([x, y, size, delay], index) => <span key={index} style={{ "--particle-x": x, "--particle-y": y, "--particle-size": size, "--particle-delay": delay } as React.CSSProperties} />)}</div>
      <header className="zurs-compact-header sticky top-2 z-50 mx-3 rounded-[1.25rem] border border-white/80 bg-white/72 backdrop-blur-2xl sm:top-3 sm:mx-4 sm:rounded-2xl">
        <div className="container flex h-12 items-center justify-between gap-2 sm:h-14 sm:gap-3">
	          <Link href="/" className="flex min-w-0 shrink items-center gap-2" aria-label="ZURS.me home">
	            <img src={logoUrl} alt="ZURS logo" className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-white/90 shadow-sm sm:h-9 sm:w-9" />
	            <div className="fx-zurs-me" aria-label="ZURS.me"><span style={{ "--i": 0 } as React.CSSProperties}>Z</span><span style={{ "--i": 1 } as React.CSSProperties}>U</span><span style={{ "--i": 2 } as React.CSSProperties}>R</span><span style={{ "--i": 3 } as React.CSSProperties}>S</span><i aria-hidden="true">.</i><span style={{ "--i": 4 } as React.CSSProperties}>m</span><span style={{ "--i": 5 } as React.CSSProperties}>e</span></div>
	          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user ? <div className="relative"><button type="button" onClick={() => setBalanceVisible((current) => !current)} aria-expanded={balanceVisible} aria-pressed={balanceVisible} aria-label={balanceVisible ? "លាក់សមតុល្យ" : "បង្ហាញសមតុល្យ"} className={cn("balance-control group inline-flex h-9 items-center gap-1.5 rounded-xl border border-emerald-100 bg-emerald-50/85 px-2.5 text-emerald-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:px-3", balanceVisible && "balance-control--visible")}><span className="grid h-5 w-5 place-items-center rounded-lg bg-white text-emerald-600 shadow-sm"><WalletCards className="balance-wallet-icon h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-[-8deg]" /></span><span className="hidden text-left sm:block"><span className="block text-[8px] font-extrabold tracking-[0.12em] text-emerald-700/80">ZURS BALANCE</span><span className="-mt-0.5 block font-mono text-xs font-extrabold tabular-nums">{wallet.isLoading ? "…" : balanceVisible ? `៛ ${displayedBalance}` : "••••"}</span></span>{balanceVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}<ChevronDown className={cn("hidden h-3 w-3 transition-transform sm:block", balanceVisible && "rotate-180")} /></button>{balanceVisible && <div className="absolute right-0 top-[calc(100%+0.5rem)] w-64 overflow-hidden rounded-2xl border border-emerald-100 bg-white p-3 shadow-xl shadow-slate-950/10"><div className="flex items-start gap-2"><div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CircleDollarSign className="h-4 w-4" /></div><div><p className="text-xs font-extrabold text-slate-900">សមតុល្យ ZURS Wallet</p><p className="mt-0.5 text-[10px] leading-4 text-slate-500">សមតុល្យនេះបង្ហាញតែទិន្នន័យ Wallet ដែលបានកត់ត្រាដោយប្រព័ន្ធ។</p></div></div><div className="mt-3 flex items-center justify-between rounded-xl bg-slate-950 px-3 py-2 text-white"><span className="text-[10px] font-bold text-slate-300">Available</span><span className="font-mono text-sm font-extrabold tabular-nums">៛ {displayedBalance} {balanceCurrency}</span></div><Link href="/wallet" onClick={() => setBalanceVisible(false)} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700">បញ្ចូលប្រាក់</Link></div>}</div> : null}
            <Link href="/account" className="hidden h-9 max-w-48 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-white/70 sm:inline-flex"><UserRound className="h-4 w-4" /><span className="truncate">{accountLabel}</span></Link>
            {isOwnerAdmin ? <Link href="/admin" className="hidden h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 lg:inline-flex"><Crown className="h-3.5 w-3.5" />Admin</Link> : null}
            {loading ? <span className="hidden h-9 items-center gap-1.5 px-2 text-xs font-semibold text-slate-400 sm:inline-flex"><OutlineLoader size={18} color="#64748b" />កំពុងពិនិត្យ…</span> : user ? <button type="button" onClick={() => logout()} className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចេញពីគណនី</button> : <a href={googleSignInHref} className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចូលគណនី</a>}
	            <div className="glass-status hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold text-emerald-700 sm:flex"><AnimatedGlyph name="activity" size={18} color="#047857" />ZURS</div>
          </div>
        </div>
      </header>

      {children}

      <footer className="zurs-footer-glass mt-16 border-t pb-28 pt-8 sm:py-8">
        <div className="container grid gap-5 text-xs text-slate-500 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="flex items-center gap-3"><img src={logoUrl} alt="ZURS STORE logo" className="h-9 w-9 rounded-xl object-cover" /><div><p className="font-display font-extrabold text-slate-900">ZURS STORE</p><p className="mt-1 khmer-body">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។</p><p className="mt-1 text-[10px] font-semibold text-slate-500">© ZURS STORE · by ZURS STORE</p><div className="mt-2 inline-flex items-center gap-2 rounded-lg bg-emerald-50/85 px-3 py-2 text-emerald-800"><ShieldCheck className="h-4 w-4" /><span className="khmer-tight">សេវាកម្មរហ័ស និងមានទំនុកចិត្ត</span></div></div></div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-[11px] font-semibold text-slate-500"><Link href="/privacy" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="hover:text-indigo-700">Privacy Policy</Link><Link href="/terms" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="hover:text-indigo-700">Terms of Service</Link></div>
          <div className="hidden sm:block" />
        </div>
      </footer>

      {selectedProduct ? <SelectedProductActionBar product={selectedProduct} isAuthenticated={Boolean(user)} isAuthenticationLoading={loading} signInHref={googleSignInHref} /> : <nav className="liquid-tabbar zurs-mobile-tabbar fixed inset-x-8 bottom-2 z-40 grid h-[3.25rem] grid-cols-2 gap-0.5 rounded-full p-1 shadow-[0_10px_24px_rgba(15,23,42,0.11)] sm:hidden" style={{ "--mobile-tab-index": activeMobileTabIndex } as React.CSSProperties} aria-label="Mobile primary navigation">
        <span className="zurs-mobile-tab-indicator" aria-hidden="true" />
        {mobileNavigation.map(({ href, label, icon: Icon, animation }) => { const active = location === href; const classes = cn("zurs-mobile-tab relative z-10 flex min-w-0 flex-row items-center justify-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold transition-colors", active ? "zurs-mobile-tab--active text-slate-950" : "text-slate-500 hover:bg-white/75 hover:text-slate-800"); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={classes}>{active && animation ? <AnimatedGlyph name={animation} size={16} color="#312e81" /> : <Icon className={cn("h-3.5 w-3.5", active && "tab-icon-active")} strokeWidth={active ? 2.25 : 1.9} />}<span className="truncate">{label}</span></Link>; })}
      </nav>}
      <button type="button" onClick={navigateToTop} aria-label="ត្រឡប់ទៅខាងលើ" className={cn("fixed right-4 z-[45] hidden h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-slate-950 text-white shadow-lg shadow-slate-950/20 transition-[opacity,transform,background-color] duration-200 hover:-translate-y-1 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:grid sm:bottom-6", showScrollTop ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")}><ArrowUp className="h-5 w-5" strokeWidth={2.25} /></button>
    </div>
  );
}

function SelectedProductActionBar({ product, isAuthenticated, isAuthenticationLoading, signInHref }: { product: { label: string; amountLabel: string; priceLabel: string; gameName: string; gameLogoUrl?: string }; isAuthenticated: boolean; isAuthenticationLoading: boolean; signInHref: string }) {
  return <aside className="selected-product-action-bar fixed inset-x-2 bottom-2 z-40 flex items-center gap-2 rounded-2xl p-2 sm:hidden" aria-label="Selected package action bar" aria-live="polite">
    <ProviderGameArtwork name={product.gameName} logoUrl={product.gameLogoUrl} priority className="h-11 w-11 shrink-0 rounded-xl" iconClassName="h-5 w-5" />
    <div className="min-w-0 flex-1"><OverflowMarquee text={product.label} className="text-xs font-extrabold text-slate-950" /><OverflowMarquee text={`${product.amountLabel} · ${product.priceLabel}`} className="mt-0.5 text-[10px] font-semibold text-slate-600" /></div>
    {isAuthenticationLoading ? <button type="button" disabled aria-disabled="true" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-900/10 px-2.5 text-[10px] font-bold text-slate-500"><OutlineLoader size={14} color="#64748b" />កំពុងពិនិត្យ</button> : isAuthenticated ? <button type="button" disabled aria-disabled="true" className="inline-flex h-10 shrink-0 items-center rounded-xl bg-slate-900/10 px-2.5 text-[10px] font-bold text-slate-500">ទិញមិនទាន់បើក</button> : <a href={signInHref} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-950 px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-indigo-700"><LogIn className="h-3.5 w-3.5" />ចូលគណនីដើម្បីទិញ</a>}
  </aside>;
}
