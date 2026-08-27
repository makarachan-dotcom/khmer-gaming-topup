import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { ContactAdminControl } from "@/components/ContactAdminControl";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { useStorefrontHeader } from "@/contexts/StorefrontHeaderContext";
import { trpc } from "@/lib/trpc";
import { animate } from "animejs";
import { ArrowUp, ChevronRight, Crown, House, LogIn, Radio, ShieldCheck, Sparkles, UserRound, WalletCards } from "lucide-react";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";

export function isProtectedMediaTarget(target: EventTarget | null) {
  return typeof Element !== "undefined" && target instanceof Element && Boolean(target.closest("img, video"));
}

const mobileNavigation = [
  { href: "/", label: "ទំព័រដើម", icon: House, animation: "home" as const },
  { href: "/live-spin", label: "ផ្សាយផ្ទាល់", icon: Radio, live: true },
  { href: "/account", label: "គណនី", icon: UserRound },
];

export function mobileTabHrefForPath(pathname: string) {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  if (path === "/account" || path.startsWith("/account/") || path === "/wallet" || path === "/order-status") return "/account";
  if (path === "/live-spin" || path.startsWith("/live-spin/")) return "/live-spin";
  return "/";
}

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
  const { selectedProduct, selectedPaymentMethodId } = useSelectedProduct();
  const { playerTitle } = useStorefrontHeader();
  const accountLabel = user?.displayName || user?.name || "គណនីខ្ញុំ";
  const isOwnerAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  const googleSignInHref = `/api/auth/google?returnTo=${encodeURIComponent(location)}`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const paymentMethods = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000, refetchInterval: 15_000 });
  const liveSpinState = trpc.liveSpin.state.useQuery(undefined, { staleTime: 30_000, refetchInterval: 60_000, retry: false });
  const selectedPaymentMethod = (paymentMethods.data ?? []).find((method) => method.id === selectedPaymentMethodId) ?? null;
  const activeMobileTabHref = mobileTabHrefForPath(location);
  const activeMobileTabIndex = Math.max(0, mobileNavigation.findIndex((item) => item.href === activeMobileTabHref));
  const isTopupRoute = location.startsWith("/topup/");

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
    <div ref={shellRef} className="zurs-dotted-shell min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="zurs-particle-field" aria-hidden="true">{particleSlots.map(([x, y, size, delay], index) => <span key={index} style={{ "--particle-x": x, "--particle-y": y, "--particle-size": size, "--particle-delay": delay } as React.CSSProperties} />)}</div>
      <header className="zurs-compact-header sticky top-2 z-50 mx-2 rounded-[1.25rem] border border-white/80 bg-white/72 backdrop-blur-2xl sm:top-3 sm:mx-4 sm:rounded-2xl">
        <div className="container flex h-12 items-center justify-between gap-2 sm:h-14 sm:gap-3">
	          <Link href="/" className="flex min-w-0 shrink items-center gap-2" aria-label="ZURS.me home">
	            <img src={logoUrl} alt="ZURS logo" className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-white/90 shadow-sm sm:h-9 sm:w-9" />
	            <div className={`storefront-header-title ${playerTitle ? "storefront-header-title--player" : ""}`} aria-label={playerTitle || "ZURS.me"}><span className="storefront-header-title__default" aria-label="ZURS.me"><span className="fx-zurs-me"><span style={{ "--i": 0 } as React.CSSProperties}>Z</span><span style={{ "--i": 1 } as React.CSSProperties}>U</span><span style={{ "--i": 2 } as React.CSSProperties}>R</span><span style={{ "--i": 3 } as React.CSSProperties}>S</span><i aria-hidden="true">.</i><span style={{ "--i": 4 } as React.CSSProperties}>m</span><span style={{ "--i": 5 } as React.CSSProperties}>e</span></span></span><span className="storefront-header-title__player" title={playerTitle || undefined}>{playerTitle || "ZURS.me"}</span></div>
	          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user ? <div className="wallet-paused-control inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-2.5 text-slate-500 shadow-sm sm:px-3" role="status" aria-label="ZURS Wallet បិទជាបណ្តោះអាសន្ន" title="Wallet កំពុងបិទជាបណ្តោះអាសន្ន។ សូមប្រើ KHQR សម្រាប់ការទូទាត់កញ្ចប់។"><span className="grid h-5 w-5 place-items-center rounded-lg bg-slate-200 text-slate-500"><WalletCards className="h-3.5 w-3.5" /></span><span className="hidden text-left sm:block"><span className="block text-[8px] font-extrabold tracking-[0.12em] text-slate-500">ZURS WALLET</span><span className="-mt-0.5 block text-[10px] font-bold text-slate-500">បិទជាបណ្តោះអាសន្ន</span></span></div> : null}
            <Link href="/account" className="hidden h-9 max-w-48 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-slate-700 hover:bg-white/70 sm:inline-flex"><UserRound className="h-4 w-4" /><span className="truncate">{accountLabel}</span></Link>
            {isOwnerAdmin ? <Link href="/admin" className="hidden h-9 items-center gap-1.5 rounded-lg bg-amber-50 px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 lg:inline-flex"><Crown className="h-3.5 w-3.5" />Admin</Link> : null}
            {loading ? <span className="hidden h-9 items-center gap-1.5 px-2 text-xs font-semibold text-slate-400 sm:inline-flex"><OutlineLoader size={18} color="#64748b" />កំពុងពិនិត្យ…</span> : user ? <button type="button" onClick={() => logout()} className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចេញពីគណនី</button> : <a href={googleSignInHref} className="hidden h-9 items-center gap-1.5 rounded-lg bg-slate-950 px-3.5 text-sm font-bold text-white hover:bg-slate-800 sm:inline-flex"><LogIn className="h-3.5 w-3.5" />ចូលគណនី</a>}
	            <div className="glass-status hidden h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-bold text-emerald-700 sm:flex"><AnimatedGlyph name="activity" size={18} color="#047857" />ZURS</div>
          </div>
        </div>
      </header>

      <LiveSpinAnnouncement event={liveSpinState.data?.event ?? null} />
      {children}

      <footer className="zurs-footer-glass zurs-footer mt-14 border-t pb-28 pt-8 sm:mt-20 sm:py-10">
        <div className="container">
          <div className="zurs-footer-inner grid gap-7 rounded-[1.35rem] p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:p-6">
            <div className="flex min-w-0 items-start gap-3.5">
              <img src={logoUrl} alt="ZURS STORE logo" className="h-10 w-10 shrink-0 rounded-xl object-cover ring-1 ring-white/15" />
              <div className="min-w-0">
                <p className="font-display text-sm font-extrabold tracking-wide text-white">ZURS STORE</p>
                <p className="mt-1 max-w-md text-xs leading-5 text-slate-300 khmer-body">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។</p>
                <p className="mt-3 inline-flex items-center gap-2 text-[11px] font-semibold text-cyan-100"><ShieldCheck className="h-4 w-4 text-cyan-300" /><span className="khmer-tight">សេវាកម្មរហ័ស និងមានទំនុកចិត្ត</span></p>
              </div>
            </div>
            <nav aria-label="Footer links" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold sm:justify-end">
              <Link href="/privacy" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="zurs-footer-link">Privacy Policy</Link>
              <Link href="/terms" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="zurs-footer-link">Terms of Service</Link>
            </nav>
          </div>
          <div className="zurs-footer-meta flex flex-col gap-1 px-1 pt-4 text-[10px] font-medium sm:flex-row sm:items-center sm:justify-between">
            <span className="khmer-tight">រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ zurs.me</span>
            <span className="khmer-tight">សម្រាប់សហគមន៍អ្នកលេងកម្ពុជា</span>
          </div>
        </div>
      </footer>

      <ContactAdminControl paymentBarVisible={isTopupRoute} />
      {isTopupRoute ? <SelectedProductActionBar product={selectedProduct} paymentMethodName={selectedPaymentMethod?.name ?? null} isAuthenticated={Boolean(user)} isAuthenticationLoading={loading} signInHref={googleSignInHref} onContinue={() => setLocation("/checkout/preview")} /> : <nav className={cn("liquid-tabbar zurs-mobile-tabbar fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 grid h-14 w-[min(calc(100vw-1.5rem),21rem)] -translate-x-1/2 grid-cols-3 gap-0.5 rounded-full p-1 shadow-[0_10px_24px_rgba(15,23,42,0.11)] sm:hidden", activeMobileTabHref === "/live-spin" && "zurs-mobile-tabbar--live")} style={{ "--mobile-tab-index": activeMobileTabIndex } as React.CSSProperties} aria-label="Mobile primary navigation">
        <span className="zurs-mobile-tab-indicator" aria-hidden="true" />
        {mobileNavigation.map(({ href, label, icon: Icon, animation, live }) => { const active = activeMobileTabHref === href; const classes = cn("zurs-mobile-tab relative z-10 flex min-w-0 items-center justify-center gap-1 rounded-full px-1.5 py-1 text-[10px] font-bold", active ? live ? "zurs-mobile-tab--active text-amber-950" : "zurs-mobile-tab--active text-slate-950" : "text-slate-500 hover:bg-white/75 hover:text-slate-800"); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={classes}>{active && animation ? <AnimatedGlyph name={animation} size={17} color="#312e81" /> : <Icon className={cn("h-4 w-4 shrink-0", active && "tab-icon-active")} strokeWidth={active ? 2.3 : 1.9} />}<span className={cn("zurs-mobile-tab-label truncate", active ? "max-w-[3.75rem] opacity-100" : "max-w-0 opacity-0")}>{label}</span></Link>; })}
      </nav>}
      <button type="button" onClick={navigateToTop} aria-label="ត្រឡប់ទៅខាងលើ" className={cn("fixed right-4 z-[45] hidden h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-slate-950 text-white shadow-lg shadow-slate-950/20 transition-[opacity,transform,background-color] duration-200 hover:-translate-y-1 hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 sm:grid sm:bottom-6", showScrollTop ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")}><ArrowUp className="h-5 w-5" strokeWidth={2.25} /></button>
    </div>
  );
}

function LiveSpinAnnouncement({ event }: { event: { status: string; scheduledAt: Date | string } | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1_000); return () => window.clearInterval(timer); }, []);
  if (!event || !["announced", "locked", "waiting"].includes(event.status)) return null;
  const remaining = Math.max(0, Math.ceil((new Date(event.scheduledAt).getTime() - now) / 1_000));
  const hours = String(Math.floor(remaining / 3_600)).padStart(2, "0");
  const minutes = String(Math.floor((remaining % 3_600) / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  return <Link href="/live-spin" className="container mt-2 flex h-9 items-center justify-center gap-2 rounded-xl border border-cyan-200/50 bg-cyan-50 px-3 text-center text-[10px] font-bold text-cyan-950 shadow-sm transition hover:bg-cyan-100 sm:text-xs"><Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-700" /><span>Live Spin · ថ្ងៃអាទិត្យ 3:00 រសៀល</span><span className="rounded-md bg-cyan-950 px-1.5 py-0.5 font-mono text-[10px] text-white">{hours}:{minutes}:{seconds}</span></Link>;
}

function SelectedProductActionBar({ product, paymentMethodName, isAuthenticated, isAuthenticationLoading, signInHref, onContinue }: { product: { label: string; amountLabel: string; priceLabel: string; gameName: string; gameLogoUrl?: string } | null; paymentMethodName: string | null; isAuthenticated: boolean; isAuthenticationLoading: boolean; signInHref: string; onContinue: () => void }) {
  const expanded = Boolean(product);
  return <aside className={cn("selected-product-action-bar fixed bottom-2 left-1/2 z-40 flex h-[3.75rem] -translate-x-1/2 items-center gap-2 rounded-2xl p-2", expanded ? "selected-product-action-bar--expanded" : "selected-product-action-bar--compact")} aria-label="Selected package action bar" aria-live="polite">
    <span className="selected-product-action-bar__compact-content"><WalletCards className="h-4 w-4" /><span>ជ្រើសកញ្ចប់</span><ChevronRight className="h-4 w-4" /></span>
    <div className="selected-product-action-bar__expanded-content">
      {product ? <><ProviderGameArtwork name={product.gameName} logoUrl={product.gameLogoUrl} priority className="h-11 w-11 shrink-0 rounded-xl" iconClassName="h-5 w-5" /><div className="min-w-0 flex-1"><OverflowMarquee text={product.label} className="text-xs font-extrabold text-slate-950" /><OverflowMarquee text={`${product.amountLabel} · ${product.priceLabel} · ${paymentMethodName ? `បង់៖ ${paymentMethodName}` : "សូមជ្រើសវិធីបង់ប្រាក់"}`} className="mt-0.5 text-[10px] font-semibold text-slate-600" /></div>{isAuthenticationLoading ? <button type="button" disabled aria-disabled="true" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-900/10 px-2.5 text-[10px] font-bold text-slate-500"><OutlineLoader size={14} color="#64748b" />កំពុងពិនិត្យ</button> : isAuthenticated ? paymentMethodName ? <button type="button" onClick={onContinue} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-950 px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-cyan-700"><ChevronRight className="h-3.5 w-3.5" />បន្ត</button> : <button type="button" disabled aria-disabled="true" title="សូមជ្រើសវិធីបង់ប្រាក់នៅខាងលើកញ្ចប់" className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-900/10 px-2.5 text-[10px] font-bold text-slate-500"><WalletCards className="h-3.5 w-3.5" />ជ្រើសវិធី</button> : <a href={signInHref} className="inline-flex h-10 shrink-0 items-center gap-1 rounded-xl bg-slate-950 px-2.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-indigo-700"><LogIn className="h-3.5 w-3.5" />ចូលគណនីដើម្បីទិញ</a>}</> : null}
    </div>
  </aside>;
}
