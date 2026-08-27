import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { LoadingV2 } from "@/components/OutlineLoader";
import { prepareAdminImage } from "@/lib/adminImageUpload";
import { originalGameArtworkFor, providerGameImageKey } from "@/lib/originalGameArtwork";
import { trpc } from "@/lib/trpc";
import { ImagePlus, Link as LinkIcon, RotateCcw, Save, ShieldAlert, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

const ownerEmail = "chanmakara672@gmail.com";
type Game = { id: string; name: string; region?: string; logoUrl?: string };
type ImageDraft = { logoUrl: string | null; cardArtworkUrl: string | null };

export default function AdminGameImages() {
  const { loading, user } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.role !== "admin" && user?.email?.trim().toLowerCase() !== ownerEmail) return <div className="grid min-h-screen place-items-center bg-slate-50 p-4"><div className="rounded-2xl bg-white p-6 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 text-sm font-bold text-slate-900">Admin access only</p></div></div>;
  return <DashboardLayout><GameImagesWorkspace /></DashboardLayout>;
}

function GameImagesWorkspace() {
  const games = trpc.provider.games.useQuery(undefined, { staleTime: 60_000 });
  const overrides = trpc.admin.gameImages.useQuery();
  const dedupedGames = useMemo(() => {
    const unique = new Map<string, Game>();
    for (const game of games.data?.games ?? []) { const key = providerGameImageKey(game.id, game.name); if (!unique.has(key)) unique.set(key, { ...game, id: key }); }
    return Array.from(unique.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [games.data]);
  const overrideMap = useMemo(() => new Map((overrides.data ?? []).map((item) => [item.gameId, item])), [overrides.data]);
  return <div className="mx-auto max-w-7xl pb-10"><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">PUBLIC STOREFRONT ASSETS</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">រូបភាពហ្គេម</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">គ្រប់គ្រង logo និង artwork 16:10 របស់ហ្គេម public ដោយមិនចាំបាច់ deploy ថ្មី។ Preview ខាងក្រោមបង្ហាញ card និង hero មុនពេលរក្សាទុក។ Cambodia badge និង frame នៅរក្សាដដែល។</p><div className="mt-6 grid gap-5 lg:grid-cols-2">{games.isLoading || overrides.isLoading ? <LoadingV2 size={28} color="#4f46e5" /> : dedupedGames.map((game) => <GameImageEditor key={game.id} game={game} initial={overrideMap.get(game.id) ?? null} />)}</div></div>;
}

function GameImageEditor({ game, initial }: { game: Game; initial: ImageDraft | null }) {
  const utils = trpc.useUtils();
  const logoInput = useRef<HTMLInputElement>(null);
  const artworkInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<ImageDraft>({ logoUrl: initial?.logoUrl ?? null, cardArtworkUrl: initial?.cardArtworkUrl ?? null });
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = trpc.uploads.adminMediaImage.useMutation();
  const save = trpc.admin.saveGameImages.useMutation({ onSuccess: () => { void utils.admin.gameImages.invalidate(); void utils.provider.gameImages.invalidate(); } });
  const reset = trpc.admin.resetGameImage.useMutation({ onSuccess: () => { void utils.admin.gameImages.invalidate(); void utils.provider.gameImages.invalidate(); } });
  useEffect(() => setDraft({ logoUrl: initial?.logoUrl ?? null, cardArtworkUrl: initial?.cardArtworkUrl ?? null }), [initial?.logoUrl, initial?.cardArtworkUrl]);
  const defaultArtwork = originalGameArtworkFor(game.id, game.name);
  const cardArtwork = draft.cardArtworkUrl || defaultArtwork?.src || game.logoUrl || "";
  const logo = draft.logoUrl || game.logoUrl || "";
  const uploadFor = async (slot: "logo" | "cardArtwork", event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try { setError(null); const prepared = await prepareAdminImage(file, slot === "logo" ? "square" : "card"); setWarning(prepared.warning); setDraft((current) => ({ ...current, [slot === "logo" ? "logoUrl" : "cardArtworkUrl"]: prepared.dataUrl })); const result = await upload.mutateAsync({ fileName: prepared.fileName, contentType: prepared.contentType, dataUrl: prepared.dataUrl }); setDraft((current) => ({ ...current, [slot === "logo" ? "logoUrl" : "cardArtworkUrl"]: result.url })); } catch (issue) { setError(issue instanceof Error ? issue.message : "មិនអាច upload រូបភាពបានទេ"); }
  };
  return <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><h2 className="truncate font-display text-lg font-bold text-slate-950">{game.name}</h2><p className="mt-0.5 truncate font-mono text-[10px] text-slate-500">ID: {game.id}</p></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700">Public</span></div><div className="mt-4 grid gap-3 sm:grid-cols-[7.5rem_1fr]"><div className="rounded-xl border border-slate-200 bg-slate-50 p-2"><p className="mb-2 text-[10px] font-bold text-slate-600">LOGO · 1:1</p><div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-slate-950 p-1"><ProviderGameArtwork name={game.name} logoUrl={logo || undefined} region={game.region} className="h-full w-full rounded-md" iconClassName="h-6 w-6" showCountryFlag={false} /></div><button type="button" onClick={() => logoInput.current?.click()} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-800"><Upload className="h-3 w-3" />ប្ដូររូបភាព</button><input ref={logoInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadFor("logo", event)} /></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-2"><p className="mb-2 text-[10px] font-bold text-slate-600">CARD ARTWORK · 16:10</p><div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-slate-950">{cardArtwork ? <img src={cardArtwork} alt={`${game.name} card artwork preview`} className="h-full w-full object-contain" /> : <ImagePlus className="m-auto h-6 w-6 text-slate-500" />}<span className="absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full border border-white/70 bg-slate-950/65 text-[10px]">🇰🇭</span></div><button type="button" onClick={() => artworkInput.current?.click()} className="mt-2 inline-flex h-8 w-full items-center justify-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 text-[10px] font-bold text-indigo-800"><Upload className="h-3 w-3" />ប្ដូររូបភាព</button><input ref={artworkInput} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadFor("cardArtwork", event)} /></div></div><div className="mt-4 grid gap-2"><label><span className="mb-1 flex items-center gap-1 text-[10px] font-bold text-slate-600"><LinkIcon className="h-3 w-3" />Logo URL</span><input value={draft.logoUrl ?? ""} onChange={(event) => setDraft((current) => ({ ...current, logoUrl: event.target.value || null }))} placeholder="Upload ឬ https://…" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs" /></label><label><span className="mb-1 flex items-center gap-1 text-[10px] font-bold text-slate-600"><LinkIcon className="h-3 w-3" />Artwork URL</span><input value={draft.cardArtworkUrl ?? ""} onChange={(event) => setDraft((current) => ({ ...current, cardArtworkUrl: event.target.value || null }))} placeholder="Upload ឬ https://…" className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs" /></label></div><div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-slate-950"><p className="border-b border-white/10 px-3 py-2 text-[10px] font-bold tracking-wide text-white/80">HERO PREVIEW</p><div className="relative aspect-[16/5] overflow-hidden">{cardArtwork ? <img src={cardArtwork} alt="Hero preview" className="absolute inset-0 h-full w-full object-cover opacity-85" /> : null}<div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/15" /><div className="relative flex h-full items-center gap-2.5 p-3 text-white"><ProviderGameArtwork name={game.name} logoUrl={logo || undefined} region={game.region} className="h-10 w-10 rounded-lg bg-white p-0.5" iconClassName="h-5 w-5 text-slate-700" showCountryFlag={false} /><span className="font-display text-sm font-bold">{game.name}</span></div></div></div>{warning ? <p className="mt-3 text-[11px] text-amber-700">{warning}</p> : null}{error || upload.error || save.error ? <p className="mt-3 text-[11px] text-rose-600">{error ?? upload.error?.message ?? save.error?.message}</p> : null}<div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2"><button disabled={save.isPending || upload.isPending} onClick={() => save.mutate({ gameId: game.id, ...draft })} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-50">{save.isPending ? <LoadingV2 size={14} color="#fff" /> : <Save className="h-3.5 w-3.5" />}រក្សាទុក</button><button type="button" disabled={!draft.logoUrl || reset.isPending} onClick={() => reset.mutate({ gameId: game.id, slot: "logo" })} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 disabled:opacity-40">Logo Reset</button><button type="button" disabled={!draft.cardArtworkUrl || reset.isPending} onClick={() => reset.mutate({ gameId: game.id, slot: "cardArtwork" })} className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 text-[10px] font-bold text-slate-700 disabled:opacity-40"><RotateCcw className="mr-1 h-3.5 w-3.5" />Art Reset</button></div></article>;
}
