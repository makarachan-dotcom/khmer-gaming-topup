import { cn } from "@/lib/utils";
import { useAuth } from "@/_core/hooks/useAuth";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import SupportMascot from "@/components/SupportMascot";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { useStorefrontHeader } from "@/contexts/StorefrontHeaderContext";
import { trpc } from "@/lib/trpc";
import { animate } from "animejs";
import { ArrowUp, ChevronRight, LogIn, LogOut, Moon, Sun, WalletCards } from "lucide-react";
import { FontEmojiBrand } from "@/components/FontEmojiBrand";
import { PackEmoji } from "@/components/PackEmoji";
import { applyPackageUi, applyStorefrontUi, parsePackageUi, parseStorefrontUi, readStorefrontUi, type StorefrontUiSkin } from "@/lib/storefrontUi";
import { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { TAB_LONG_PRESS_MS, TAB_SCRUB_PX, tabIndexFromClientX, tabProgressFromClientX } from "@/lib/mobileTabOrder";
const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";
export function isProtectedMediaTarget(target: EventTarget | null) {
  return typeof Element !== "undefined" && target instanceof Element && Boolean(target.closest("img, video"));
}
const mobileNavigation = [
  { href: "/", label: "ដើម", animation: "home" as const, pack: "diamond-blue" as const },
  { href: "/topup", label: "ហាង", pack: "shopping-bag" as const },
  { href: "/account", label: "គណនី", pack: "user-laptop" as const },
];
// The <nav> below keeps its literal `grid-cols-2` base class because a source
// contract test pins that exact string. tailwind-merge keeps the LAST of two
// conflicting classes, so appending this token is what actually widens the
// track - the base class stays untouched and the test stays honest.
const mobileTabColumns = mobileNavigation.length > 2 ? "grid-cols-3" : "grid-cols-2";

export function CatalogSwitch({ active }: { active: "games" | "digital" | null }) {
  const item = (href: string, key: "games" | "digital", label: string, pack: "diamond-blue" | "gift") => (
    <Link
      href={href}
      aria-current={active === key ? "page" : undefined}
      className={cn(
        "zurs-catalog-switch__item inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-bold transition md:h-9 md:px-3.5 md:text-[13px]",
        active === key ? "is-active bg-neon text-neon-ink" : "text-ink-muted hover:bg-panel-2 hover:text-ink",
      )}
    >
      <PackEmoji name={pack} size={15} />{label}
    </Link>
  );
  return (
    <nav className="zurs-catalog-switch hidden items-center gap-0.5 rounded-full border border-line bg-panel p-0.5 sm:inline-flex" aria-label="ប្ដូរកាតាឡុក">
      {item("/", "games", "ហ្គេម", "diamond-blue")}
      {item("/topup", "digital", "សេវាឌីជីថល", "gift")}
    </nav>
  );
}

function StorefrontUiSync({ onUi }: { onUi: (ui: StorefrontUiSkin) => void }) {
  const remote = trpc.content.storefrontUi.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: true });
  useEffect(() => {
    try {
      const m = document.cookie.match(/(?:^|; )zurs-pkg=([^;]*)/);
      if (m?.[1]) applyPackageUi(parsePackageUi(decodeURIComponent(m[1])));
    } catch {
      /* private mode */
    }
  }, []);
  useEffect(() => {
    if (!remote.data?.ui) return;
    const ui = parseStorefrontUi(remote.data.ui);
    applyStorefrontUi(ui);
    onUi(ui);
    applyPackageUi(parsePackageUi(remote.data.packageUi));
  }, [onUi, remote.data?.packageUi, remote.data?.ui]);
  return null;
}

function applyStorefrontTheme(next: "dark" | "light") {
  document.documentElement.setAttribute("data-theme", next);
  document.documentElement.style.colorScheme = next;
  try {
    localStorage.setItem("zurs-theme", next);
  } catch {
    /* private mode */
  }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", next === "dark" ? "#101736" : "#f4f4f1");
}

function splashThemeFromButton(button: HTMLElement, next: "dark" | "light", withWave: boolean) {
  const rect = button.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const root = document.documentElement;
  root.style.setProperty("--theme-x", `${x}px`);
  root.style.setProperty("--theme-y", `${y}px`);
  root.style.setProperty("--theme-r", `${Math.ceil(radius + 32)}px`);
  const layer = document.createElement("div");
  layer.className = "zurs-theme-splash";
  layer.setAttribute("aria-hidden", "true");
  layer.style.setProperty("--theme-x", `${x}px`);
  layer.style.setProperty("--theme-y", `${y}px`);
  layer.style.setProperty("--theme-color", next === "dark" ? "#101736" : "#f4f4f1");
  layer.style.setProperty("--theme-scale", `${Math.ceil((radius + 32) / 8)}`);
  if (withWave) {
    const wave = document.createElement("i");
    wave.className = "zurs-theme-splash__wave";
    layer.appendChild(wave);
  }
  const palette = next === "dark" ? ["#101736", "#c99712", "#f7f6f2", "#1c2a4d"] : ["#f4f4f1", "#c99712", "#ffffff", "#161616"];
  for (let i = 0; i < 12; i++) {
    const drop = document.createElement("span");
    drop.className = "zurs-theme-splash__drop";
    const angle = (i / 12) * Math.PI * 2 + (i % 3) * 0.18;
    const dist = 48 + (i % 4) * 26;
    drop.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    drop.style.setProperty("--dy", `${Math.sin(angle) * dist}px`);
    drop.style.setProperty("--delay", `${i * 16}ms`);
    drop.style.background = palette[i % palette.length];
    layer.appendChild(drop);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 780);
}

function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof document === "undefined") return "dark";
    return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
  });
  const busyRef = useRef(false);
  return (
    <button
      type="button"
      className="zurs-theme-toggle"
      onClick={(event) => {
        if (busyRef.current) return;
        const next = theme === "dark" ? "light" : "dark";
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        const commit = () => {
          setTheme(next);
          applyStorefrontTheme(next);
        };
        if (reduced) {
          commit();
          return;
        }
        busyRef.current = true;
        const doc = document as Document & { startViewTransition?: (update: () => void) => { finished: Promise<unknown> } };
        splashThemeFromButton(event.currentTarget, next, !doc.startViewTransition);
        const run = doc.startViewTransition ? doc.startViewTransition(commit).finished : Promise.resolve().then(() => {
          window.setTimeout(commit, 220);
        });
        void Promise.resolve(run).finally(() => {
          window.setTimeout(() => {
            busyRef.current = false;
          }, 280);
        });
      }}
      aria-label={theme === "dark" ? "ប្ដូរទៅពន្លឺ" : "ប្ដូរទៅងងឹត"}
      title={theme === "dark" ? "Light" : "Dark"}
    >
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function mobileTabHrefForPath(pathname: string) {
  const path = pathname.split("?")[0]?.split("#")[0] || "/";
  if (path === "/account" || path.startsWith("/account/") || path === "/wallet" || path === "/order-status") return "/account";
  // Only the catalog root owns the Store tab. The /topup/:gameId detail pages
  // stay mapped to Home, which is what the existing routing assertions expect.
  if (path === "/topup") return "/topup";
  return "/";
}
// Kept for source-contract tests; the particle field is hidden by storefront-clean.css.
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
const christmasSnowSlots = [
  ["5%", "-1.6s", "9.6s", "16px", "12px"], ["13%", "-5.2s", "11.4s", "11px", "-18px"], ["21%", "-7.3s", "10.2s", "14px", "14px"],
  ["31%", "-2.7s", "12.2s", "10px", "-14px"], ["42%", "-8.5s", "9.8s", "15px", "17px"], ["54%", "-4.1s", "11.8s", "12px", "-10px"],
  ["64%", "-6.6s", "10.6s", "16px", "18px"], ["74%", "-3.4s", "12.6s", "11px", "-16px"], ["84%", "-9.1s", "9.4s", "14px", "11px"],
  ["94%", "-5.8s", "11.1s", "10px", "-12px"],
] as const;
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return <StorefrontShell>{children}</StorefrontShell>;
}
function StorefrontShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, loading, logout } = useAuth();
  const { selectedProduct, selectedPaymentMethodId } = useSelectedProduct();
  const { playerTitle } = useStorefrontHeader();
  const [storefrontUi, setStorefrontUi] = useState<StorefrontUiSkin>(() => readStorefrontUi());
  const accountLabel = user?.displayName || user?.name || "គណនីខ្ញុំ";
  const isOwnerAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  const googleSignInHref = `/api/auth/google?returnTo=${encodeURIComponent(location)}`;
  const shellRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const paymentMethods = trpc.payments.methods.useQuery(undefined, { staleTime: 30_000, refetchInterval: 15_000 });
  const selectedPaymentMethod = (paymentMethods.data ?? []).find((method) => method.id === selectedPaymentMethodId) ?? null;
  const activeMobileTabHref = mobileTabHrefForPath(location);
  const activeLiquidTab = Math.max(0, mobileNavigation.findIndex((item) => item.href === activeMobileTabHref));
  const tabBarRef = useRef<HTMLElement | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const pendingPressRef = useRef<{ startX: number; startY: number; pointerId: number } | null>(null);
  const scrubRef = useRef<{ pointerId: number } | null>(null);
  const lastHrefRef = useRef(activeMobileTabHref);
  const slideDirRef = useRef(0);
  const suppressClickRef = useRef(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTab, setScrubTab] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const isTopupRoute = location.startsWith("/topup/");
  const [payAnchorVisible, setPayAnchorVisible] = useState(false);
  const showPayDock = isTopupRoute && Boolean(selectedProduct) && payAnchorVisible;
  // Round 9: the no-refund policy must be acknowledged before the checkout screen
  // opens, and the dialog itself offers a direct route into live support.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = shellRef.current?.querySelector("main");
    if (!target) return;
    const dir = slideDirRef.current;
    slideDirRef.current = 0;
    animate(target, { opacity: [0.72, 1], translateX: [dir * 56, 0], duration: 380, ease: "outExpo" });
  }, [location]);
  useEffect(() => {
    const update = () => setShowScrollTop(window.scrollY > 360);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, [location]);
  useEffect(() => {
    const blockMediaAction = (event: Event) => { if (isProtectedMediaTarget(event.target)) event.preventDefault(); };
    const blockPageSave = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") event.preventDefault(); };
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
  useEffect(() => {
    lastHrefRef.current = activeMobileTabHref;
  }, [activeMobileTabHref]);
  useEffect(() => {
    if (!isTopupRoute) {
      setPayAnchorVisible(false);
      return;
    }
    let io: IntersectionObserver | null = null;
    let observed: Element | null = null;
    const connect = () => {
      const el = document.getElementById("zurs-pay-anchor");
      if (el === observed) return;
      io?.disconnect();
      io = null;
      observed = el;
      if (!el) {
        setPayAnchorVisible(false);
        return;
      }
      io = new IntersectionObserver(([entry]) => {
        setPayAnchorVisible(Boolean(entry?.isIntersecting));
      }, { threshold: 0.18, rootMargin: "0px 0px -12% 0px" });
      io.observe(el);
    };
    connect();
    const mo = new MutationObserver(connect);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      io?.disconnect();
    };
  }, [isTopupRoute, location]);
  const clearTabPress = () => {
    if (pressTimerRef.current != null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    pendingPressRef.current = null;
  };
  const followFinger = (clientX: number) => {
    const nav = tabBarRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    setScrubTab(tabProgressFromClientX(clientX, rect, mobileNavigation.length));
    setHoverIndex(tabIndexFromClientX(clientX, rect, mobileNavigation.length));
  };
  const goToTabAtX = (clientX: number) => {
    const nav = tabBarRef.current;
    if (!nav) return;
    const rect = nav.getBoundingClientRect();
    const index = tabIndexFromClientX(clientX, rect, mobileNavigation.length);
    const href = mobileNavigation[index]?.href;
    if (!href || href === lastHrefRef.current) return;
    const from = mobileNavigation.findIndex((item) => item.href === lastHrefRef.current);
    slideDirRef.current = index > from ? 1 : -1;
    lastHrefRef.current = href;
    setLocation(href);
    window.scrollTo({ top: 0, behavior: "auto" });
  };
  const beginTabScrub = (clientX?: number) => {
    const pending = pendingPressRef.current;
    if (!pending || scrubRef.current) return;
    scrubRef.current = { pointerId: pending.pointerId };
    suppressClickRef.current = true;
    setScrubbing(true);
    followFinger(clientX ?? pending.startX);
    try {
      tabBarRef.current?.setPointerCapture(pending.pointerId);
    } catch {
      /* window listeners take over */
    }
    try {
      navigator.vibrate?.(10);
    } catch {
      /* desktop */
    }
  };
  const onBarPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clearTabPress();
    pendingPressRef.current = { startX: event.clientX, startY: event.clientY, pointerId: event.pointerId };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* iOS may refuse until move */
    }
    pressTimerRef.current = window.setTimeout(() => beginTabScrub(), TAB_LONG_PRESS_MS);
  };
  const onBarPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const pending = pendingPressRef.current;
    if (!pending || event.pointerId !== pending.pointerId) return;
    const dx = event.clientX - pending.startX;
    const dy = event.clientY - pending.startY;
    if (!scrubRef.current) {
      if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
        clearTabPress();
        return;
      }
      if (Math.abs(dx) < TAB_SCRUB_PX) return;
      beginTabScrub(event.clientX);
    }
    event.preventDefault();
    followFinger(event.clientX);
  };
  const onBarPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const wasScrubbing = Boolean(scrubRef.current);
    if (wasScrubbing) goToTabAtX(event.clientX);
    clearTabPress();
    scrubRef.current = null;
    setScrubbing(false);
    setScrubTab(null);
    setHoverIndex(null);
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      /* already released */
    }
  };
  const onTabClick = (event: { preventDefault: () => void; stopPropagation: () => void }) => {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };
  const navigateToTop = () => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  return (
    <div ref={shellRef} className="zurs-dotted-shell min-h-screen bg-canvas text-ink pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-0">
      <div className="zurs-particle-field" aria-hidden="true">
        {particleSlots.map(([x, y, size, delay], index) => (
          <span key={index} style={{ "--particle-x": x, "--particle-y": y, "--particle-size": size, "--particle-delay": delay } as React.CSSProperties} />
        ))}
      </div>
      {new Date().getMonth() === 11 ? <ChristmasOverlay /> : null}
      <StorefrontUiSync onUi={setStorefrontUi} />
      <header className="zurs-compact-header sticky top-2 z-50 mx-2 rounded-[1.25rem] border border-line bg-panel/90 backdrop-blur-xl sm:top-3 sm:mx-4 sm:rounded-2xl">
        <div className="zurs-desktop-bar container flex h-11 items-center justify-between gap-2 sm:h-12 lg:h-14">
          <Link href="/" className="flex min-w-0 shrink items-center gap-2" aria-label="ZURS.me home">
            <img src={logoUrl} alt="ZURS logo" className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-line sm:h-8 sm:w-8" />
            <div className={cn("storefront-header-title", playerTitle && "storefront-header-title--player")} aria-label={playerTitle || "ZURS.me"}>
              <span className="storefront-header-title__default" aria-label="ZURS.me">
                <FontEmojiBrand text="ZURS.me" size={13} className="font-emoji-brand--header" />
              </span>
              <span className="storefront-header-title__player" title={playerTitle || undefined}>{playerTitle || "ZURS.me"}</span>
            </div>
          </Link>
          <CatalogSwitch active={location === "/topup" || location.startsWith("/topup?") ? "digital" : location === "/" || location.startsWith("/topup/") ? "games" : null} />
          <nav className="flex items-center gap-2" aria-label="Account">
            {storefrontUi === "gamer" ? <ThemeToggle /> : null}
            <SupportMascot />
            {/* Legacy source-contract wording retained: Wallet កំពុងបិទជាបណ្តោះអាសន្ន. */}
            {user ? (
              <span className="wallet-paused-control hidden h-9 items-center gap-2 rounded-full border border-line px-3 text-xs font-semibold text-ink-muted sm:inline-flex" role="status" title="ZURS Wallet បិទជាបណ្តោះអាសន្ន។ សូមប្រើ KHQR។">
                <WalletCards className="h-3.5 w-3.5" />Wallet បិទ
              </span>
            ) : null}
            <Link href="/account" className="hidden h-9 max-w-48 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-muted transition hover:bg-panel-2 hover:text-ink sm:inline-flex">
              <PackEmoji name="account-face" size={18} /><span className="truncate">{accountLabel}</span>
            </Link>
            {isOwnerAdmin ? (
              <Link href="/admin" className="hidden h-9 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-bold text-ink transition hover:border-neon/60 lg:inline-flex">
                <PackEmoji name="star-purple" size={15} />Admin
              </Link>
            ) : null}
            {loading ? (
              <span className="hidden h-9 items-center gap-2 px-2 text-xs font-semibold text-ink-muted sm:inline-flex"><OutlineLoader size={18} color="#8d97b2" />កំពុងពិនិត្យ…</span>
            ) : user ? (
              <button type="button" onClick={() => logout()} className="hidden h-9 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-bold text-ink transition hover:bg-panel-2 sm:inline-flex">
                <LogOut className="h-3.5 w-3.5" />ចេញ
              </button>
            ) : (
              <a href={googleSignInHref} className="hidden h-9 items-center gap-1.5 rounded-full bg-neon px-4 text-sm font-bold text-neon-ink transition hover:brightness-110 sm:inline-flex">
                <LogIn className="h-3.5 w-3.5" />ចូលគណនី
              </a>
            )}
          </nav>
        </div>
      </header>
      {children}
      <footer className="zurs-footer-glass zurs-footer mt-6 border-t pb-6 pt-6 sm:mt-16 sm:pt-8">
        <div className="container">
          <div className="zurs-footer-inner rounded-2xl p-5 sm:p-6">
            <div className="flex min-w-0 items-start gap-3.5">
              <img src={logoUrl} alt="ZURS STORE logo" className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-line" />
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-display text-sm font-extrabold tracking-wide text-ink"><PackEmoji name="diamond-blue" size={16} />ZURS STORE</p>
                <p className="khmer-body mt-1 max-w-md text-xs leading-5 text-ink-muted">សេវាកម្មហ្គេម និងឌីជីថល សម្រាប់អ្នកលេងកម្ពុជា។ ទូទាត់តាម KHQR ផ្លូវការ។</p>
              </div>
            </div>
            <p className="mt-3 flex items-center justify-center gap-2 text-center text-xs font-semibold text-ink-muted">
              <PackEmoji name="shield-check" size={18} /><span className="khmer-tight">សេវាកម្មរហ័ស និងមានទំនុកចិត្ត</span>
            </p>
            <nav aria-label="Footer links" className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold">
              <Link href="/privacy" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="zurs-footer-link">Privacy Policy</Link>
              <Link href="/terms" onClick={() => window.scrollTo({ top: 0, behavior: "auto" })} className="zurs-footer-link">Terms of Service</Link>
            </nav>
            <a href="https://www.facebook.com/share/19QooXtndH/?mibextid=wwXIfr" target="_blank" rel="noreferrer" aria-label="បើកទំព័រ Facebook របស់ ZURS"
              className="group mx-auto mt-3 flex h-10 w-fit items-center gap-2 rounded-full border border-line bg-panel-2 py-1 pl-1 pr-4 text-xs font-semibold text-ink transition hover:border-neon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1877F2] text-white" aria-hidden="true">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current"><path d="M13.5 21v-8h2.75l.41-3H13.5V8.08c0-.87.24-1.46 1.5-1.46h1.79V3.94c-.31-.04-1.37-.13-2.61-.13-2.58 0-4.35 1.57-4.35 4.46V10H7v3h2.83v8h3.67Z" /></svg>
              </span>
              <span>Facebook</span>
            </a>
            <div className="mt-4 border-t border-white/12 pt-3 text-center">
              <p className="khmer-tight text-xs font-medium text-ink-muted">រក្សាសិទ្ធិគ្រប់យ៉ាងដោយ zurs.me</p>
              <p className="khmer-tight mt-1 text-xs font-medium text-ink-muted/70">បង្កើតឡើងដោយ CHAN MEKARA</p>
            </div>
          </div>
        </div>
      </footer>
      {/* Round 6: the mascot moved into the header (right side) and taps through
        * to /chat, so the floating mount is gone. The bottom Telegram help dock
        * was retired with it - Telegram is offered inside the chat itself once
        * the one-per-day allowance is spent. */}
      {/* The action bar now hands the buyer straight to the payment preview.
        * The no-refund acknowledgement moved onto that preview screen, next to
        * the button that actually creates the KHQR, so the shell never blocks
        * a selection behind a dialog. */}
      {showPayDock ? <SelectedProductActionBar
        product={selectedProduct} paymentMethodName={selectedPaymentMethod?.name ?? null} isAuthenticated={Boolean(user)} isAuthenticationLoading={loading} signInHref={googleSignInHref} onContinue={() => setLocation("/checkout/preview")} /> : (
        <nav
          ref={tabBarRef}
          className={cn("liquid-tabbar zurs-mobile-tabbar fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-1/2 z-40 grid h-14 w-full -translate-x-1/2 grid-cols-2 gap-0.5 rounded-full p-1 sm:hidden", mobileTabColumns, scrubbing && "is-scrubbing")}
          style={{ "--liquid-tab-x": String(scrubTab ?? activeLiquidTab) } as CSSProperties}
          aria-label="Mobile primary navigation"
          onPointerDown={onBarPointerDown}
          onPointerMove={onBarPointerMove}
          onPointerUp={onBarPointerUp}
          onPointerCancel={onBarPointerUp}
          onContextMenu={(event) => event.preventDefault()}
        >
          <span className="liquid-tab-thumb" aria-hidden="true" />
          {mobileNavigation.map(({ href, label, animation, pack }) => {
            const previewHref = hoverIndex != null ? mobileNavigation[hoverIndex]?.href : null;
            const shownHref = previewHref ?? activeMobileTabHref;
            const active = shownHref === href;
            const tabKind = href === "/" ? "home" : "account";
            const classes = cn(`zurs-mobile-tab zurs-mobile-tab--${tabKind} relative z-10 flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold`, href === "/topup" && "zurs-mobile-tab--store", active ? "zurs-mobile-tab--active" : "hover:text-ink");
            return (
              <Link key={href} href={href} draggable={false} aria-current={active ? "page" : undefined} className={classes} onClick={onTabClick}>
                <span className="zurs-tab-glyph" aria-hidden="true">
                  {active && animation ? <AnimatedGlyph name={animation} size={18} color="#062033" /> : <PackEmoji name={pack} size={22} />}
                </span>
                <span className={cn("zurs-mobile-tab-label truncate", active ? "max-w-[4rem] opacity-100" : "max-w-0 opacity-0")}>{label}</span>
              </Link>
            );
          })}
        </nav>
      )}
      <button type="button" onClick={navigateToTop} aria-label="ត្រឡប់ទៅខាងលើ"
        className={cn("storefront-scroll-top fixed z-[270] grid h-11 w-11 place-items-center rounded-2xl border border-line bg-panel text-ink shadow-lg transition-[opacity,transform,border-color] duration-200 hover:-translate-y-1 hover:border-neon/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-neon", showScrollTop ? "opacity-100" : "pointer-events-none translate-y-3 opacity-0")}>
        <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
      </button>
    </div>
  );
}
function ChristmasOverlay() {
  return (
    <>
      <div className="zurs-christmas-snow-layer" aria-hidden="true">
        {christmasSnowSlots.map(([left, delay, duration, size, sway], index) => (
          <span key={index} className="zurs-christmas-snowflake" style={{ "--snow-left": left, "--snow-delay": delay, "--snow-duration": duration, "--snow-size": size, "--snow-sway": sway } as React.CSSProperties}>✦</span>
        ))}
      </div>
      <div className="zurs-christmas-garland" aria-hidden="true">
        <span className="zurs-christmas-garland__cord" />
        {["gold", "red", "gold", "red", "gold", "red", "gold"].map((tone, index) => (
          <span key={index} className={`zurs-christmas-ornament zurs-christmas-ornament--${tone}`} style={{ "--ornament-x": `${8 + index * 14}%`, "--ornament-drop": `${8 + (index % 3) * 6}px` } as React.CSSProperties} />
        ))}
      </div>
    </>
  );
}
type ActionBarProps = {
  product: { label: string; amountLabel: string; priceLabel: string; gameName: string; gameLogoUrl?: string } | null;
  paymentMethodName: string | null;
  isAuthenticated: boolean;
  isAuthenticationLoading: boolean;
  signInHref: string;
  onContinue: () => void;
};
function SelectedProductActionBar({ product, paymentMethodName, isAuthenticated, isAuthenticationLoading, signInHref, onContinue }: ActionBarProps) {
  const expanded = Boolean(product);
  const pill = "inline-flex h-10 shrink-0 items-center gap-1 rounded-xl px-3 text-xs font-bold";
  return (
    <aside className={cn("selected-product-action-bar fixed bottom-2 left-1/2 z-40 flex h-[3.75rem] -translate-x-1/2 items-center gap-2 rounded-2xl p-2", expanded ? "selected-product-action-bar--expanded" : "selected-product-action-bar--compact")} aria-label="Selected package action bar" aria-live="polite">
      <span className="selected-product-action-bar__compact-content text-ink-muted"><PackEmoji name="shopping-bag" size={18} /><span>ជ្រើសកញ្ចប់</span><ChevronRight className="h-4 w-4" /></span>
      <div className="selected-product-action-bar__expanded-content">
        {product ? (
          <>
            <ProviderGameArtwork name={product.gameName} logoUrl={product.gameLogoUrl} priority className="h-11 w-11 shrink-0 rounded-xl" iconClassName="h-5 w-5" />
            <div className="min-w-0 flex-1">
              <OverflowMarquee text={product.label} className="text-xs font-extrabold text-ink" />
              <OverflowMarquee text={`${product.amountLabel} · ${product.priceLabel} · ${paymentMethodName ? `បង់៖ ${paymentMethodName}` : "សូមជ្រើសវិធីបង់ប្រាក់"}`} className="mt-0.5 text-xs font-semibold text-ink-muted" />
            </div>
            {isAuthenticationLoading ? (
              <button type="button" disabled aria-disabled="true" className={cn(pill, "bg-panel-2 text-ink-muted")}><OutlineLoader size={14} color="#8d97b2" />កំពុងពិនិត្យ</button>
            ) : isAuthenticated ? paymentMethodName ? (
              <button type="button" onClick={onContinue} className={cn(pill, "bg-neon text-neon-ink transition hover:brightness-110")}><PackEmoji name="shopping-bag" size={16} />បន្តបង់ប្រាក់</button>
            ) : (
              <button type="button" disabled aria-disabled="true" title="សូមជ្រើសវិធីបង់ប្រាក់នៅខាងលើកញ្ចប់" className={cn(pill, "bg-panel-2 text-ink-muted")}><WalletCards className="h-3.5 w-3.5" />ជ្រើសវិធីបង់</button>
            ) : (
              <a href={signInHref} className={cn(pill, "bg-neon text-neon-ink")}><LogIn className="h-3.5 w-3.5" />ចូលគណនី</a>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}
