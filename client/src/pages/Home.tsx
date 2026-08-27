import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import {
  ProviderGameArtwork,
  ProviderGameRegion,
} from "@/components/ProviderGameIdentity";
import {
  filterProviderGames,
  groupProviderGamesByBaseName,
  orderProviderGames,
  providerGameBaseName,
  providerGameVariantLabel,
  type ProviderGameFilter,
} from "@/lib/providerPresentation";
import { trpc } from "@/lib/trpc";
import { subscribeToPublicAssetChanges } from "@/lib/publicAssetBroadcast";
import {
  Image as ImageIcon,
  Info,
  Search,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { gameTopupPath } from "./GameTopup";
import { isPopularStorefrontGame, providerGameImageKey, resolvedGameArtworkFor, type ProviderGameImageOverride } from "@/lib/originalGameArtwork";

const bannerSlides = [
  { src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/xftKPqLVBztUvpUZ.png", alt: "ZURS.me game top-up banner" },
  { src: "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/mMwkxBRkmMXfalck.png", alt: "ZURS.me top-up diamond banner" },
];

export default function Home() {
  return (
    <StorefrontLayout>
      <main>
        <HomeBanner />
        <HomepageMedia />
        <HomeTopupExperience />
      </main>
    </StorefrontLayout>
  );
}

function HomeBanner() {
  const [activeSlide, setActiveSlide] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % bannerSlides.length), 6_500);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <section className="container pt-3 sm:pt-5" aria-label="ZURS banner">
      <div className="zurs-banner-frame relative isolate aspect-[16/7] overflow-hidden rounded-[1.35rem] border border-cyan-100/20 bg-slate-950 shadow-[0_18px_45px_rgba(2,10,29,0.28)] sm:aspect-[16/6] sm:rounded-[1.75rem]">
        {bannerSlides.map((slide, index) => (
          <img
            key={slide.src}
            src={slide.src}
            alt={slide.alt}
            className="zurs-banner-slide absolute inset-0 h-full w-full object-cover"
            style={{ opacity: index === activeSlide ? 1 : 0, transform: `translateX(${(activeSlide - index) * 100}%)` }}
            loading={index === 0 ? "eager" : "lazy"}
            fetchPriority={index === 0 ? "high" : "auto"}
            decoding="async"
            sizes="100vw"
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent px-3 pb-3 pt-12 sm:px-5 sm:pb-4">
          <span className="zurs-banner-kicker">ZURS GAME TOP-UP</span>
          <div className="flex gap-1.5 rounded-full border border-white/15 bg-slate-950/35 p-1.5 backdrop-blur-sm" aria-label="Banner slides">
            {bannerSlides.map((slide, index) => (
              <button
                key={slide.src}
                type="button"
                onClick={() => setActiveSlide(index)}
                className={`h-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${index === activeSlide ? "w-6 bg-cyan-300" : "w-2 bg-white/55 hover:bg-white"}`}
                aria-label={`Banner ${index + 1}`}
                aria-current={index === activeSlide ? "true" : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomepageMedia() {
  const content = trpc.content.active.useQuery();
  const items = (content.data ?? []).filter(item =>
    /^(homepage-)?(banner|promo|promotion|announcement)(-|$)/i.test(
      item.contentKey
    )
  );
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!items.length) return null;
  return (
    <section className="container mt-5 sm:mt-7">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">
            ZURS UPDATE
          </p>
          <h2 className="mt-1 font-display text-xl font-bold text-slate-950">
            ព័ត៌មាន និង Promotion
          </h2>
        </div>
        <span className="hidden text-xs font-semibold text-slate-400 sm:inline">
          {items.length} ធាតុ
        </span>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => {
          const media = item.mediaUrl?.trim() ?? "";
          const video = /\.(mp4|webm|ogg)(?:$|[?#])/i.test(media);
          return (
            <article
              key={item.id}
              className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-950/8"
            >
              {media ? (
                <div className="relative aspect-[16/8] overflow-hidden bg-slate-100">
                  {video ? (
                    <video
                      className="h-full w-full object-cover"
                      src={media}
                      autoPlay={!prefersReducedMotion}
                      loop
                      muted
                      playsInline
                      controls
                      preload="metadata"
                    />
                  ) : (
                    <img
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      src={media}
                      alt={item.titleKh ?? "ZURS STORE media"}
                      loading="lazy"
                      decoding="async"
                      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                    />
                  )}
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/75 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">
                    {video ? (
                      <>
                        <Video className="h-3 w-3" />
                        VIDEO
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-3 w-3" />
                        PROMO
                      </>
                    )}
                  </span>
                </div>
              ) : null}
              <div className="p-4">
                <p className="text-sm font-bold text-slate-900">
                  {item.titleKh ?? "ZURS STORE"}
                </p>
                {item.bodyKh ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {item.bodyKh}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function HomeGameCard({
  game,
  displayName,
  imageOverrides,
}: {
  game: { id: string; name: string; region?: string; logoUrl?: string };
  displayName?: string;
  imageOverrides?: Map<string, ProviderGameImageOverride>;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              if (entry?.isIntersecting) {
                setVisible(true);
                observer?.disconnect();
              }
            },
            { rootMargin: "180px" }
          );
    if (observer) observer.observe(node);
    else setVisible(true);
    return () => observer?.disconnect();
  }, []);
  const details = trpc.provider.gameDetails.useQuery(
    { gameId: game.id },
    { enabled: visible, staleTime: 10 * 60 * 1000 }
  );
  const imageOverride = imageOverrides?.get(providerGameImageKey(game.id, game.name));
  const logoUrl = imageOverride?.logoUrl ?? (details.data?.status === "ready" ? details.data.game.logoUrl : game.logoUrl);
  const gameLabel = displayName ?? providerGameBaseName(game);
  const originalArtwork = resolvedGameArtworkFor(game.id, game.name, imageOverride);
  const popular = isPopularStorefrontGame(game.id, gameLabel);
  return (
    <div ref={cardRef}>
      <Link
        href={gameTopupPath(game.id)}
        className={`zurs-mobile-glass group block rounded-2xl zurs-game-card h-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${popular ? "zurs-game-card--popular" : ""}`}
      >
        <div className="zurs-game-card-media relative aspect-[16/10] overflow-hidden rounded-[0.95rem]" style={{ "--game-accent": originalArtwork?.accent ?? "#46d8ff" } as React.CSSProperties}>
          {originalArtwork ? <img src={originalArtwork.src} alt="" className="zurs-game-card-art" style={{ objectPosition: originalArtwork.position ?? "center" }} loading={visible ? "eager" : "lazy"} fetchPriority={popular && visible ? "high" : "auto"} decoding="async" sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" /> : <ProviderGameArtwork name={game.name} region={game.region} logoUrl={logoUrl} className="h-11 w-11 rounded-xl" showCountryFlag={false} />}
          <span className="zurs-game-card-overlay" aria-hidden="true" />
          {popular ? <span className="zurs-game-card-popular">🔥 ពេញនិយម</span> : null}
          <span className="zurs-game-card-cambodia" aria-hidden="true">🇰🇭</span>
        </div>
        <span className="block min-w-0 px-0.5 pb-0.5 pt-2.5">
          <OverflowMarquee text={gameLabel} className="block text-[0.82rem] font-extrabold leading-5 text-slate-950" />
          <ProviderGameRegion
            name={game.name}
            region={game.region}
            className="mt-1"
            showFlag={false}
          />
        </span>
      </Link>
    </div>
  );
}

type CatalogGame = { id: string; name: string; region?: string; logoUrl?: string };

function ProviderGameCatalogGroup({ baseName, games, imageOverrides }: { baseName: string; games: CatalogGame[]; imageOverrides: Map<string, ProviderGameImageOverride> }) {
  const primary = games[0];
  if (!primary) return null;
  const normalizedBaseName = baseName.trim().toLowerCase();
  if (normalizedBaseName === "mobile legends") {
    return <HomeGameCard game={{ ...primary, id: "mobile_legends", name: "Mobile Legends" }} displayName="Mobile Legends" imageOverrides={imageOverrides} />;
  }
  if (normalizedBaseName === "pubg mobile" || games.some(game => game.id === "pubg_mobile_auto" || game.id === "pubg_mobile_fast")) {
    return <HomeGameCard game={{ ...primary, id: "pubg_mobile", name: "PUBG Mobile" }} displayName="PUBG Mobile" imageOverrides={imageOverrides} />;
  }
  const primaryOverride = imageOverrides.get(providerGameImageKey(primary.id, primary.name));
  return <section className="zurs-game-group col-span-full rounded-[1.15rem] border p-3 sm:p-4"><div className="flex items-center gap-2.5"><ProviderGameArtwork name={primary.name} region={primary.region} logoUrl={primaryOverride?.logoUrl ?? primary.logoUrl} className="h-10 w-10 rounded-xl" showCountryFlag={false} /><div className="min-w-0"><OverflowMarquee text={baseName} className="block text-sm font-extrabold text-slate-950" /><p className="mt-0.5 text-[10px] font-semibold text-cyan-800">គាំទ្រសម្រាប់កម្ពុជា · ជ្រើសរើសប្រភេទ top-up</p></div></div><div className={games.length === 1 ? "mx-auto mt-3 grid w-full max-w-[12rem] grid-cols-1 gap-3" : "mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4"}>{games.map(game => <HomeGameCard key={game.id} game={game} displayName={providerGameVariantLabel(game)} imageOverrides={imageOverrides} />)}</div></section>;
}

const catalogFilters: Array<{ value: ProviderGameFilter; label: string }> = [
  { value: "all", label: "ទាំងអស់" },
  { value: "cambodia", label: "កម្ពុជា" },
  { value: "global", label: "Global" },
];

function HomeTopupExperience() {
  const utils = trpc.useUtils();
  const gamesQuery = trpc.provider.games.useQuery();
  const gameImages = trpc.provider.gameImages.useQuery(undefined, { staleTime: 0, refetchInterval: 5_000 });
  const paymentReadiness = trpc.payments.readiness.useQuery();
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<ProviderGameFilter>("all");
  useEffect(() => subscribeToPublicAssetChanges((area) => { if (area === "game-images") void utils.provider.gameImages.invalidate(); }), [utils]);
  const games = orderProviderGames(gamesQuery.data?.games ?? []);
  const visibleGames = useMemo(
    () => filterProviderGames(games, query, regionFilter),
    [games, query, regionFilter]
  );
  const hasFilters = Boolean(query.trim()) || regionFilter !== "all";
  const imageOverrides = useMemo(() => new Map((gameImages.data ?? []).map((item) => [item.gameId, item])), [gameImages.data]);
  const catalogGroups = useMemo(() => groupProviderGamesByBaseName(visibleGames), [visibleGames]);

  return (
    <section id="topup-games" className="container mt-5 pb-8 sm:mt-9 sm:pb-10">
      <LoadingOverlay
        open={gamesQuery.isLoading}
        label="កំពុងរៀបចំបញ្ជីហ្គេម…"
      />
      <div className="zurs-catalog-surface mx-auto max-w-6xl rounded-[1.35rem] p-4 sm:rounded-[1.75rem] sm:p-6 lg:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="zurs-eyebrow">GAME TOP-UP</p>
            <h2 className="mt-2 font-display text-[1.45rem] font-extrabold leading-tight text-slate-950 sm:text-2xl">
              ជ្រើសរើសហ្គេមរបស់អ្នក
            </h2>
            <p className="mt-2 text-[0.8rem] leading-6 text-slate-600 sm:text-sm">
              ស្វែងរកតាមឈ្មោះហ្គេម ឬមើលតែហ្គេមកម្ពុជា និង Global
              ដើម្បីចូលទៅកាន់ទំព័រ Top-up សម្រាប់ហ្គេមនោះ។
            </p>
          </div>
          {games.length ? (
            <p className="zurs-game-count" aria-live="polite">
              <strong>{catalogGroups.length.toLocaleString()} ហ្គេម</strong>
              <span>បង្ហាញពី {groupProviderGamesByBaseName(games).length.toLocaleString()} ហ្គេម</span>
            </p>
          ) : null}
        </div>
        {!paymentReadiness.isLoading ? (
          <div className="zurs-status-notice mt-5 flex items-start gap-2.5 rounded-xl p-3.5 text-xs leading-5 sm:text-sm">
            <span className="zurs-status-notice-icon"><Info className="h-4 w-4" /></span>
            <p>
              អ្នកអាចជ្រើសរើសហ្គេម និងពិនិត្យកញ្ចប់បាន។
              <span className="block text-slate-600">ការទិញកំពុងត្រូវបានរៀបចំឲ្យមានសុវត្ថិភាពបន្ថែម។</span>
            </p>
          </div>
        ) : null}
        {gamesQuery.isLoading ? (
          <div className="mt-4 grid min-h-36 place-items-center rounded-2xl bg-slate-50 text-xs text-slate-500">
            <OutlineLoader size={30} color="#4f46e5" />
            <span className="mt-2">កំពុងរៀបចំបញ្ជីហ្គេម…</span>
          </div>
        ) : games.length ? (
          <>
            <div className="mt-5 grid gap-2.5 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="relative block">
                <span className="sr-only">ស្វែងរកហ្គេម</span>
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="ស្វែងរកហ្គេម…"
                  className="zurs-mobile-glass h-11 w-full zurs-search-field rounded-xl py-2 pl-10 pr-10 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="សម្អាតការស្វែងរក"
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>
              <div
                className="zurs-mobile-glass flex gap-1 zurs-filter-pills overflow-x-auto rounded-xl p-1"
                role="group"
                aria-label="តម្រៀបតាមតំបន់"
              >
                {catalogFilters.map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setRegionFilter(filter.value)}
                    aria-pressed={regionFilter === filter.value}
                    className={[
                      "h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-1",
                      regionFilter === filter.value
                        ? "bg-cyan-600 text-white shadow-sm shadow-cyan-700/20"
                        : "text-slate-600 hover:bg-white/85 hover:text-slate-950",
                    ].join(" ")}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            {visibleGames.length ? (
              <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {catalogGroups.map(group => group.games.length > 1 ? <ProviderGameCatalogGroup key={group.baseName} baseName={group.baseName} games={group.games} imageOverrides={imageOverrides} /> : <HomeGameCard key={group.games[0]!.id} game={group.games[0]!} imageOverrides={imageOverrides} />)}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <Search
                  className="mx-auto h-6 w-6 text-indigo-500"
                  aria-hidden="true"
                />
                <p className="mt-2 text-sm font-bold text-slate-900">
                  មិនមានហ្គេមត្រូវនឹងការស្វែងរកទេ
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  សូមពិនិត្យអក្ខរាវិរុទ្ធ ឬប្ដូរតំបន់ស្វែងរករបស់អ្នក។
                </p>
                {hasFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setRegionFilter("all");
                    }}
                    className="mt-4 inline-flex h-9 items-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white"
                  >
                    បង្ហាញហ្គេមទាំងអស់
                  </button>
                ) : null}
              </div>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs leading-6 text-slate-600">
            <AnimatedGlyph
              name="settings"
              size={30}
              color="#818cf8"
              className="mx-auto"
            />
            <p className="mt-2">
              បច្ចុប្បន្នមិនទាន់មានបញ្ជីហ្គេមសម្រាប់បង្ហាញទេ។
              ព័ត៌មានហ្គេមនឹងបង្ហាញនៅទីនេះនៅពេលសេវារបស់ហាងបានដំណើរការ។
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
