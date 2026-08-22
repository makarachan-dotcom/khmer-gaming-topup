import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { FloatingParticles } from "@/components/FloatingParticles";
import { ProviderGameArtwork, ProviderGameRegion, ProviderGameTitle } from "@/components/ProviderGameIdentity";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Diamond, Gamepad2, Image as ImageIcon, Megaphone, ShieldAlert, ShieldCheck, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { gameTopupPath } from "./GameTopup";

const categories = [
  { icon: Diamond, label: "ពេជ្យ / Diamonds" },
  { icon: Gamepad2, label: "Game Top-up" },
  { icon: Megaphone, label: "SMM Services" },
  { icon: ShieldCheck, label: "Verified Game Accounts" },
];

export default function Home() {
  return <StorefrontLayout><main>
    <section className="container pt-5 sm:pt-10"><div className="homepage-hero premium-shine relative overflow-hidden rounded-[1.5rem] bg-slate-950 px-5 py-8 text-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.82)] sm:rounded-[2rem] sm:px-10 sm:py-14"><div aria-hidden="true" className="homepage-orb absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/25 blur-3xl" /><div aria-hidden="true" className="homepage-orb-delayed absolute -bottom-24 left-[38%] h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" /><FloatingParticles /><div className="relative max-w-3xl"><p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-indigo-100"><ShieldCheck className="h-3.5 w-3.5 text-indigo-200" />ZURS STORE · GAMING &amp; DIGITAL</p><h1 className="mt-4 font-display text-[2rem] font-bold leading-[1.12] tracking-tight sm:text-5xl">ទិញពេជ្យ និង <span className="text-indigo-200">Top-up ហ្គេម</span><br className="hidden sm:block" /> របស់អ្នកនៅទីនេះ។</h1><p className="mt-4 max-w-2xl text-[13px] leading-6 text-slate-300 sm:text-base sm:leading-7">ZURS STORE ជាហាងសេវាឌីជីថលសម្រាប់អ្នកលេងហ្គេមនៅកម្ពុជា។ ជ្រើសហ្គេម បំពេញព័ត៌មានគណនីឲ្យត្រឹមត្រូវ និងពិនិត្យកញ្ចប់សេវាមុនបន្តការទូទាត់។</p><div className="mt-5 flex flex-wrap gap-2">{categories.map(({ icon: Icon, label }) => <span key={label} className="hero-chip inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1.5 text-[11px] font-semibold text-indigo-50"><Icon className="hero-chip-icon h-3.5 w-3.5 text-indigo-200" />{label}</span>)}</div><div className="mt-6 flex flex-wrap gap-3"><a href="#topup-games" className="homepage-primary-action inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-slate-950">ជ្រើសហ្គេម Top-up <ArrowRight className="h-4 w-4" /></a><Link href="/marketplace" className="inline-flex h-11 items-center rounded-xl border border-white/20 bg-white/[0.05] px-4 text-sm font-semibold text-white transition-colors hover:bg-white/[0.12]">មើលទីផ្សារគណនី</Link></div></div></div></section>
    <HomepageMedia />
    <HomeTopupExperience />
  </main></StorefrontLayout>;
}

function HomepageMedia() {
  const content = trpc.content.active.useQuery();
  const items = (content.data ?? []).filter((item) => /^(homepage-)?(banner|promo|promotion|announcement)(-|$)/i.test(item.contentKey));
  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!items.length) return null;
  return <section className="container mt-5 sm:mt-7"><div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">ZURS UPDATE</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">ព័ត៌មាន និង Promotion</h2></div><span className="hidden text-xs font-semibold text-slate-400 sm:inline">{items.length} ធាតុ</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => { const media = item.mediaUrl?.trim() ?? ""; const video = /\.(mp4|webm|ogg)(?:$|[?#])/i.test(media); return <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-indigo-950/8">{media ? <div className="relative aspect-[16/8] overflow-hidden bg-slate-100">{video ? <video className="h-full w-full object-cover" src={media} autoPlay={!prefersReducedMotion} loop muted playsInline controls preload="metadata" /> : <img className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" src={media} alt={item.titleKh ?? "ZURS STORE media"} loading="lazy" />}<span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-950/75 px-2 py-1 text-[9px] font-bold text-white backdrop-blur">{video ? <><Video className="h-3 w-3" />VIDEO</> : <><ImageIcon className="h-3 w-3" />PROMO</>}</span></div> : null}<div className="p-4"><p className="text-sm font-bold text-slate-900">{item.titleKh ?? "ZURS STORE"}</p>{item.bodyKh ? <p className="mt-1 text-xs leading-5 text-slate-500">{item.bodyKh}</p> : null}</div></article>; })}</div></section>;
}

function HomeGameCard({ game }: { game: { id: string; name: string; region?: string; logoUrl?: string } }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => { if (entry?.isIntersecting) { setVisible(true); observer?.disconnect(); } }, { rootMargin: "180px" });
    if (observer) observer.observe(node); else setVisible(true);
    return () => observer?.disconnect();
  }, []);
  const details = trpc.provider.gameDetails.useQuery({ gameId: game.id }, { enabled: visible, staleTime: 10 * 60 * 1000 });
  const logoUrl = details.data?.status === "ready" ? details.data.game.logoUrl : game.logoUrl;
  return <div ref={cardRef}><Link href={gameTopupPath(game.id)} className="game-catalog-card group block rounded-2xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300"><div className="flex items-center gap-3"><ProviderGameArtwork name={game.name} logoUrl={logoUrl} className="h-11 w-11 rounded-xl" /><span className="min-w-0 flex-1"><ProviderGameTitle name={game.name} className="text-sm font-bold text-slate-900" /><ProviderGameRegion name={game.name} region={game.region} className="mt-1" /></span></div></Link></div>;
}

function HomeTopupExperience() {
  const gamesQuery = trpc.provider.games.useQuery();
  const paymentReadiness = trpc.payments.readiness.useQuery();
  const games = gamesQuery.data?.games ?? [];
  return <section id="topup-games" className="container mt-5 pb-5 sm:mt-10"><LoadingOverlay open={gamesQuery.isLoading} label="កំពុងរៀបចំបញ្ជីហ្គេម…" /><div className="surface mx-auto max-w-5xl rounded-[1.5rem] p-4 sm:p-6"><div><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">GAME TOP-UP</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950 sm:text-2xl">ជ្រើសរើសហ្គេមរបស់អ្នក</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">ជ្រើសរើសហ្គេមនៅខាងក្រោម ដើម្បីចូលទៅកាន់ទំព័រ Top-up ដាច់ដោយឡែកសម្រាប់ហ្គេមនោះ។</p></div>{!paymentReadiness.isLoading ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>អ្នកអាចជ្រើសរើសហ្គេម និងពិនិត្យកញ្ចប់បាន។ ប៊ូតុងទិញត្រូវបានបិទជាបណ្តោះអាសន្ន ខណៈហាងកំពុងពិនិត្យសុវត្ថិភាពការទូទាត់។</p></div> : null}{gamesQuery.isLoading ? <div className="mt-4 grid min-h-36 place-items-center rounded-2xl bg-slate-50 text-xs text-slate-500"><OutlineLoader size={30} color="#4f46e5" /><span className="mt-2">កំពុងរៀបចំបញ្ជីហ្គេម…</span></div> : games.length ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{games.map((game) => <HomeGameCard key={game.id} game={game} />)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs leading-6 text-slate-600"><AnimatedGlyph name="settings" size={30} color="#818cf8" className="mx-auto" /><p className="mt-2">បច្ចុប្បន្នមិនទាន់មានបញ្ជីហ្គេមសម្រាប់បង្ហាញទេ។ ព័ត៌មានហ្គេមនឹងបង្ហាញនៅទីនេះនៅពេលសេវារបស់ហាងបានដំណើរការ។</p></div>}</div></section>;
}
