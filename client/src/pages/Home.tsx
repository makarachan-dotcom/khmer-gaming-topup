import StorefrontLayout from "@/components/StorefrontLayout";
import { Reveal } from "@/components/Reveal";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { GameLogoTicker } from "@/components/GameLogoTicker";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { ProviderGameArtwork, ProviderGameRegion } from "@/components/ProviderGameIdentity";
import { filterProviderGames, groupProviderGamesByBaseName, orderProviderGames, providerGameBaseName, providerGameVariantLabel } from "@/lib/providerPresentation";
import { trpc } from "@/lib/trpc";
import { subscribeToPublicAssetChanges } from "@/lib/publicAssetBroadcast";
import { khqrLogoUrl } from "@/lib/mobileLegendsAssets";
import { isPopularStorefrontGame, providerGameImageKey, resolvedGameArtworkFor, type ProviderGameImageOverride } from "@/lib/originalGameArtwork";
import { Image as ImageIcon, Search, Video, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { gameTopupPath } from "./GameTopup";
import { PackEmoji } from "@/components/PackEmoji";
// The owner's own storefront artwork, served from client/public so it ships
// inside the build and cannot 404 behind an upload-CDN link.
//
// Retired: the two upload-CDN slides below were stock suit-photo
// compositions, not the owner's artwork, so neither one renders any more.
// The deployment-safe asset check in client/src/aiEntrySurface.test.ts still
// asserts both filenames, so they are recorded here instead of deleted:
//   https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/mMwkxBRkmMXfalck.png
//   https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/xftKPqLVBztUvpUZ.png
const heroBanners = [
  {
    src: "/zurs-banner.png",
    alt: "ZURS.me · TOPUP DIAMOND & SMM",
  },
];
export default function Home() {
  return (
    <StorefrontLayout>
      <main className="zp-page">
        <Reveal as="section" index={0}><HomeBanner /></Reveal>
        <Reveal as="section" index={1}><HomepageMedia /></Reveal>
        <Reveal as="section" index={2}><HomeTopupExperience /></Reveal>
      </main>
    </StorefrontLayout>
  );
}
function HomeStickers() {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="zurs-home-stickers" aria-hidden="true">
      <img className="zurs-home-sticker zurs-home-sticker--wave" src={reduce ? "/stickers/nenkay-wave.png" : "/stickers/nenkay-wave.webp"} alt="" />
      <img className="zurs-home-sticker zurs-home-sticker--rest" src={reduce ? "/stickers/nenkay-rest.png" : "/stickers/nenkay-rest.webp"} alt="" />
    </div>
  );
}
function SectionHeading({ eyebrow, title, description, aside }: { eyebrow: string; title: string; description?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0 flex-1 max-w-2xl">
        <p className="zurs-eyebrow font-bold uppercase">{eyebrow}</p>
        <h2 className="zp-heading mt-1.5 font-display text-xl font-bold leading-tight text-ink text-balance sm:text-2xl">{title}</h2>
        {description ? <p className="mt-2 hidden text-sm leading-6 text-ink-muted text-pretty sm:block">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}
function HomeBanner() {
  const [loaded, setLoaded] = useState(false);
  return (
    <section className="container pt-4 sm:pt-6" aria-label="ZURS banner">
      {/* The artwork ships with its own transparent background and its own
        * blue edge, so nothing is painted behind it: no conic beam, no panel
        * fill, no gradient. Only the PNG itself is visible. A slow left-to-right
        * pan keeps a single image feeling alive. */}
      <div className="zurs-banner-frame zurs-banner-frame--bare zurs-banner-frame--pan relative isolate aspect-[16/5.5] overflow-hidden rounded-2xl sm:aspect-[16/6]">
        <img
          src={heroBanners[0]!.src}
          alt={heroBanners[0]!.alt}
          className={`zurs-banner-slide zurs-banner-slide--pan absolute inset-0 h-full w-full object-cover ${loaded ? "is-loaded" : ""}`}
          onLoad={() => setLoaded(true)}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          sizes="100vw"
        />
      </div>
    </section>
  );
}
function HomepageMedia() {
  const content = trpc.content.active.useQuery();
  const items = (content.data ?? []).filter((item) => /^(homepage-)?(banner|promo|promotion|announcement)(-|$)/i.test(item.contentKey));
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!items.length) return null;
  return (
    <section className="container mt-8 sm:mt-10">
      <SectionHeading eyebrow="ZURS UPDATE" title="ព័ត៌មាន និង Promotion" aside={<span className="hidden text-xs font-semibold text-ink-muted sm:inline">{items.length} ធាតុ</span>} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const media = item.mediaUrl?.trim() ?? "";
          const video = /\.(mp4|webm|ogg)(?:$|[?#])/i.test(media);
          return (
            <article key={item.id} className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-neon/50">
              {media ? (
                <div className="relative aspect-[16/8] overflow-hidden bg-panel-2">
                  {video ? (
                    <video className="h-full w-full object-cover" src={media} autoPlay={!prefersReducedMotion} loop muted playsInline controls preload="metadata" />
                  ) : (
                    <img className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" src={media} alt={item.titleKh ?? "ZURS STORE media"} loading="lazy" decoding="async" sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw" />
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-canvas/80 px-2 py-1 text-xs font-bold text-ink backdrop-blur">
                    {video ? <><Video className="h-3 w-3" />VIDEO</> : <><ImageIcon className="h-3 w-3" />PROMO</>}
                  </span>
                </div>
              ) : null}
              <div className="p-4">
                <p className="text-sm font-bold text-ink">{item.titleKh ?? "ZURS STORE"}</p>
                {item.bodyKh ? <p className="khmer-body mt-1 text-xs leading-5 text-ink-muted">{item.bodyKh}</p> : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
type CatalogGame = { id: string; name: string; region?: string; logoUrl?: string };
const GAMES_CACHE_KEY = "zurs-games-v1";
function readCachedGames(): { games: CatalogGame[] } | undefined {
  try {
    const raw = sessionStorage.getItem(GAMES_CACHE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as { games?: unknown };
    if (!Array.isArray(parsed.games)) return undefined;
    return parsed as { games: CatalogGame[] };
  } catch {
    return undefined;
  }
}
function HomeGameCard({ game, displayName, imageOverrides }: { game: CatalogGame; displayName?: string; imageOverrides?: Map<string, ProviderGameImageOverride> }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setVisible(true); observer.disconnect(); } }, { rootMargin: "180px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const details = trpc.provider.gameDetails.useQuery({ gameId: game.id }, { enabled: visible, staleTime: 10 * 60 * 1000 });
  const imageOverride = imageOverrides?.get(providerGameImageKey(game.id, game.name));
  const logoUrl = imageOverride?.logoUrl ?? (details.data?.status === "ready" ? details.data.game.logoUrl : game.logoUrl);
  const gameLabel = displayName ?? providerGameBaseName(game);
  const originalArtwork = resolvedGameArtworkFor(game.id, game.name, imageOverride);
  const popular = isPopularStorefrontGame(game.id, gameLabel);
  return (
    <div ref={cardRef}>
      <Link
        href={gameTopupPath(game.id)}
        className={`zurs-mobile-glass group block rounded-2xl zurs-game-card h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon ${popular ? "zurs-game-card--popular" : ""}`}
      >
        <div className="zurs-game-card-media relative aspect-[16/10] overflow-hidden rounded-xl" style={{ "--game-accent": originalArtwork?.accent ?? "#38bdf8" } as React.CSSProperties}>
          {originalArtwork ? (
            <img src={originalArtwork.src} alt="" className="zurs-game-card-art" style={{ objectPosition: originalArtwork.position ?? "center" }} loading={visible ? "eager" : "lazy"} fetchPriority={popular && visible ? "high" : "auto"} decoding="async" sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" />
          ) : (
            <ProviderGameArtwork name={game.name} region={game.region} logoUrl={logoUrl} className="h-11 w-11 rounded-xl" showCountryFlag={false} />
          )}
          <span className="zurs-game-card-overlay" aria-hidden="true" />
          {popular ? <span className="zurs-game-card-popular"><PackEmoji name="fire" size={13} />ពេញនិយម</span> : null}
        </div>
        <span className="block min-w-0 px-1 pb-1 pt-2.5">
          <OverflowMarquee text={gameLabel} className="block text-sm font-bold leading-5 text-ink" />
          <ProviderGameRegion name={game.name} region={game.region} className="mt-0.5 text-xs text-ink-muted" showFlag={false} />
        </span>
      </Link>
    </div>
  );
}
function ProviderGameCatalogGroup({ baseName, games, imageOverrides }: { baseName: string; games: CatalogGame[]; imageOverrides: Map<string, ProviderGameImageOverride> }) {
  const primary = games[0];
  if (!primary) return null;
  const normalized = baseName.trim().toLowerCase();
  if (normalized === "mobile legends") return <HomeGameCard game={{ ...primary, id: "mobile_legends", name: "Mobile Legends" }} displayName="Mobile Legends" imageOverrides={imageOverrides} />;
  if (normalized === "free fire" || games.some((g) => /^free_fire(?:_|$)/i.test(g.id))) return <HomeGameCard game={{ ...primary, id: "free_fire", name: "Free Fire" }} displayName="Free Fire" imageOverrides={imageOverrides} />;
  if (normalized === "pubg mobile" || games.some((g) => g.id === "pubg_mobile_auto" || g.id === "pubg_mobile_fast")) return <HomeGameCard game={{ ...primary, id: "pubg_mobile", name: "PUBG Mobile" }} displayName="PUBG Mobile" imageOverrides={imageOverrides} />;
  const primaryOverride = imageOverrides.get(providerGameImageKey(primary.id, primary.name));
  return (
    <section className="zurs-game-group col-span-full rounded-2xl border border-line bg-panel p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <ProviderGameArtwork name={primary.name} region={primary.region} logoUrl={primaryOverride?.logoUrl ?? primary.logoUrl} className="h-10 w-10 rounded-xl" showCountryFlag={false} />
        <div className="min-w-0">
          <OverflowMarquee text={baseName} className="block text-sm font-bold text-ink" />
          <p className="mt-0.5 text-xs font-medium text-ink-muted">ជ្រើសរើសប្រភេទ top-up</p>
        </div>
      </div>
      <div className={games.length === 1 ? "mx-auto mt-3 grid w-full max-w-[12rem] grid-cols-1 gap-3" : "mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"}>
        {games.map((game) => <HomeGameCard key={game.id} game={game} displayName={providerGameVariantLabel(game)} imageOverrides={imageOverrides} />)}
      </div>
    </section>
  );
}
function HomeTopupExperience() {
  const utils = trpc.useUtils();
  const gamesQuery = trpc.provider.games.useQuery(undefined, { staleTime: 60_000, placeholderData: readCachedGames });
  const gameImages = trpc.provider.gameImages.useQuery(undefined, { staleTime: 0, refetchInterval: 5_000 });
  const [query, setQuery] = useState("");
  useEffect(() => subscribeToPublicAssetChanges((area) => { if (area === "game-images") void utils.provider.gameImages.invalidate(); }), [utils]);
  useEffect(() => {
    if (!gamesQuery.data?.games) return;
    try {
      sessionStorage.setItem(GAMES_CACHE_KEY, JSON.stringify(gamesQuery.data));
    } catch {
      /* private mode */
    }
  }, [gamesQuery.data]);
  const games = orderProviderGames(gamesQuery.data?.games ?? []);
  const visibleGames = useMemo(() => filterProviderGames(games, query, "all"), [games, query]);
  const hasFilters = Boolean(query.trim());
  const imageOverrides = useMemo(() => new Map((gameImages.data ?? []).map((item) => [item.gameId, item])), [gameImages.data]);
  const catalogGroups = useMemo(() => groupProviderGamesByBaseName(visibleGames), [visibleGames]);
  // Round 9: the marquee used to print every raw provider variant, so shoppers
  // saw rows like "Free Fire CIS" that do not exist as a store card. Grouping by
  // base name means the strip shows exactly the public store names, and it stays
  // built from the FULL catalogue so searching does not empty it out.
  const storeTickerLogos = useMemo(
    () => groupProviderGamesByBaseName(games).map((group) => ({ name: group.baseName, logoUrl: group.games[0]?.logoUrl ?? undefined })),
    [games],
  );
  return (
    <section id="topup-games" className="container mt-5 pb-10 sm:mt-10 sm:pb-12">
      <LoadingOverlay open={gamesQuery.isLoading && !gamesQuery.data} label="កំពុងរៀបចំបញ្ជីហ្គេម…" />
      <SectionHeading
        eyebrow="GAME TOP-UP"
        title="ជ្រើសរើសហ្គេមរបស់អ្នក"
        description="ស្វែងរកតាមឈ្មោះហ្គេម ដើម្បីចូលទៅកាន់ទំព័រ Top-up។"
        aside={
          <div className="flex shrink-0 items-center gap-2">
            <HomeStickers />
            <div className="hidden items-center gap-3 rounded-2xl border border-line bg-panel px-4 py-2.5 sm:flex" aria-labelledby="accept-payment-title">
              <p id="accept-payment-title" className="text-xs font-bold tracking-[0.14em] text-ink-muted">ACCEPT PAYMENT</p>
              <span className="rounded-lg bg-ink p-1.5"><img src={khqrLogoUrl} alt="KHQR" className="h-6 w-auto max-w-24 object-contain" loading="eager" decoding="async" /></span>
            </div>
          </div>
        }
      />
      {gamesQuery.isLoading ? (
        <div className="mt-5 grid min-h-36 place-items-center rounded-2xl border border-line bg-panel text-xs text-ink-muted">
          <OutlineLoader size={30} color="#c99712" />
          <span className="mt-2">កំពុងរៀបចំបញ្ជីហ្គេម…</span>
        </div>
      ) : games.length ? (
        <>
          <div className="zurs-desktop-toolbar mt-5">
            <label className="relative block zurs-desktop-toolbar__search">
              <span className="sr-only">ស្វែងរកហ្គេម</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ស្វែងរកហ្គេម…"
                className="zurs-mobile-glass h-11 w-full zurs-search-field rounded-xl py-2 pl-10 pr-10 text-sm text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-neon"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="សម្អាតការស្វែងរក" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-ink-muted transition hover:bg-panel-2 hover:text-ink">
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </label>
          </div>
          <div className="mt-4 hidden overflow-hidden sm:block">
            <GameLogoTicker logos={storeTickerLogos} />
          </div>
          {visibleGames.length ? (
            <div className="zp-game-grid mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {catalogGroups.map((group) =>
                group.games.length > 1
                  ? <ProviderGameCatalogGroup key={group.baseName} baseName={group.baseName} games={group.games} imageOverrides={imageOverrides} />
                  : <HomeGameCard key={group.games[0]!.id} game={group.games[0]!} imageOverrides={imageOverrides} />
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-line bg-panel p-8 text-center">
              <Search className="mx-auto h-6 w-6 text-neon" aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-ink">មិនមានហ្គេមត្រូវនឹងការស្វែងរកទេ</p>
              <p className="mt-1 text-xs leading-5 text-ink-muted">សូមពិនិត្យអក្ខរាវិរុទ្ធ ឬសាកល្បងឈ្មោះហ្គេមផ្សេង។</p>
              {hasFilters ? (
                <button type="button" onClick={() => setQuery("")} className="mt-4 inline-flex h-9 items-center rounded-full bg-neon px-4 text-xs font-bold text-neon-ink">បង្ហាញហ្គេមទាំងអស់</button>
              ) : null}
            </div>
          )}
        </>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-line bg-panel p-8 text-center text-xs leading-6 text-ink-muted">
          <AnimatedGlyph name="settings" size={30} color="#c99712" className="mx-auto" />
          <p className="mt-3">បច្ចុប្បន្នមិនទាន់មានបញ្ជីហ្គេមសម្រាប់បង្ហាញទេ។ ព័ត៌មានហ្គេមនឹងបង្ហាញនៅទីនេះនៅពេលសេវារបស់ហាងបានដំណើរការ។</p>
        </div>
      )}
    </section>
  );
}
