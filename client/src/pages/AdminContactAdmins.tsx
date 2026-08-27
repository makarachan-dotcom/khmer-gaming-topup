import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { LoadingV2 } from "@/components/OutlineLoader";
import { prepareAdminImage } from "@/lib/adminImageUpload";
import { toWebsiteMediaUrl } from "@/lib/mediaUrl";
import { notifyPublicAssetChanged } from "@/lib/publicAssetBroadcast";
import { trpc } from "@/lib/trpc";
import { ImagePlus, Save, ShieldAlert, Upload } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";

const ownerEmail = "chanmakara672@gmail.com";
type AdminProfile = { id: string; displayName: string; telegramUsername: string; workingHoursStart: string; workingHoursEnd: string; replyTimeText: string; photoUrl: string | null; isVisible: boolean; sortOrder: number };

export default function AdminContactAdmins() {
  const { loading, user } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.role !== "admin" && user?.email?.trim().toLowerCase() !== ownerEmail) return <div className="grid min-h-screen place-items-center bg-slate-50 p-4"><div className="rounded-2xl bg-white p-6 text-center shadow-xl"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 text-sm font-bold text-slate-900">Admin access only</p></div></div>;
  return <DashboardLayout><ContactAdminWorkspace /></DashboardLayout>;
}

function ContactAdminWorkspace() {
  const utils = trpc.useUtils();
  const admins = trpc.admin.contactAdmins.useQuery();
  const upload = trpc.uploads.adminMediaImage.useMutation();
  const save = trpc.admin.saveContactAdmin.useMutation({ onSuccess: () => { notifyPublicAssetChanged("contact-admins"); void utils.admin.contactAdmins.invalidate(); void utils.support.contactAdmins.invalidate(); } });
  return <div className="mx-auto max-w-5xl pb-10"><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">ZURS SUPPORT</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">គ្រប់គ្រង Admin ទំនាក់ទំនង</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">កែឈ្មោះ, រូបភាព, Telegram, ម៉ោងធ្វើការ និងពេលវេលាឆ្លើយតប។ ការកែរក្សាទុកហើយនឹងបង្ហាញលើ Contact Admin sheet ភ្លាមៗ។</p><div className="mt-6 grid gap-5 md:grid-cols-2">{admins.isLoading ? <LoadingV2 size={28} color="#4f46e5" /> : admins.data?.map((admin) => <ContactAdminEditor key={admin.id} admin={admin} upload={upload} save={save} />)}</div></div>;
}

function ContactAdminEditor({ admin, upload, save }: { admin: AdminProfile; upload: ReturnType<typeof trpc.uploads.adminMediaImage.useMutation>; save: ReturnType<typeof trpc.admin.saveContactAdmin.useMutation> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(admin);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  useEffect(() => setDraft(admin), [admin]);
  const set = <K extends keyof AdminProfile>(key: K, value: AdminProfile[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const choosePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    try { setError(null); setSuccess(null); const prepared = await prepareAdminImage(file, "square"); setWarning(prepared.warning); setDraft((current) => ({ ...current, photoUrl: prepared.dataUrl })); const result = await upload.mutateAsync({ fileName: prepared.fileName, contentType: prepared.contentType, dataUrl: prepared.dataUrl }); const nextDraft = { ...draft, photoUrl: result.url }; setDraft(nextDraft); await save.mutateAsync({ ...nextDraft, telegramUsername: nextDraft.telegramUsername.replace(/^@+/, "") || "zurs_admin" }); setSuccess("រូបភាព Admin ថ្មីត្រូវបានរក្សាទុក និងបង្ហាញសម្រាប់ users រួចរាល់។"); } catch (issue) { setError(issue instanceof Error ? issue.message : "មិនអាច upload រូបភាពបានទេ"); }
  };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setError(null); try { await save.mutateAsync({ ...draft, telegramUsername: draft.telegramUsername.replace(/^@+/, "") || "zurs_admin" }); } catch { setError("មិនអាចរក្សាទុកព័ត៌មាន Admin បានទេ។ សូមពិនិត្យឈ្មោះ Telegram និងម៉ោងធ្វើការ រួចព្យាយាមម្ដងទៀត។"); } };
  const publicPhotoUrl = toWebsiteMediaUrl(draft.photoUrl);
  return <form onSubmit={(event) => void submit(event)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border-2 border-indigo-100 bg-indigo-50 font-display text-sm font-bold text-indigo-700">{publicPhotoUrl ? <img className="h-full w-full object-cover" src={publicPhotoUrl} alt={draft.displayName} /> : draft.displayName.split(" ").map((part) => part[0]).join("").slice(-2)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{draft.displayName}</p><p className="mt-0.5 text-[11px] text-slate-500">Avatar 512×512 · crop-to-square</p><button type="button" onClick={() => inputRef.current?.click()} disabled={upload.isPending || save.isPending} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[11px] font-bold text-indigo-800"><Upload className="h-3.5 w-3.5" />ប្ដូររូបភាព</button><input ref={inputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} /></div></div><div className="mt-5 grid gap-3"><label><span className="mb-1 block text-xs font-semibold text-slate-700">Display name</span><input value={draft.displayName} onChange={(event) => set("displayName", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-semibold text-slate-700">Telegram username</span><input value={draft.telegramUsername} onChange={(event) => set("telegramUsername", event.target.value.replace(/^@+/, ""))} placeholder="zurs_makara" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><div className="grid grid-cols-2 gap-3"><label><span className="mb-1 block text-xs font-semibold text-slate-700">ចាប់ផ្តើម</span><input type="time" value={draft.workingHoursStart} onChange={(event) => set("workingHoursStart", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-semibold text-slate-700">បញ្ចប់</span><input type="time" value={draft.workingHoursEnd} onChange={(event) => set("workingHoursEnd", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label></div><label><span className="mb-1 block text-xs font-semibold text-slate-700">ឆ្លើយតបជាធម្មតា</span><input value={draft.replyTimeText} onChange={(event) => set("replyTimeText", event.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><div className="flex items-center justify-between rounded-xl bg-slate-50 p-3"><label className="flex items-center gap-2 text-xs font-bold text-slate-800"><input type="checkbox" checked={draft.isVisible} onChange={(event) => set("isVisible", event.target.checked)} />បង្ហាញលើ storefront</label><label className="flex items-center gap-2 text-xs font-semibold text-slate-600">លំដាប់ <input type="number" min="0" value={draft.sortOrder} onChange={(event) => set("sortOrder", Number(event.target.value) || 0)} className="h-8 w-14 rounded-lg border border-slate-200 bg-white px-2" /></label></div></div>{warning ? <p className="mt-3 text-[11px] text-amber-700">{warning}</p> : null}{success ? <p className="mt-3 text-[11px] font-semibold text-emerald-700">{success}</p> : null}{error || upload.error ? <p className="mt-3 text-[11px] text-rose-600">{error ?? "មិនអាច upload រូបភាពបានទេ។ សូមព្យាយាមម្ដងទៀត។"}</p> : null}<button disabled={save.isPending || upload.isPending} className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-50">{save.isPending ? <LoadingV2 size={15} color="#fff" /> : <Save className="h-4 w-4" />}រក្សាទុកព័ត៌មាន</button></form>;
}
