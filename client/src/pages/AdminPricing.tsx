import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Calculator, Loader2, Save, ShieldAlert, Trash2 } from "lucide-react";
import { useState } from "react";

const ownerEmail = "chanmakara672@gmail.com";
type Offer = { id: string; amountLabel?: string; quantity?: number; basePriceUsd: string; profitMarginPercent: string; priceUsd: string; isActive: boolean; featured?: boolean; providerAuthorized: boolean; providerSource?: string | null };

export default function AdminPricing() {
  const { user, loading } = useAuth();
  const allowed = user?.role === "admin" || user?.email?.toLowerCase() === ownerEmail;
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!allowed) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="rounded-2xl bg-white p-6 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 text-sm font-bold">Admin access only</p></div></div>;
  return <DashboardLayout><PricingWorkspace /></DashboardLayout>;
}

function PricingWorkspace() {
  const catalog = trpc.admin.fullCatalog.useQuery();
  const utils = trpc.useUtils();
  const updateGame = trpc.admin.updateGamePackage.useMutation({ onSuccess: () => utils.admin.fullCatalog.invalidate() });
  const updateSmm = trpc.admin.updateSmmTier.useMutation({ onSuccess: () => utils.admin.fullCatalog.invalidate() });
  const deleteGame = trpc.admin.deleteGamePackage.useMutation({ onSuccess: () => utils.admin.fullCatalog.invalidate() });
  const deleteSmm = trpc.admin.deleteSmmTier.useMutation({ onSuccess: () => utils.admin.fullCatalog.invalidate() });
  return <main className="mx-auto max-w-6xl pb-10"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">PRICING CONTROL</p><h1 className="mt-1 font-display text-3xl font-bold text-slate-950">តម្លៃ និង Margin ចំណេញ</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">កំណត់ base cost និងភាគរយចំណេញ។ ប្រព័ន្ធគណនាតម្លៃលក់ដោយស្វ័យប្រវត្តិ។ បើ provider API មិនទាន់ភ្ជាប់ សូមទុក offers inactive ដើម្បីកុំឲ្យបង្ហាញជាសាធារណៈ។</p></div><a href="/admin" className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700">ត្រឡប់ទៅ Admin</a></header>
    <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><Calculator className="mr-2 inline h-4 w-4" />បង្កើត offers ថ្មីត្រូវធ្វើតាម provider sync ប៉ុណ្ណោះ។ ផ្ទាំងនេះប្រើសម្រាប់កែ, បិទ/បើក និងលុប record ដែលបានមកពី provider ដោយមានការអនុញ្ញាត។</div>
    {catalog.isLoading ? <div className="mt-6 grid min-h-48 place-items-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-600" /></div> : <section className="mt-6 grid gap-5 xl:grid-cols-2"><CatalogGroup title="Game Top-up offers" groups={catalog.data?.games ?? []} kind="game" onSaveGame={(offer, values) => updateGame.mutate({ packageId: offer.id, ...values })} onDeleteGame={(id) => deleteGame.mutate({ packageId: id })} /><CatalogGroup title="SMM offers" groups={catalog.data?.smm ?? []} kind="smm" onSaveSmm={(offer, values) => updateSmm.mutate({ tierId: offer.id, ...values })} onDeleteSmm={(id) => deleteSmm.mutate({ tierId: id })} /></section>}
  </main>;
}

function CatalogGroup({ title, groups, kind, onSaveGame, onDeleteGame, onSaveSmm, onDeleteSmm }: { title: string; groups: any[]; kind: "game" | "smm"; onSaveGame?: (offer: Offer, values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean; featured: boolean }) => void; onDeleteGame?: (id: string) => void; onSaveSmm?: (offer: Offer, values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean }) => void; onDeleteSmm?: (id: string) => void }) { return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">{title}</h2></div>{groups.length ? groups.map((group) => <div key={group.id} className="border-b border-slate-100 p-4 last:border-0"><p className="text-sm font-bold text-slate-900">{group.titleKh ?? `${group.platform} · ${group.titleKh}`}</p><div className="mt-3 space-y-2">{group.packages?.map((offer: Offer) => <OfferEditor key={offer.id} offer={offer} label={offer.amountLabel ?? "Offer"} onSave={(values) => onSaveGame?.(offer, { ...values, featured: Boolean(offer.featured) })} onDelete={() => onDeleteGame?.(offer.id)} />)}{group.tiers?.map((offer: Offer) => <OfferEditor key={offer.id} offer={offer} label={`${Number(offer.quantity).toLocaleString()} units`} onSave={(values) => onSaveSmm?.(offer, values)} onDelete={() => onDeleteSmm?.(offer.id)} />)}</div></div>) : <div className="p-6 text-center text-xs text-slate-500">មិនទាន់មាន provider offers សម្រាប់គ្រប់គ្រងទេ។</div>}</div>; }

function OfferEditor({ offer, label, onSave, onDelete }: { offer: Offer; label: string; onSave: (values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean }) => void; onDelete: () => void }) {
  const [base, setBase] = useState(offer.basePriceUsd);
  const [margin, setMargin] = useState(offer.profitMarginPercent);
  const [active, setActive] = useState(offer.isActive);
  const canEdit = offer.providerAuthorized;
  const sale = Number(base || 0) * (1 + Number(margin || 0) / 100);
  return <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{label}</p><p className={`mt-1 text-[10px] font-bold ${canEdit ? "text-emerald-700" : "text-amber-700"}`}>{canEdit ? `Provider authorized${offer.providerSource ? ` · ${offer.providerSource}` : ""}` : "Provider authorization required"}</p></div><label className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-slate-600"><input checked={active} disabled={!canEdit} onChange={(event) => setActive(event.target.checked)} type="checkbox" />Live</label></div>{!canEdit && <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">Record នេះមិនអាចកែ ឬបើកបានទេ រហូតដល់ provider sync បានបញ្ជាក់ source របស់វា។ អ្នកអាចលុប record ចាស់បាន។</p>}<div className="mt-3 grid grid-cols-2 gap-2"><label><span className="mb-1 block text-[10px] font-bold text-slate-500">Base USD</span><input disabled={!canEdit} value={base} onChange={(event) => setBase(event.target.value)} inputMode="decimal" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-100" /></label><label><span className="mb-1 block text-[10px] font-bold text-slate-500">Margin %</span><input disabled={!canEdit} value={margin} onChange={(event) => setMargin(event.target.value)} inputMode="decimal" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-100" /></label></div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] text-slate-600">តម្លៃលក់៖ <strong className="text-slate-900">${Number.isFinite(sale) ? sale.toFixed(2) : "0.00"}</strong></p><div className="flex gap-1"><button type="button" disabled={!canEdit} onClick={() => onSave({ basePriceUsd: base, profitMarginPercent: margin, isActive: active })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><Save className="h-3 w-3" />រក្សាទុក</button><button type="button" onClick={() => { if (window.confirm(`លុប ${label} ពិតមែនទេ?`)) onDelete(); }} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700" aria-label="Delete offer"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>;
}
