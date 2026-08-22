import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import {
  ProviderGameArtwork,
  ProviderGameRegion,
  ProviderGameTitle,
} from "@/components/ProviderGameIdentity";
import {
  filterProviderGames,
  orderProviderGames,
  type ProviderGameFilter,
} from "@/lib/providerPresentation";
import { trpc } from "@/lib/trpc";
import {
  Image as ImageIcon,
  Search,
  ShieldAlert,
  Video,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { gameTopupPath } from "./GameTopup";

export default function Home() {
  return (
    <StorefrontLayout>
      <main>
        <section className="container pt-5 sm:pt-10">
          <div className="homepage-banner overflow-hidden rounded-[1.5rem] bg-transparent sm:rounded-[2rem]">
            <img
              src="/zurs-banner.png"
              alt="ZURS STORE — Topup Diamond and SMM"
              className="block h-auto w-full"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </section>
        <HomepageMedia />
        <HomeTopupExperience />
      </main>
    </StorefrontLayout>
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
}: {
  game: { id: string; name: string; region?: string; logoUrl?: string };
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
  const logoUrl =
    details.data?.status === "ready" ? details.data.game.logoUrl : game.logoUrl;
  return (
    <div ref={cardRef}>
      <Link
        href={gameTopupPath(game.id)}
        className="game-catalog-card group block rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300"
      >
        <div className="flex items-center gap-3">
          <ProviderGameArtwork
            name={game.name}
            region={game.region}
            logoUrl={logoUrl}
            className="h-11 w-11 rounded-xl"
          />
          <span className="min-w-0 flex-1">
            <ProviderGameTitle
              name={game.name}
              className="text-sm font-bold text-slate-900"
            />
            <ProviderGameRegion
              name={game.name}
              region={game.region}
              className="mt-1"
            />
          </span>
        </div>
      </Link>
    </div>
  );
}

const catalogFilters: Array<{ value: ProviderGameFilter; label: string }> = [
  { value: "all", label: "ទាំងអស់" },
  { value: "cambodia", label: "កម្ពុជា" },
  { value: "global", label: "Global" },
];

function HomeTopupExperience() {
  const gamesQuery = trpc.provider.games.useQuery();
  const paymentReadiness = trpc.payments.readiness.useQuery();
  const [query, setQuery] = useState("");
  const [regionFilter, setRegionFilter] = useState<ProviderGameFilter>("all");
  const games = orderProviderGames(gamesQuery.data?.games ?? []);
  const visibleGames = useMemo(
    () => filterProviderGames(games, query, regionFilter),
    [games, query, regionFilter]
  );
  const hasFilters = Boolean(query.trim()) || regionFilter !== "all";

  return (
    <section id="topup-games" className="container mt-5 pb-5 sm:mt-10">
      <LoadingOverlay
        open={gamesQuery.isLoading}
        label="កំពុងរៀបចំបញ្ជីហ្គេម…"
      />
      <div className="surface mx-auto max-w-5xl rounded-[1.5rem] p-4 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">
              GAME TOP-UP
            </p>
            <h2 className="mt-1 font-display text-xl font-bold text-slate-950 sm:text-2xl">
              ជ្រើសរើសហ្គេមរបស់អ្នក
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
              ស្វែងរកតាមឈ្មោះហ្គេម ឬមើលតែហ្គេមកម្ពុជា និង Global
              ដើម្បីចូលទៅកាន់ទំព័រ Top-up សម្រាប់ហ្គេមនោះ។
            </p>
          </div>
          {games.length ? (
            <p
              className="text-xs font-semibold text-slate-500"
              aria-live="polite"
            >
              បង្ហាញ {visibleGames.length.toLocaleString()} /{" "}
              {games.length.toLocaleString()} ហ្គេម
            </p>
          ) : null}
        </div>
        {!paymentReadiness.isLoading ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              អ្នកអាចជ្រើសរើសហ្គេម និងពិនិត្យកញ្ចប់បាន។
              ប៊ូតុងទិញត្រូវបានបិទជាបណ្តោះអាសន្ន
              ខណៈហាងកំពុងពិនិត្យសុវត្ថិភាពការទូទាត់។
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
            <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
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
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
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
                className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1"
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
                      "h-9 shrink-0 rounded-lg px-3 text-xs font-bold transition",
                      regionFilter === filter.value
                        ? "bg-slate-950 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white hover:text-slate-950",
                    ].join(" ")}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
            {visibleGames.length ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibleGames.map(game => (
                  <HomeGameCard key={game.id} game={game} />
                ))}
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
