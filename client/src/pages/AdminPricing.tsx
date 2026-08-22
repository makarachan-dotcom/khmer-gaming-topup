import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { OutlineLoader } from "@/components/OutlineLoader";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Calculator, CheckCircle2, CloudOff, Eye, EyeOff, Filter, Layers3, Power, RefreshCw, Save, Search, ShieldAlert, ShieldCheck, Ticket, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ownerEmail = "chanmakara672@gmail.com";

type Offer = {
  id: string;
  amountLabel?: string;
  quantity?: number;
  basePriceUsd: string;
  profitMarginPercent: string;
  priceUsd: string;
  isActive: boolean;
  featured?: boolean;
  providerAuthorized: boolean;
  providerSource?: string | null;
};

type AvailabilityItem = { id: string; name: string; category?: string; isActive: boolean };
type CatalogKind = "game" | "smm";
type EventContent = { id: string; contentKey: string; titleKh?: string | null; bodyKh?: string | null; isActive: boolean };

function ActivityLoader({ size = 22, color = "#4f46e5", label }: { size?: number; color?: string; label?: string }) {
  return <span className="inline-flex items-center gap-2" aria-live="polite"><OutlineLoader size={size} color={color} />{label ? <span>{label}</span> : null}</span>;
}

export default function AdminPricing() {
  const { user, loading } = useAuth();
  const allowed = user?.role === "admin" || user?.email?.toLowerCase() === ownerEmail;
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!allowed) return <div className="grid min-h-screen place-items-center bg-slate-50"><div className="rounded-2xl bg-white p-6 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><p className="mt-3 text-sm font-bold">Admin access only</p></div></div>;
  return <DashboardLayout><PricingWorkspace /></DashboardLayout>;
}

function PricingWorkspace() {
  const catalog = trpc.admin.fullCatalog.useQuery();
  const availability = trpc.admin.providerAvailability.useQuery();
  const providerStatus = trpc.admin.providerCatalogStatus.useQuery();
  const eventContent = trpc.admin.content.useQuery();
  const utils = trpc.useUtils();
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogKind, setCatalogKind] = useState<"all" | CatalogKind>("all");
  const [catalogVisibility, setCatalogVisibility] = useState<"all" | "active" | "hidden">("all");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(() => new Set());
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);

  const applyOfferUpdate = (kind: "game" | "smm", offerId: string, values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean; featured?: boolean }) => {
    const priceUsd = (Number(values.basePriceUsd) * (1 + Number(values.profitMarginPercent) / 100)).toFixed(2);
    utils.admin.fullCatalog.setData(undefined, (current) => {
      if (!current) return current;
      if (kind === "game") {
        return {
          ...current,
          games: current.games.map((game) => ({
            ...game,
            packages: game.packages?.map((offer: Offer) => offer.id === offerId ? { ...offer, ...values, priceUsd, featured: values.featured ?? offer.featured } : offer) ?? [],
          })),
        };
      }
      return {
        ...current,
        smm: current.smm.map((service) => ({
          ...service,
          tiers: service.tiers?.map((offer: Offer) => offer.id === offerId ? { ...offer, ...values, priceUsd } : offer) ?? [],
        })),
      };
    });
  };

  const updateGame = trpc.admin.updateGamePackage.useMutation({
    onMutate: (input) => {
      const previous = utils.admin.fullCatalog.getData();
      applyOfferUpdate("game", input.packageId, { basePriceUsd: input.basePriceUsd ?? input.priceUsd ?? "0", profitMarginPercent: input.profitMarginPercent ?? "0.00", isActive: input.isActive, featured: input.featured });
      return { previous };
    },
    onError: (_error, _input, context) => utils.admin.fullCatalog.setData(undefined, context?.previous),
    onSuccess: () => utils.admin.fullCatalog.invalidate(),
  });

  const updateSmm = trpc.admin.updateSmmTier.useMutation({
    onMutate: (input) => {
      const previous = utils.admin.fullCatalog.getData();
      applyOfferUpdate("smm", input.tierId, { basePriceUsd: input.basePriceUsd ?? input.priceUsd ?? "0", profitMarginPercent: input.profitMarginPercent ?? "0.00", isActive: input.isActive });
      return { previous };
    },
    onError: (_error, _input, context) => utils.admin.fullCatalog.setData(undefined, context?.previous),
    onSuccess: () => utils.admin.fullCatalog.invalidate(),
  });

  const deleteGame = trpc.admin.deleteGamePackage.useMutation({ onSuccess: () => utils.admin.fullCatalog.invalidate() });
  const deleteSmm = trpc.admin.deleteSmmTier.useMutation({ onSuccess: () => utils.admin.fullCatalog.invalidate() });
  const saveFullTicketEvent = trpc.admin.saveContent.useMutation({ onSuccess: () => { utils.admin.content.invalidate(); utils.content.active.invalidate(); } });
  const syncTopup = trpc.admin.syncTopupCatalog.useMutation({
    onSuccess: (result) => {
      setSyncNotice(`បាន Sync ហ្គេម ${result.gamesImported} និងកញ្ចប់ ${result.offersImported} រួចរាល់។ ឥឡូវអ្នកអាចកំណត់ Base USD និង Margin សម្រាប់កញ្ចប់នីមួយៗបាន។`);
      utils.admin.fullCatalog.invalidate();
      utils.admin.providerCatalogStatus.invalidate();
    },
  });
  const syncSmm = trpc.admin.syncSmmCatalog.useMutation({
    onSuccess: (result) => {
      setSyncNotice(`បាន Sync សេវា SMM ${result.servicesImported} និង offer ${result.tiersImported} រួចរាល់។ ឥឡូវអ្នកអាចកំណត់ Base USD និង Margin សម្រាប់ offer នីមួយៗបាន។`);
      utils.admin.fullCatalog.invalidate();
      utils.admin.providerCatalogStatus.invalidate();
    },
  });
  const updateAvailabilityCache = (input: { kind: CatalogKind; providerId: string; isActive: boolean }) => {
    utils.admin.providerAvailability.setData(undefined, (current) => {
      if (!current) return current;
      if (input.kind === "game") return { ...current, games: current.games.map((item) => item.id === input.providerId ? { ...item, isActive: input.isActive } : item) };
      return { ...current, smm: current.smm.map((item) => item.id === input.providerId ? { ...item, isActive: input.isActive } : item) };
    });
  };

  const toggleAvailability = trpc.admin.setProviderAvailability.useMutation({
    onMutate: (input) => {
      const previous = utils.admin.providerAvailability.getData();
      setAvailabilityNotice(null);
      updateAvailabilityCache(input);
      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.admin.providerAvailability.setData(undefined, context?.previous);
    },
    onSuccess: (_result, input) => {
      setAvailabilityNotice(input.isActive ? "បានបង្ហាញ product ក្នុងហាងវិញ និងរក្សាទុករួចរាល់។" : "បានដក product ចេញពីហាង និងរក្សាទុករួចរាល់។ អ្នកអាចបើកវិញបាននៅតម្រង ‘បានដកចេញ’។");
      utils.provider.games.invalidate();
      utils.provider.smmServices.invalidate();
      utils.admin.providerAvailability.invalidate();
    },
  });
  const setSelectedVisibility = async (isActive: boolean) => {
    const selected = Array.from(selectedCatalogIds).map((value) => {
      const separator = value.indexOf(":");
      return { kind: value.slice(0, separator) as CatalogKind, providerId: value.slice(separator + 1) };
    }).filter((item) => item.providerId);
    if (!selected.length) return;
    setBatchBusy(true);
    try {
      for (const item of selected) await toggleAvailability.mutateAsync({ ...item, isActive });
      setSelectedCatalogIds(new Set());
    } finally {
      setBatchBusy(false);
    }
  };

  const actionError = availability.error ?? toggleAvailability.error ?? updateGame.error ?? updateSmm.error ?? deleteGame.error ?? deleteSmm.error ?? saveFullTicketEvent.error ?? syncTopup.error ?? syncSmm.error;

  return <main className="mx-auto max-w-6xl pb-10">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-bold tracking-[0.14em] text-indigo-700">CATALOG CONTROL</p>
        <h1 className="mt-1 font-display text-3xl font-bold text-slate-950">គ្រប់គ្រងផលិតផល និងតម្លៃ</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">ស្វែងរកហ្គេមពិតទាំងអស់ពី FazerCards រួចចុច Add to store តែហ្គេមដែលអ្នកចង់ public។ ហ្គេមដែលមិនទាន់ Add នឹងមិនបង្ហាញនៅទំព័រអតិថិជន ឬអាចចូលតាមតំណដោយផ្ទាល់បានទេ។</p>
      </div>
      <AnimatedBackButton href="/admin" className="h-10 justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700">ត្រឡប់ទៅ Admin</AnimatedBackButton>
    </header>

    {actionError ? <AdminError error={actionError} /> : null}
    {availabilityNotice ? <div role="status" className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>{availabilityNotice}</p></div> : null}
    {syncNotice ? <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /><p>{syncNotice}</p></div> : null}
    <CatalogInventoryControls loading={availability.isLoading} inventory={availability.data} search={catalogSearch} kindFilter={catalogKind} visibilityFilter={catalogVisibility} selectedIds={selectedCatalogIds} busy={toggleAvailability.isPending || batchBusy} onSearch={setCatalogSearch} onKindFilter={setCatalogKind} onVisibilityFilter={setCatalogVisibility} onToggle={(kind, providerId, isActive) => toggleAvailability.mutate({ kind, providerId, isActive })} onToggleSelected={(key) => setSelectedCatalogIds((current) => { const next = new Set(current); next.has(key) ? next.delete(key) : next.add(key); return next; })} onSetSelectedVisibility={setSelectedVisibility} />
    <FullTicketEventControl content={eventContent.data} loading={eventContent.isLoading} saving={saveFullTicketEvent.isPending} onSave={(input) => saveFullTicketEvent.mutate(input)} />
    <section className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs leading-6 text-amber-900"><Calculator className="mr-2 inline h-4 w-4" />ការកំណត់តម្លៃ និង Margin ខាងក្រោមប្រើសម្រាប់ records ដែលបាន sync និងមាន provider authorization ប៉ុណ្ណោះ។ មិនមានការបង្កើតផលិតផលក្លែងក្លាយដោយដៃឡើយ។</section>
    <ProviderSyncStatus loading={providerStatus.isLoading} status={providerStatus.data} onSyncTopup={() => syncTopup.mutate()} onSyncSmm={() => syncSmm.mutate()} syncingTopup={syncTopup.isPending} syncingSmm={syncSmm.isPending} />
    {catalog.isLoading ? <div className="mt-6 grid min-h-48 place-items-center"><ActivityLoader size={30} /></div> : <details className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-extrabold text-slate-900"><span>កំណត់តម្លៃ និង Margin លម្អិត</span><span className="text-[10px] font-semibold text-slate-500">បើកនៅពេលត្រូវកែ offer និងតម្លៃ</span></summary><section className="grid gap-5 border-t border-slate-100 p-4 xl:grid-cols-2"><CatalogGroup title="Game Top-up offers" groups={catalog.data?.games ?? []} onSaveGame={(offer, values) => updateGame.mutate({ packageId: offer.id, ...values })} onDeleteGame={(id) => deleteGame.mutate({ packageId: id })} /><CatalogGroup title="SMM offers" groups={catalog.data?.smm ?? []} onSaveSmm={(offer, values) => updateSmm.mutate({ tierId: offer.id, ...values })} onDeleteSmm={(id) => deleteSmm.mutate({ tierId: id })} /></section></details>}
  </main>;
}

function FullTicketEventControl({ content, loading, saving, onSave }: { content?: EventContent[]; loading: boolean; saving: boolean; onSave: (input: { contentKey: string; titleKh: string; bodyKh?: string; isActive: boolean }) => void }) {
  const event = content?.find((item) => item.contentKey === "topup-event-full-ticket");
  const [title, setTitle] = useState("កញ្ចប់ Full Ticket");
  const [description, setDescription] = useState("បង្ហាញតែកញ្ចប់ Full Ticket ដែល Provider មានក្នុងពេល Event ប៉ុណ្ណោះ។");

  useEffect(() => {
    if (!event) return;
    setTitle(event.titleKh?.trim() || "កញ្ចប់ Full Ticket");
    setDescription(event.bodyKh?.trim() || "បង្ហាញតែកញ្ចប់ Full Ticket ដែល Provider មានក្នុងពេល Event ប៉ុណ្ណោះ។");
  }, [event?.id]);

  const persist = (isActive: boolean) => onSave({ contentKey: "topup-event-full-ticket", titleKh: title.trim() || "កញ្ចប់ Full Ticket", bodyKh: description.trim() || undefined, isActive });
  return <section className="mt-6 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="flex min-w-0 items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-sm"><Ticket className="h-5 w-5" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-extrabold text-slate-950">Event · Full Ticket</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event?.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{event?.isActive ? "កំពុងបង្ហាញ" : "មិនទាន់បង្ហាញ"}</span></div><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">បើក section នេះតែពេលមាន Event។ វាមិនបង្កើតផលិតផលថ្មីទេ—អតិថិជននឹងឃើញតែកញ្ចប់ Provider ពិតដែលមានពាក្យ “Full Ticket” ប៉ុណ្ណោះ។</p></div></div><button type="button" disabled={loading || saving} onClick={() => persist(!event?.isActive)} className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${event?.isActive ? "bg-slate-900 hover:bg-slate-700" : "bg-violet-600 hover:bg-violet-700"}`}>{saving ? <ActivityLoader size={16} color="#ffffff" /> : <CalendarDays className="h-4 w-4" />}{event?.isActive ? "បិទ Event" : "បើក Event"}</button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-1.5 block text-[10px] font-bold text-slate-600">ចំណងជើងដែលបង្ហាញលើហាង</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={240} className="h-10 w-full rounded-xl border border-violet-100 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label><label><span className="mb-1.5 block text-[10px] font-bold text-slate-600">អត្ថបទពណ៌នា (ជាជម្រើស)</span><input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={5000} className="h-10 w-full rounded-xl border border-violet-100 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100" /></label></div><button type="button" disabled={loading || saving} onClick={() => persist(Boolean(event?.isActive))} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-800 disabled:cursor-not-allowed disabled:opacity-50"><Save className="h-3.5 w-3.5" />រក្សាទុកអត្ថបទ Event</button></section>;
}

function CatalogInventoryControls({ loading, inventory, search, kindFilter, visibilityFilter, selectedIds, busy, onSearch, onKindFilter, onVisibilityFilter, onToggle, onToggleSelected, onSetSelectedVisibility }: { loading: boolean; inventory?: { games: AvailabilityItem[]; smm: AvailabilityItem[] }; search: string; kindFilter: "all" | CatalogKind; visibilityFilter: "all" | "active" | "hidden"; selectedIds: Set<string>; busy: boolean; onSearch: (value: string) => void; onKindFilter: (value: "all" | CatalogKind) => void; onVisibilityFilter: (value: "all" | "active" | "hidden") => void; onToggle: (kind: CatalogKind, providerId: string, isActive: boolean) => void; onToggleSelected: (key: string) => void; onSetSelectedVisibility: (isActive: boolean) => void }) {
  const query = search.trim().toLowerCase();
  const items = useMemo(() => [
    ...(inventory?.games ?? []).map((item) => ({ ...item, kind: "game" as const, key: `game:${item.id}`, detail: "Game Top-up" })),
    ...(inventory?.smm ?? []).map((item) => ({ ...item, kind: "smm" as const, key: `smm:${item.id}`, detail: item.category ? `SMM · ${item.category}` : "SMM service" })),
  ].sort((left, right) => left.name.localeCompare(right.name)), [inventory]);
  const filtered = useMemo(() => items.filter((item) => {
    const matchesSearch = !query || `${item.name} ${item.detail}`.toLowerCase().includes(query);
    const matchesKind = kindFilter === "all" || item.kind === kindFilter;
    const matchesVisibility = visibilityFilter === "all" || (visibilityFilter === "active" ? item.isActive : !item.isActive);
    return matchesSearch && matchesKind && matchesVisibility;
  }), [items, query, kindFilter, visibilityFilter]);
  const activeCount = items.filter((item) => item.isActive).length;
  const selectedCount = filtered.filter((item) => selectedIds.has(item.key)).length;
  const allFilteredSelected = Boolean(filtered.length) && selectedCount === filtered.length;
  const toggleAllFiltered = () => filtered.forEach((item) => { if (allFilteredSelected ? selectedIds.has(item.key) : !selectedIds.has(item.key)) onToggleSelected(item.key); });

  return <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Layers3 className="h-4.5 w-4.5" /></span><div><h2 className="text-sm font-extrabold text-slate-950">បញ្ជីហ្គេម FazerCards ទាំងអស់</h2><p className="mt-0.5 text-xs leading-5 text-slate-500">Default បង្ហាញគ្រប់ហ្គេមដែល provider អនុញ្ញាត។ ចុច «បន្ថែមចូលហាង» ដើម្បី public ហ្គេមដែលអ្នកជ្រើស។ ហ្គេមដែលមិនទាន់ Add នឹងមិនបង្ហាញដល់អតិថិជនទេ។</p></div></div></div><div className="grid grid-cols-2 gap-2 text-center sm:flex"><div className="rounded-xl bg-slate-50 px-3 py-2"><p className="text-lg font-extrabold text-slate-950">{items.length}</p><p className="text-[9px] font-bold text-slate-500">ផលិតផលសរុប</p></div><div className="rounded-xl bg-emerald-50 px-3 py-2"><p className="text-lg font-extrabold text-emerald-700">{activeCount}</p><p className="text-[9px] font-bold text-emerald-700/70">កំពុងបង្ហាញ</p></div></div></div><div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]"><label className="relative block"><span className="sr-only">ស្វែងរកផលិតផល</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="ស្វែងរកហ្គេម ឬ SMM service…" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100" />{search ? <button type="button" onClick={() => onSearch("")} aria-label="សម្អាតការស្វែងរក" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"><X className="h-4 w-4" /></button> : null}</label><div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="ប្រភេទផលិតផល">{([{ value: "all", label: "ទាំងអស់" }, { value: "game", label: "Games" }, { value: "smm", label: "SMM" }] as const).map((filter) => <button key={filter.value} type="button" onClick={() => onKindFilter(filter.value)} aria-pressed={kindFilter === filter.value} className={`h-8 shrink-0 rounded-lg px-3 text-[10px] font-bold ${kindFilter === filter.value ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{filter.label}</button>)}</div><div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="ស្ថានភាពផលិតផល">{([{ value: "all", label: "ទាំងអស់" }, { value: "active", label: "ក្នុងហាង" }, { value: "hidden", label: "មិនទាន់ Add" }] as const).map((filter) => <button key={filter.value} type="button" onClick={() => onVisibilityFilter(filter.value)} aria-pressed={visibilityFilter === filter.value} className={`h-8 shrink-0 rounded-lg px-3 text-[10px] font-bold ${visibilityFilter === filter.value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}>{filter.label}</button>)}</div></div></div>{selectedCount ? <div className="flex flex-col gap-3 border-b border-indigo-100 bg-indigo-50/75 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-bold text-indigo-900">បានជ្រើស {selectedCount} ផលិតផលក្នុងបញ្ជីនេះ</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => onSetSelectedVisibility(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[10px] font-bold text-white disabled:opacity-50"><Eye className="h-3.5 w-3.5" />បន្ថែមចូលហាង</button><button type="button" disabled={busy} onClick={() => onSetSelectedVisibility(false)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[10px] font-bold text-white disabled:opacity-50"><EyeOff className="h-3.5 w-3.5" />លាក់ចេញពីហាង</button></div></div> : null}{loading ? <div className="grid min-h-44 place-items-center"><ActivityLoader /></div> : !inventory ? <div className="p-5 text-xs leading-5 text-rose-700">មិនអាចទាញបញ្ជីផលិតផលបានទេ។ សូមពិនិត្យ provider និង Appwrite configuration។</div> : filtered.length ? <div><div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5"><label className="inline-flex cursor-pointer items-center gap-2 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="h-3.5 w-3.5 accent-indigo-600" />ជ្រើសទាំងអស់ {filtered.length} ផលិតផល</label><span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500"><Filter className="h-3.5 w-3.5" />បង្ហាញ {filtered.length}/{items.length}</span></div><div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">{filtered.map((item) => <article key={item.key} className="flex min-w-0 items-center gap-3 p-3 transition hover:bg-slate-50"><input type="checkbox" checked={selectedIds.has(item.key)} onChange={() => onToggleSelected(item.key)} aria-label={`ជ្រើស ${item.name}`} className="h-3.5 w-3.5 shrink-0 accent-indigo-600" /><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${item.kind === "game" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"}`}><Layers3 className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-extrabold text-slate-900">{item.name}</p><p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{item.detail}</p></div><button type="button" disabled={busy} onClick={() => onToggle(item.kind, item.id, !item.isActive)} className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[10px] font-bold disabled:cursor-not-allowed disabled:opacity-50 ${item.isActive ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{item.isActive ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{item.isActive ? "កំពុង public" : "បន្ថែមចូលហាង"}</button></article>)}</div></div> : <div className="grid min-h-44 place-items-center p-6 text-center"><div><Search className="mx-auto h-6 w-6 text-indigo-500" /><p className="mt-2 text-xs font-bold text-slate-800">មិនមានផលិតផលត្រូវនឹងតម្រងនេះទេ</p><button type="button" onClick={() => { onSearch(""); onKindFilter("all"); onVisibilityFilter("all"); }} className="mt-2 text-[11px] font-bold text-indigo-700">សម្អាតតម្រង</button></div></div>}</section>;
}

function AdminError({ error }: { error: { message: string } }) {
  const message = /availability control is not configured/i.test(error.message) ? "មិនទាន់មាន persistent storage សម្រាប់ control នេះទេ។ សូមកុំគិតថាការកែប្រែបានរក្សាទុក—ប្រព័ន្ធមិនបានប្តូរផលិតផលណាមួយឡើយ។" : "មិនអាចរក្សាទុកការកែប្រែបានទេ។ ការកំណត់ចាស់មិនត្រូវបានប្តូរ។ សូមព្យាយាមម្ដងទៀត បន្ទាប់ពីពិនិត្យការភ្ជាប់ Admin storage។";
  return <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs leading-5 text-rose-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>{message}</p></div>;
}

function ProviderSyncStatus({ loading, status, onSyncTopup, onSyncSmm, syncingTopup, syncingSmm }: { loading: boolean; status?: { configured: boolean; smmConfigured?: boolean }; onSyncTopup: () => void; onSyncSmm: () => void; syncingTopup: boolean; syncingSmm: boolean }) {
  const sources = [{ label: "FZR Cards · Game Top-up", ready: status?.configured, syncing: syncingTopup, onSync: onSyncTopup }, { label: "SMMGlob · SMM Services", ready: status?.smmConfigured, syncing: syncingSmm, onSync: onSyncSmm }];
  return <div className="mt-3 grid gap-3 lg:grid-cols-2">{sources.map((source) => <div key={source.label} className={`flex flex-col gap-3 rounded-2xl border p-4 text-xs ${source.ready ? "border-emerald-100 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}><div className="flex items-start gap-3">{source.ready ? <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" /> : <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />}<div><p className="font-bold">{source.label}</p><p className="mt-1 leading-5">{loading ? "កំពុងពិនិត្យ provider connection។ អ្នកអាចចាប់ផ្ដើម Sync បាន ហើយ server នឹងផ្ទៀងផ្ទាត់មុនរក្សាទុក។" : source.ready ? "អាចទាញទិន្នន័យពី provider បាន។ Sync ប្រើសម្រាប់ record តម្លៃ និង margin ខាងក្រោម។" : "មិនទាន់អាច sync បានទេ។ មិនមានការបង្កើតផលិតផលក្លែងក្លាយឡើយ។"}</p></div></div><button type="button" disabled={source.syncing || (!loading && !source.ready)} onClick={source.onSync} className="inline-flex h-9 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">{source.syncing ? <ActivityLoader size={16} color="#ffffff" /> : <RefreshCw className="h-3.5 w-3.5" />}Sync catalog</button></div>)}</div>;
}

function CatalogGroup({ title, groups, onSaveGame, onDeleteGame, onSaveSmm, onDeleteSmm }: { title: string; groups: any[]; onSaveGame?: (offer: Offer, values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean; featured: boolean }) => void; onDeleteGame?: (id: string) => void; onSaveSmm?: (offer: Offer, values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean }) => void; onDeleteSmm?: (id: string) => void }) {
  return <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">{title}</h2></div>{groups.length ? groups.map((group) => <div key={group.id} className="border-b border-slate-100 p-4 last:border-0"><p className="text-sm font-bold text-slate-900">{group.titleKh ?? group.platform ?? "Provider product"}</p><div className="mt-3 space-y-2">{group.packages?.map((offer: Offer) => <OfferEditor key={offer.id} offer={offer} label={offer.amountLabel ?? "Offer"} onSave={(values) => onSaveGame?.(offer, { ...values, featured: Boolean(offer.featured) })} onDelete={() => onDeleteGame?.(offer.id)} />)}{group.tiers?.map((offer: Offer) => <OfferEditor key={offer.id} offer={offer} label={`${Number(offer.quantity).toLocaleString()} units`} onSave={(values) => onSaveSmm?.(offer, values)} onDelete={() => onDeleteSmm?.(offer.id)} />)}</div></div>) : <div className="p-6 text-center text-xs text-slate-500">មិនទាន់មាន provider offers សម្រាប់កំណត់តម្លៃទេ។</div>}</div>;
}

function OfferEditor({ offer, label, onSave, onDelete }: { offer: Offer; label: string; onSave: (values: { basePriceUsd: string; profitMarginPercent: string; isActive: boolean }) => void; onDelete: () => void }) {
  const [base, setBase] = useState(offer.basePriceUsd);
  const [margin, setMargin] = useState(offer.profitMarginPercent);
  const [active, setActive] = useState(offer.isActive);
  const canEdit = offer.providerAuthorized;
  const sale = Number(base || 0) * (1 + Number(margin || 0) / 100);
  return <div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{label}</p><p className={`mt-1 text-[10px] font-bold ${canEdit ? "text-emerald-700" : "text-amber-700"}`}>{canEdit ? `Provider authorized${offer.providerSource ? ` · ${offer.providerSource}` : ""}` : "Provider authorization required"}</p></div><label className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-slate-600"><input checked={active} disabled={!canEdit} onChange={(event) => setActive(event.target.checked)} type="checkbox" />Live</label></div>{!canEdit ? <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">Record នេះមិនអាចកែ ឬបើកបានទេ រហូតដល់ provider sync បានបញ្ជាក់ source របស់វា។</p> : null}<div className="mt-3 grid grid-cols-2 gap-2"><label><span className="mb-1 block text-[10px] font-bold text-slate-500">Base USD</span><input disabled={!canEdit} value={base} onChange={(event) => setBase(event.target.value)} inputMode="decimal" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-100" /></label><label><span className="mb-1 block text-[10px] font-bold text-slate-500">Margin %</span><input disabled={!canEdit} value={margin} onChange={(event) => setMargin(event.target.value)} inputMode="decimal" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs disabled:cursor-not-allowed disabled:bg-slate-100" /></label></div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-[11px] text-slate-600">តម្លៃលក់៖ <strong className="text-slate-900">${Number.isFinite(sale) ? sale.toFixed(2) : "0.00"}</strong></p><div className="flex gap-1"><button type="button" disabled={!canEdit} onClick={() => onSave({ basePriceUsd: base, profitMarginPercent: margin, isActive: active })} className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"><Save className="h-3 w-3" />រក្សាទុក</button><button type="button" onClick={() => { if (window.confirm(`លុប ${label} ពិតមែនទេ?`)) onDelete(); }} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700" aria-label="Delete offer"><Trash2 className="h-3.5 w-3.5" /></button></div></div></div>;
}
