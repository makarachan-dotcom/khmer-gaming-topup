import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { LoadingV2 } from "@/components/OutlineLoader";
import { prepareAdminImage } from "@/lib/adminImageUpload";
import { trpc } from "@/lib/trpc";
import { notifyPackageArtworkChanged } from "@/lib/packageArtworkBroadcast";
import { CheckCircle2, Clock3, ImagePlus, Link as LinkIcon, RotateCcw, Save, ShieldAlert, Tags, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";

const ownerEmail = "chanmakara672@gmail.com";
export default function AdminPackageArtwork() {
  const { loading, user } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.role !== "admin" && user?.email?.trim().toLowerCase() !== ownerEmail) return <div className="grid min-h-screen place-items-center bg-slate-50 p-4"><div className="rounded-2xl bg-white p-6 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 text-sm font-bold text-slate-900">Admin access only</p></div></div>;
  return <DashboardLayout><PackageArtworkWorkspace /></DashboardLayout>;
}

function PackageArtworkWorkspace() {
  const utils = trpc.useUtils();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [gameId, setGameId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const games = trpc.provider.games.useQuery(undefined, { staleTime: 60_000 });
  const providerOffers = trpc.admin.previewGamePackages.useQuery({ gameId }, { enabled: Boolean(gameId), staleTime: 30_000 });
  const artwork = trpc.admin.packageArtwork.useQuery(gameId.trim() ? { gameId: gameId.trim() } : undefined);
  const audits = trpc.admin.packageArtworkAudits.useQuery(gameId.trim() ? { gameId: gameId.trim() } : undefined);
  const categories = trpc.provider.packageCategories.useQuery({ gameId }, { enabled: Boolean(gameId), staleTime: 0 });
  const upload = trpc.uploads.adminMediaImage.useMutation();
  const refresh = () => { utils.admin.packageArtwork.invalidate(); utils.admin.packageArtworkAudits.invalidate(); utils.provider.packageArtwork.invalidate(); };
  const refreshCategories = () => { utils.provider.packageCategories.invalidate({ gameId }); };
  const packageLabelFor = (targetGameId: string, targetOfferId: string) => targetGameId === gameId && providerOffers.data?.status === "ready" ? providerOffers.data.packages.find((item) => item.id === targetOfferId)?.label ?? "Provider package" : "Provider package";
  const save = trpc.admin.savePackageArtwork.useMutation({ onSuccess: (_, variables) => { notifyPackageArtworkChanged(variables.gameId); refresh(); setUploadStatus("បានរក្សាទុករូបភាពរួចហើយ។ អ្នកប្រើប្រាស់អាចឃើញរូបថ្មីភ្លាមៗ។"); } });
  const reset = trpc.admin.resetPackageArtwork.useMutation({ onSuccess: (_, variables) => { notifyPackageArtworkChanged(variables.gameId); refresh(); } });
  const saveCategory = trpc.admin.savePackageCategory.useMutation({ onSuccess: (_, variables) => { refreshCategories(); setCategoryLabel(variables.categoryLabel); } });
  const resetCategory = trpc.admin.resetPackageCategory.useMutation({ onSuccess: () => { refreshCategories(); setCategoryLabel(""); } });

  useEffect(() => {
    const existing = categories.data?.find((item) => item.offerId === offerId)?.categoryLabel ?? "";
    setCategoryLabel(existing);
  }, [categories.data, offerId]);

  const chooseImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const targetGameId = gameId.trim();
    const targetOfferId = offerId.trim();
    if (!targetGameId || !targetOfferId) {
      setUploadStatus(null);
      setError("សូមជ្រើសហ្គេម និងកញ្ចប់សិន មុនពេល Upload រូបភាព។");
      return;
    }
    const previousMediaUrl = mediaUrl;
    let uploadedMediaUrl: string | null = null;
    try {
      setError(null);
      setUploadStatus("កំពុងរៀបចំ និង Upload រូបភាព…");
      const prepared = await prepareAdminImage(file, "card");
      setWarning(prepared.warning);
      setMediaUrl(prepared.dataUrl);
      const result = await upload.mutateAsync({ fileName: prepared.fileName, contentType: prepared.contentType, dataUrl: prepared.dataUrl });
      uploadedMediaUrl = result.url;
      setMediaUrl(result.url);
      setUploadStatus("បាន Upload រួច។ កំពុងរក្សាទុកទៅកញ្ចប់…");
      await save.mutateAsync({ gameId: targetGameId, offerId: targetOfferId, mediaUrl: result.url });
    } catch (issue) {
      setUploadStatus(null);
      setMediaUrl(uploadedMediaUrl ?? previousMediaUrl);
      setError(issue instanceof Error ? issue.message : "មិនអាច upload រូបភាពកញ្ចប់បានទេ");
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!gameId.trim() || !offerId.trim() || !mediaUrl.trim()) return;
    setError(null);
    setUploadStatus("កំពុងរក្សាទុករូបភាព…");
    save.mutate({ gameId: gameId.trim(), offerId: offerId.trim(), mediaUrl: mediaUrl.trim() });
  };

  return <div className="mx-auto max-w-6xl pb-10"><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">ADMIN CATALOG ART</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">រូបភាពកញ្ចប់ Public</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">កំណត់រូបភាពសម្រាប់ offer ពិតរបស់ provider បានភ្លាមៗ។ ការកែនេះមិនប្តូរឈ្មោះ, តម្លៃ ឬ package data ទេ។ Reset នឹងត្រឡប់ទៅ artwork ដើម និងកត់ត្រាក្នុង audit history។</p><div className="mt-5 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]"><form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><ImagePlus className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">Artwork override</h2><p className="mt-0.5 text-xs text-slate-500">ជ្រើស game និង offer ពិតពី provider catalog។</p></div></div><label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Provider game</span><select required value={gameId} onChange={(event) => { setGameId(event.target.value); setOfferId(""); setUploadStatus(null); setError(null); }} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"><option value="">ជ្រើសរើសហ្គេម…</option>{games.data?.status === "ready" ? games.data.games.map((item) => <option key={item.id} value={item.id}>{item.name}</option>) : null}</select></label><label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">Provider package</span><select required disabled={!gameId || providerOffers.isLoading} value={offerId} onChange={(event) => { setOfferId(event.target.value); setUploadStatus(null); setError(null); }} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm disabled:opacity-55"><option value="">{providerOffers.isLoading ? "កំពុងទាញ package…" : "ជ្រើសរើស package…"}</option>{providerOffers.data?.status === "ready" ? providerOffers.data.packages.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.priceLabel}</option>) : null}</select></label><section className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3"><div className="flex items-start gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-800"><Tags className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-bold text-amber-950">ប្រភេទកញ្ចប់</p><p className="mt-0.5 text-[10px] leading-4 text-amber-800">Tag នេះបង្ហាញសម្រាប់ filter tabs ប៉ុណ្ណោះ។ វាមិនប្តូរតម្លៃ ឬការផ្តល់ package ទេ។</p></div></div><label className="mt-3 block"><span className="sr-only">ប្រភេទកញ្ចប់</span><input disabled={!gameId || !offerId} value={categoryLabel} onChange={(event) => setCategoryLabel(event.target.value.slice(0, 80))} placeholder="ឧ. Token, Weekly Card, Super Offer" className="h-10 w-full rounded-lg border border-amber-200 bg-white px-3 text-xs font-semibold text-slate-900 disabled:bg-slate-100" /></label><div className="mt-2 flex flex-wrap gap-1.5">{["Token", "Weekly Card", "Super Offer", "កញ្ចប់ពិសេស"].map((label) => <button key={label} type="button" disabled={!gameId || !offerId} onClick={() => setCategoryLabel(label)} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[10px] font-bold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:opacity-45">{label}</button>)}</div><div className="mt-3 flex gap-2"><button type="button" disabled={!gameId || !offerId || !categoryLabel.trim() || saveCategory.isPending} onClick={() => saveCategory.mutate({ gameId, offerId, categoryLabel: categoryLabel.trim() })} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-[10px] font-bold text-slate-950 disabled:opacity-50"><Save className="h-3.5 w-3.5" />រក្សាទុកប្រភេទ</button><button type="button" disabled={!gameId || !offerId || !categories.data?.some((item) => item.offerId === offerId) || resetCategory.isPending} onClick={() => resetCategory.mutate({ gameId, offerId })} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-3 text-[10px] font-bold text-amber-900 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />ប្រើអូតូ</button></div>{(saveCategory.error || resetCategory.error) ? <p className="mt-2 text-[11px] text-rose-600">{saveCategory.error?.message ?? resetCategory.error?.message}</p> : null}</section><div className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/60 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-indigo-900">Upload រូបភាព</p><p className="mt-0.5 text-[11px] text-indigo-700">ជ្រើស game និង package រួចហើយចុច Upload—ប្រព័ន្ធនឹងរក្សាទុកដោយស្វ័យប្រវត្តិ។</p></div><button type="button" disabled={upload.isPending || save.isPending || !gameId.trim() || !offerId.trim()} onClick={() => imageInputRef.current?.click()} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3 text-xs font-bold text-indigo-800 shadow-sm disabled:opacity-55">{upload.isPending || save.isPending ? <LoadingV2 size={14} color="#0f172a" className="h-3.5 w-3.5" /> : <Upload className="h-3.5 w-3.5" />}{upload.isPending ? "កំពុង Upload…" : save.isPending ? "កំពុងរក្សាទុក…" : "Upload និងរក្សាទុក"}</button></div><input ref={imageInputRef} onChange={chooseImage} accept="image/jpeg,image/png,image/webp" className="hidden" type="file" /></div><label className="mt-3 block"><span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><LinkIcon className="h-3.5 w-3.5" />Artwork URL</span><input required value={mediaUrl} onChange={(event) => { setMediaUrl(event.target.value); setUploadStatus(null); }} placeholder="Upload ឬ https://…" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /><p className="mt-1 text-[11px] text-slate-500">អនុញ្ញាតតែ managed storage ឬ HTTPS URL។</p></label>{mediaUrl ? <div className="mt-4 grid h-44 place-items-center rounded-xl border border-slate-200 bg-slate-950/95 p-2"><img src={mediaUrl} alt="Original artwork preview" className="h-full w-full object-contain" /></div> : null}<button disabled={save.isPending || upload.isPending || !gameId.trim() || !offerId.trim() || !mediaUrl.trim()} className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-50">{save.isPending ? <LoadingV2 size={16} color="#ffffff" className="h-4 w-4" /> : <Save className="h-4 w-4" />}រក្សាទុក Artwork</button>{uploadStatus ? <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{uploadStatus}</p> : null}{warning ? <p className="mt-2 text-xs text-amber-700">{warning}</p> : null}{(error || save.error || upload.error) ? <p className="mt-2 text-xs text-rose-600">{error ?? save.error?.message ?? upload.error?.message}</p> : null}</form><div className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="text-sm font-bold text-slate-900">Overrides កំពុងប្រើ</h2><p className="mt-1 text-xs text-slate-500">Reset នឹងលុប override reference តែប៉ុណ្ណោះ—provider package និង storage source នៅដដែល។</p><div className="mt-4 space-y-2">{artwork.isLoading ? <LoadingV2 size={20} color="#4f46e5" className="h-5 w-5" /> : artwork.data?.length ? artwork.data.map((item) => <div key={`${item.gameId}:${item.offerId}`} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5"><div className="grid h-16 w-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-950 p-1"><img src={item.mediaUrl} alt={`Original image for ${packageLabelFor(item.gameId, item.offerId)}`} className="h-full w-full object-contain" /></div><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{packageLabelFor(item.gameId, item.offerId)}</p><p className="mt-0.5 truncate font-mono text-[11px] text-slate-500">ID: {item.offerId}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-indigo-700">Image field: artwork override · {item.gameId}</p></div><button type="button" disabled={reset.isPending} onClick={() => reset.mutate({ gameId: item.gameId, offerId: item.offerId })} className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 text-[11px] font-bold text-rose-700 disabled:opacity-50"><RotateCcw className="h-3.5 w-3.5" />Reset</button></div>) : <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">មិនទាន់មាន artwork override ទេ។</p>}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-slate-500" /><h2 className="text-sm font-bold text-slate-900">Artwork audit</h2></div><div className="mt-3 space-y-2">{audits.data?.slice(0, 8).map((item) => <div key={`${item.gameId}:${item.offerId}:${item.createdAt.toISOString()}`} className="rounded-xl bg-slate-50 p-2.5"><p className="text-xs font-bold text-slate-800">{item.action === "set" ? "បានកែ Artwork" : "បាន Reset ទៅ default"}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{item.gameId} · {item.offerId}</p></div>) ?? null}{!audits.isLoading && !audits.data?.length ? <p className="text-xs text-slate-500">មិនទាន់មាន audit record ទេ។</p> : null}</div></section></div></div></div>;
}
