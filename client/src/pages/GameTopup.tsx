import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { SelectedPackageCheck } from "@/components/SelectedPackageCheck";
import { countryFlagForRegion, providerPackageBadge } from "@/lib/providerPresentation";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check, CheckCircle2, ChevronRight, CircleAlert, Gem, History, ShieldAlert, UserRound, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";

type SavedPlayerEntry = { id: string; fields: Record<string, string>; savedAt: number };
type GameField = { key: string; label: string; placeholder?: string | null; required: boolean; kind: string };

const savedPlayerStoragePrefix = "zurs:verified-player:";

export function gameTopupPath(gameId: string) {
  return `/topup/${encodeURIComponent(gameId)}`;
}

export function gameIdFromTopupPath(pathname: string) {
  const prefix = "/topup/";
  if (!pathname.startsWith(prefix)) return "";
  try { return decodeURIComponent(pathname.slice(prefix.length)).trim(); } catch { return ""; }
}

function savedPlayerStorageKey(gameId: string) { return `${savedPlayerStoragePrefix}${encodeURIComponent(gameId)}`; }

export function readVerifiedPlayerEntries(gameId: string): SavedPlayerEntry[] {
  if (typeof window === "undefined" || !gameId) return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(savedPlayerStorageKey(gameId)) ?? "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is SavedPlayerEntry => Boolean(entry) && typeof entry === "object" && typeof (entry as SavedPlayerEntry).id === "string" && typeof (entry as SavedPlayerEntry).savedAt === "number" && Boolean((entry as SavedPlayerEntry).fields) && typeof (entry as SavedPlayerEntry).fields === "object").slice(0, 6);
  } catch { return []; }
}

export function saveVerifiedPlayerEntry(gameId: string, fields: Record<string, string>) {
  if (typeof window === "undefined" || !gameId || !Object.keys(fields).length) return [];
  const normalizedFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, value.trim()]).filter(([, value]) => Boolean(value)));
  const fingerprint = Object.entries(normalizedFields).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`).join("|");
  if (!fingerprint) return readVerifiedPlayerEntries(gameId);
  const entry: SavedPlayerEntry = { id: fingerprint, fields: normalizedFields, savedAt: Date.now() };
  const next = [entry, ...readVerifiedPlayerEntries(gameId).filter((item) => item.id !== entry.id)].slice(0, 6);
  try { window.localStorage.setItem(savedPlayerStorageKey(gameId), JSON.stringify(next)); } catch { /* Storage can be unavailable in private browsing. */ }
  return next;
}

function savedPlayerLabel(fields: Record<string, string>) {
  const candidate = Object.entries(fields).find(([key]) => /player|user|account|(^|_)id$/i.test(key))?.[1] ?? Object.values(fields)[0] ?? "";
  return candidate.length > 4 ? `ID •••${candidate.slice(-4)}` : "ID ដែលបានបញ្ជាក់";
}

export default function GameTopup() {
  const [location] = useLocation();
  const gameId = gameIdFromTopupPath(location);
  const gameInput = useMemo(() => ({ gameId }), [gameId]);
  const gameQuery = trpc.provider.gameDetails.useQuery(gameInput, { enabled: Boolean(gameId) });
  const paymentReadiness = trpc.payments.readiness.useQuery();
  const providerPackages = trpc.provider.packages.useMutation();
  const validatePlayerId = trpc.provider.validatePlayerId.useMutation();
  const [details, setDetails] = useState<Record<string, string>>({});
  const [showPackages, setShowPackages] = useState(false);
  const [selectedPackageId, setSelectedPackageIdState] = useState("");
  const [unsupportedIdConfirmed, setUnsupportedIdConfirmed] = useState(false);
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayerEntry[]>([]);
  const [autofillVersion, setAutofillVersion] = useState(0);
  const { setSelectedProduct, clearSelectedProduct } = useSelectedProduct();
  const game = gameQuery.data?.status === "ready" ? gameQuery.data.game : null;
  const fieldsReady = Boolean(game && game.requiredFields.filter((field) => field.required).every((field) => details[field.key]?.trim()));
  const providerFields = useMemo(() => {
    if (!game || !fieldsReady) return null;
    return Object.fromEntries(game.requiredFields.filter((field) => field.required || Boolean(details[field.key]?.trim())).map((field) => [field.key, details[field.key]!.trim()]));
  }, [details, fieldsReady, game]);
  const validationInput = useMemo(() => game && providerFields ? { gameId: game.id, fields: providerFields } : null, [game, providerFields]);
  const packages = providerPackages.data?.packages ?? [];
  const identity = validatePlayerId.data;
  const canBrowsePackages = fieldsReady && (identity?.status === "verified" || (identity?.status === "not_supported" && unsupportedIdConfirmed));
  const country = countryFlagForRegion(identity?.status === "verified" ? identity.region : null);

  const setSelectedPackageId = (id: string) => {
    setSelectedPackageIdState(id);
    const selected = packages.find((item) => item.id === id);
    if (selected) setSelectedProduct({ ...selected, gameName: game?.name ?? "", gameLogoUrl: game?.logoUrl });
    else clearSelectedProduct();
  };

  useEffect(() => {
    if (!validationInput) return;
    const timer = window.setTimeout(() => validatePlayerId.mutate(validationInput), 650);
    return () => window.clearTimeout(timer);
  }, [validationInput]);

  useEffect(() => () => clearSelectedProduct(), []);

  useEffect(() => {
    setSavedPlayers(game ? readVerifiedPlayerEntries(game.id) : []);
  }, [game?.id]);

  useEffect(() => {
    if (!game || identity?.status !== "verified" || !providerFields) return;
    setSavedPlayers(saveVerifiedPlayerEntry(game.id, providerFields));
  }, [game?.id, identity?.status, providerFields]);

  const updateDetail = (key: string, value: string) => {
    setDetails((current) => ({ ...current, [key]: value }));
    validatePlayerId.reset();
    setUnsupportedIdConfirmed(false);
    setShowPackages(false);
    setSelectedPackageId("");
  };

  const chooseSavedPlayer = (entry: SavedPlayerEntry) => {
    setDetails(entry.fields);
    validatePlayerId.reset();
    setUnsupportedIdConfirmed(false);
    setShowPackages(false);
    setSelectedPackageId("");
    setAutofillVersion((current) => current + 1);
  };

  const loadPackages = () => {
    if (!game || !canBrowsePackages) return;
    setShowPackages(true);
    providerPackages.mutate({ gameId: game.id, fields: providerFields ?? {}, idConfirmed: identity?.status === "not_supported" && unsupportedIdConfirmed });
  };

  return <StorefrontLayout><main className="container py-5 sm:py-9"><LoadingOverlay open={gameQuery.isLoading || providerPackages.isPending} label={providerPackages.isPending ? "កំពុងរៀបចំកញ្ចប់សេវា…" : "កំពុងរៀបចំព័ត៌មានហ្គេម…"} /><Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"><ArrowLeft className="motion-icon h-4 w-4" />ត្រឡប់ទៅជ្រើសហ្គេម</Link>{gameQuery.isLoading ? <section className="mt-4 grid min-h-80 place-items-center rounded-[1.5rem] bg-white/80"><div className="text-center text-xs text-slate-500"><OutlineLoader size={32} color="#4f46e5" /><p className="mt-3">កំពុងរៀបចំព័ត៌មានហ្គេម…</p></div></section> : game ? <section className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]"><aside className="game-detail-hero premium-shine relative overflow-hidden rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/15 sm:p-7"><div aria-hidden="true" className="absolute -right-14 top-0 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" /><div aria-hidden="true" className="diamond-decor diamond-decor--one"><Gem /></div><div aria-hidden="true" className="diamond-decor diamond-decor--two"><Gem /></div><div className="relative"><ProviderGameArtwork name={game.name} logoUrl={game.logoUrl} priority className="h-20 w-20 rounded-2xl" iconClassName="h-8 w-8" /><p className="mt-7 text-[10px] font-bold tracking-[0.16em] text-indigo-200">OFFICIAL PROVIDER GAME</p><h1 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-4xl">{game.name}</h1><p className="mt-4 text-xs leading-6 text-slate-300">បំពេញព័ត៌មានគណនីរបស់អ្នកឲ្យត្រឹមត្រូវ។ ប្រព័ន្ធនឹងបង្ហាញតែកញ្ចប់ និងតម្លៃដែល provider អនុញ្ញាតសម្រាប់ហ្គេមនេះប៉ុណ្ណោះ។</p><div className="mt-6 flex items-center gap-2 text-[11px] font-semibold text-indigo-100"><UserRound className="h-4 w-4" />{game.requiredFields.length || "0"} ព័ត៌មានគណនីត្រូវបំពេញ</div></div></aside><section className="surface rounded-[1.5rem] p-5 sm:p-7"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">GAME TOP-UP</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">បំពេញព័ត៌មាន {game.name}</h2>{!paymentReadiness.isLoading && !paymentReadiness.data?.ready ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>អ្នកអាចពិនិត្យកញ្ចប់ និងតម្លៃបាន។ ប៊ូតុងទិញត្រូវបានបិទជាបណ្តោះអាសន្ន ខណៈហាងកំពុងពិនិត្យសុវត្ថិភាពការទូទាត់។</p></div> : null}<SavedPlayerPicker entries={savedPlayers} fields={game.requiredFields} onChoose={chooseSavedPlayer} /><form onSubmit={(event) => { event.preventDefault(); loadPackages(); }} className="mt-5">{game.requiredFields.length ? <div className="grid gap-3 sm:grid-cols-2">{game.requiredFields.map((field) => <label key={field.key} className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{field.label}{field.required ? <span className="ml-1 text-indigo-600">*</span> : null}</span><input key={`${field.key}-${autofillVersion}`} required={field.required} type={field.kind} value={details[field.key] ?? ""} onChange={(event) => updateDetail(field.key, event.target.value)} placeholder={field.placeholder ?? field.label} className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white ${autofillVersion ? "saved-id-autofill" : ""}`} /></label>)}</div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">ហ្គេមនេះមិនទាមទារព័ត៌មានគណនីបន្ថែមពី provider ទេ។ សូមបន្តពិនិត្យកញ្ចប់សេវា។</div>}{validationInput ? <IdentityStatus identity={identity} pending={validatePlayerId.isPending} country={country} unsupportedIdConfirmed={unsupportedIdConfirmed} onConfirmUnsupportedId={setUnsupportedIdConfirmed} /> : <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">សូមបំពេញព័ត៌មានដែលត្រូវការ។ ប្រព័ន្ធនឹងពិនិត្យឈ្មោះគណនីដោយស្វ័យប្រវត្តិ ប្រសិនបើ provider គាំទ្រហ្គេមនេះ។</div>}<button type="submit" disabled={!canBrowsePackages || providerPackages.isPending} className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{providerPackages.isPending ? <OutlineLoader size={19} color="#ffffff" /> : <WalletCards className="h-4 w-4" />}បង្ហាញកញ្ចប់ និងតម្លៃ <ChevronRight className="h-4 w-4" /></button></form>{showPackages ? <DiamondPackages packages={packages} status={providerPackages.data?.status} selectedPackageId={selectedPackageId} onSelect={setSelectedPackageId} gameName={game.name} gameLogoUrl={game.logoUrl} /> : null}</section></section> : <section className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-white/75 p-8 text-center"><p className="font-display text-xl font-bold text-slate-900">មិនអាចរកឃើញហ្គេមនេះទេ</p><p className="mt-2 text-sm text-slate-500">សូមត្រឡប់ទៅទំព័រដើម ហើយជ្រើសហ្គេមពីបញ្ជី provider។</p><Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ត្រឡប់ទៅជ្រើសហ្គេម</Link></section>}</main></StorefrontLayout>;
}

function SavedPlayerPicker({ entries, fields, onChoose }: { entries: SavedPlayerEntry[]; fields: GameField[]; onChoose: (entry: SavedPlayerEntry) => void }) {
  const usableEntries = entries.filter((entry) => fields.filter((field) => field.required).every((field) => Boolean(entry.fields[field.key])));
  if (!usableEntries.length) return null;
  return <section className="saved-player-picker mt-4 rounded-xl p-3"><div className="flex items-start gap-2"><span className="saved-player-picker-icon"><History className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-extrabold text-slate-900">ID ដែលបានបញ្ជាក់ពីមុន</p><p className="mt-0.5 text-[10px] leading-4 text-slate-600">ជ្រើសមួយ ដើម្បីបំពេញព័ត៌មានដោយស្វ័យប្រវត្តិលើឧបករណ៍នេះ។ មិនរក្សាទុកឈ្មោះគណនីឡើយ។</p></div></div><div className="mt-2 flex flex-wrap gap-2">{usableEntries.map((entry) => <button key={entry.id} type="button" onClick={() => onChoose(entry)} className="saved-player-choice">{savedPlayerLabel(entry.fields)}</button>)}</div></section>;
}

function IdentityStatus({ identity, pending, country, unsupportedIdConfirmed, onConfirmUnsupportedId }: { identity: ReturnType<typeof trpc.provider.validatePlayerId.useMutation>["data"]; pending: boolean; country: ReturnType<typeof countryFlagForRegion>; unsupportedIdConfirmed: boolean; onConfirmUnsupportedId: (checked: boolean) => void }) {
  if (pending) return <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/75 p-3 text-xs font-semibold text-indigo-800"><OutlineLoader size={18} color="#4f46e5" />កំពុងពិនិត្យឈ្មោះគណនី…</div>;
  if (identity?.status === "verified") return <div className="identity-verified identity-verified--gold mt-4 flex items-center gap-3 rounded-xl p-3"><span className="identity-verified-mark"><AnimatedGlyph name="success" size={18} color="#fff7db" /></span><div className="min-w-0"><p className="text-[10px] font-extrabold tracking-[0.12em] text-amber-900">គណនីបានបញ្ជាក់</p><p className="identity-verified-name mt-0.5 text-sm font-extrabold">{country ? <span className="country-flag" role="img" aria-label={`${country.label} flag`}>{country.flag}</span> : null}{identity.playerName}</p><p className="mt-0.5 text-[11px] text-amber-900/75">បានបញ្ជាក់ពី provider មុនបង្ហាញកញ្ចប់សេវា។</p></div><CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-amber-700" /></div>;
  if (identity?.status === "invalid") return <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3"><CircleAlert className="h-5 w-5 shrink-0 text-rose-600" /><p className="text-xs leading-5 text-rose-900">មិនអាចបញ្ជាក់គណនីនេះបានទេ។ សូមពិនិត្យ Player ID និង Server ID ម្តងទៀត។</p></div>;
  if (identity?.status === "not_supported") return <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p className="text-xs leading-5 text-amber-950">Provider មិនគាំទ្រការពិនិត្យឈ្មោះសម្រាប់ហ្គេមនេះទេ។ សូមពិនិត្យ ID របស់អ្នកឲ្យត្រឹមត្រូវ—ការបញ្ចូលខុសមិនអាចស្នើសុំ refund បានទេ។</p></div><label className="mt-3 flex cursor-pointer items-start gap-2 text-[11px] font-bold leading-5 text-amber-950"><input type="checkbox" checked={unsupportedIdConfirmed} onChange={(event) => onConfirmUnsupportedId(event.target.checked)} className="mt-0.5 h-3.5 w-3.5 accent-amber-700" />ខ្ញុំបានពិនិត្យ ID ហើយ និងយល់ព្រមបន្ត</label></div>;
  if (identity?.status === "unavailable" || identity?.status === "error") return <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><p className="text-xs leading-5 text-amber-900">មិនអាចពិនិត្យឈ្មោះគណនីពេលនេះទេ។ សូមកែព័ត៌មាន ឬព្យាយាមម្ដងទៀតបន្តិចក្រោយ។</p></div>;
  return <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><OutlineLoader size={18} color="#64748b" />កំពុងរៀបចំការពិនិត្យគណនី…</div>;
}

function DiamondPackages({ packages, status, selectedPackageId, onSelect, gameName, gameLogoUrl }: { packages: Array<{ id: string; label: string; amountLabel: string; priceLabel: string }>; status?: "ready" | "unavailable" | "error" | "verification_required"; selectedPackageId: string; onSelect: (id: string) => void; gameName: string; gameLogoUrl?: string }) {
  return <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center gap-2"><span className="diamond-title-icon"><Gem className="h-4 w-4" /></span><p className="text-sm font-bold text-slate-900">កញ្ចប់ Diamond ដែលមាន</p></div>{status === "ready" && packages.length ? <div className="mt-3 grid grid-cols-2 gap-3">{packages.map((item) => { const badge = providerPackageBadge(item.label); const selected = selectedPackageId === item.id; return <article key={item.id} className="min-w-0"><button type="button" aria-pressed={selected} onClick={() => onSelect(item.id)} className={`package-choice w-full text-left ${selected ? "package-choice--selected" : ""}`}><span className="package-choice-surface block rounded-[0.7rem] p-3"><span className="flex items-start justify-between gap-2"><span className="flex min-w-0 items-center gap-2"><ProviderGameArtwork name={gameName} logoUrl={gameLogoUrl} className="package-product-art h-7 w-7 rounded-lg" iconClassName="h-3.5 w-3.5" />{badge ? <span className={`package-badge package-badge--${badge.tone}`}>{badge.label}</span> : <span className="package-badge package-badge--standard">DIAMOND</span>}</span>{selected ? <SelectedPackageCheck size={20} className="package-choice-check text-emerald-600" /> : <Gem className="package-gem h-4 w-4 text-indigo-500" />}</span><span className="mt-3 block text-sm font-extrabold leading-5 text-slate-900">{item.label}</span><span className="mt-1 block text-xs text-slate-500">{item.amountLabel}</span><span className="mt-3 block text-sm font-extrabold text-indigo-700">{item.priceLabel}</span></span></button><button type="button" disabled aria-disabled="true" className="mt-2 inline-flex h-8 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-2 text-[10px] font-bold text-slate-500"><Check className="h-3.5 w-3.5" />ទិញមិនទាន់បើក</button></article>; })}</div> : <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">មិនអាចបង្ហាញកញ្ចប់សេវាសម្រាប់ពេលនេះទេ។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។</div>}</div>;
}
