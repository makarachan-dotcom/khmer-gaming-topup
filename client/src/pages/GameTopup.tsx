import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { SelectedPackageCheck } from "@/components/SelectedPackageCheck";
import { countryFlagForRegion, providerPackageBadge } from "@/lib/providerPresentation";
import { goldDiamondChestArtworkUrl, isMobileLegendsGlobalGame, mobileLegendsDiamondLabel } from "@/lib/mobileLegendsAssets";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CheckCircle2, ChevronRight, CircleAlert, Eye, Gem, History, ShieldAlert, Ticket, UserRound, WalletCards } from "lucide-react";
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
  const { user } = useAuth();
  const isOwnerAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  const providerPackages = trpc.provider.packages.useMutation();
  const validatePlayerId = trpc.provider.validatePlayerId.useMutation();
  const [details, setDetails] = useState<Record<string, string>>({});
  const [showPackages, setShowPackages] = useState(false);
  const [adminPreviewEnabled, setAdminPreviewEnabled] = useState(false);
  const [selectedPackageId, setSelectedPackageIdState] = useState("");
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
  const adminPreviewActive = isOwnerAdmin && adminPreviewEnabled;
  const adminPreview = trpc.admin.previewGamePackages.useQuery({ gameId }, { enabled: Boolean(gameId) && adminPreviewActive, staleTime: 60_000 });
  const packages = adminPreviewActive ? adminPreview.data?.packages ?? [] : providerPackages.data?.packages ?? [];
  const packageStatus = adminPreviewActive ? adminPreview.data?.status : providerPackages.data?.status;
  const identity = validatePlayerId.data;
  const canBrowsePackages = canBrowseTopupPackages(fieldsReady, identity?.status, adminPreviewActive);
  const country = countryFlagForRegion(identity?.status === "verified" ? identity.region : null);

  const setSelectedPackageId = (id: string) => {
    setSelectedPackageIdState(id);
    const selected = packages.find((item) => item.id === id);
    if (selected && !adminPreviewActive) setSelectedProduct({ ...selected, gameName: game?.name ?? "", gameLogoUrl: game?.logoUrl });
    else clearSelectedProduct();
  };

  useEffect(() => {
    if (!validationInput) return;
    const timer = window.setTimeout(() => validatePlayerId.mutate(validationInput), 650);
    return () => window.clearTimeout(timer);
  }, [validationInput]);

  useEffect(() => () => clearSelectedProduct(), []);

  useEffect(() => {
    if (!isMobileLegendsGlobalGame(game?.id ?? "")) return;
    const artwork = new Image();
    artwork.decoding = "async";
    artwork.fetchPriority = "high";
    artwork.src = goldDiamondChestArtworkUrl;
  }, [game?.id]);

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
    setShowPackages(false);
    setSelectedPackageId("");
  };

  const chooseSavedPlayer = (entry: SavedPlayerEntry) => {
    setDetails(entry.fields);
    validatePlayerId.reset();
    setShowPackages(false);
    setSelectedPackageId("");
    setAutofillVersion((current) => current + 1);
  };

  const loadPackages = () => {
    if (!game || !canBrowsePackages) return;
    setShowPackages(true);
    if (!adminPreviewActive) providerPackages.mutate({ gameId: game.id, fields: providerFields ?? {} });
  };

  return <StorefrontLayout><main className="container py-5 sm:py-9"><LoadingOverlay open={gameQuery.isLoading || providerPackages.isPending || adminPreview.isLoading} label={providerPackages.isPending || adminPreview.isLoading ? "កំពុងរៀបចំកញ្ចប់សេវា…" : "កំពុងរៀបចំព័ត៌មានហ្គេម…"} /><Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"><ArrowLeft className="motion-icon h-4 w-4" />ត្រឡប់ទៅជ្រើសហ្គេម</Link>{gameQuery.isLoading ? <section className="mt-4 grid min-h-80 place-items-center rounded-[1.5rem] bg-white/80"><div className="text-center text-xs text-slate-500"><OutlineLoader size={32} color="#4f46e5" /><p className="mt-3">កំពុងរៀបចំព័ត៌មានហ្គេម…</p></div></section> : game ? <section className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(16rem,0.72fr)_minmax(0,1.28fr)]"><aside className="game-detail-hero premium-shine relative self-start overflow-hidden rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/15 sm:p-6"><div aria-hidden="true" className="absolute -right-14 top-0 h-48 w-48 rounded-full bg-indigo-500/25 blur-3xl" /><div aria-hidden="true" className="diamond-decor diamond-decor--one"><Gem /></div><div aria-hidden="true" className="diamond-decor diamond-decor--two"><Gem /></div><div className="relative"><ProviderGameArtwork name={game.name} region={game.region} logoUrl={game.logoUrl} priority className="h-20 w-20 rounded-2xl" iconClassName="h-8 w-8" /><p className="mt-5 text-[10px] font-bold tracking-[0.16em] text-indigo-200">OFFICIAL GAME TOP-UP</p><h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">{game.name}</h1><p className="mt-3 text-xs leading-5 text-slate-300">បំពេញព័ត៌មានគណនីរបស់អ្នកឲ្យត្រឹមត្រូវ ដើម្បីជ្រើសកញ្ចប់ និងតម្លៃសម្រាប់ហ្គេមនេះ។</p><div className="mt-5 flex items-center gap-2 text-[11px] font-semibold text-indigo-100"><UserRound className="h-4 w-4" />{game.requiredFields.length || "0"} ព័ត៌មានគណនីត្រូវបំពេញ</div></div></aside><section className="surface rounded-[1.5rem] p-4 sm:p-5"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">GAME TOP-UP</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">បំពេញព័ត៌មាន {game.name}</h2>{!paymentReadiness.isLoading && !paymentReadiness.data?.ready ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>អ្នកអាចពិនិត្យកញ្ចប់ និងតម្លៃបាន។ ប៊ូតុងទិញត្រូវបានបិទជាបណ្តោះអាសន្ន ខណៈហាងកំពុងពិនិត្យសុវត្ថិភាពការទូទាត់។</p></div> : null}<SavedPlayerPicker entries={savedPlayers} fields={game.requiredFields} onChoose={chooseSavedPlayer} /><form onSubmit={(event) => { event.preventDefault(); loadPackages(); }} className="mt-4">{game.requiredFields.length ? <div className="grid gap-3 sm:grid-cols-2">{game.requiredFields.map((field) => <label key={field.key} className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{field.label}{field.required ? <span className="ml-1 text-indigo-600">*</span> : null}</span><input key={`${field.key}-${autofillVersion}`} required={field.required} type={field.kind} value={details[field.key] ?? ""} onChange={(event) => updateDetail(field.key, event.target.value)} placeholder={field.placeholder ?? field.label} className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white ${autofillVersion ? "saved-id-autofill" : ""}`} /></label>)}</div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">ហ្គេមនេះមិនទាមទារព័ត៌មានគណនីបន្ថែមទេ។ សូមបន្តពិនិត្យកញ្ចប់សេវា។</div>}{validationInput ? <IdentityStatus identity={identity} pending={validatePlayerId.isPending} country={country} /> : <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">សូមបំពេញព័ត៌មានដែលត្រូវការ។ ប្រព័ន្ធនឹងពិនិត្យឈ្មោះគណនីដោយស្វ័យប្រវត្តិ នៅពេលហ្គេមគាំទ្រ។</div>}<div className="mt-3 flex flex-wrap items-center gap-2"><button type="submit" disabled={!canBrowsePackages || providerPackages.isPending || adminPreview.isLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{providerPackages.isPending || adminPreview.isLoading ? <OutlineLoader size={19} color="#ffffff" /> : <WalletCards className="h-4 w-4" />}{adminPreviewActive ? "ផ្ទុក Admin UI" : "បង្ហាញកញ្ចប់ និងតម្លៃ"}<ChevronRight className="h-4 w-4" /></button>{isOwnerAdmin ? <button type="button" onClick={() => { setAdminPreviewEnabled((current) => !current); setShowPackages(true); setSelectedPackageId(""); }} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-extrabold transition ${adminPreviewActive ? "border-amber-300 bg-amber-50 text-amber-900" : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300 hover:bg-indigo-100"}`}><Eye className="h-4 w-4" />{adminPreviewActive ? "បិទ Admin Preview" : "មើល UI ជា Admin"}</button> : null}</div></form>{adminPreviewActive ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>Admin Preview</strong>៖ អ្នកកំពុងមើល package UI ដោយមិនបញ្ចូល Player ID។ Preview នេះមិនអនុញ្ញាតឱ្យជ្រើសទិញ ឬបង្កើត order ទេ។</div> : null}{showPackages ? <DiamondPackages packages={packages} status={packageStatus} selectedPackageId={selectedPackageId} onSelect={setSelectedPackageId} gameId={game.id} gameName={game.name} gameLogoUrl={game.logoUrl} /> : null}</section></section> : <section className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-white/75 p-8 text-center"><p className="font-display text-xl font-bold text-slate-900">មិនអាចរកឃើញហ្គេមនេះទេ</p><p className="mt-2 text-sm text-slate-500">សូមត្រឡប់ទៅទំព័រដើម ហើយជ្រើសហ្គេមពីបញ្ជីរបស់យើង។</p><Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ត្រឡប់ទៅជ្រើសហ្គេម</Link></section>}</main></StorefrontLayout>;
}

function SavedPlayerPicker({ entries, fields, onChoose }: { entries: SavedPlayerEntry[]; fields: GameField[]; onChoose: (entry: SavedPlayerEntry) => void }) {
  const usableEntries = entries.filter((entry) => fields.filter((field) => field.required).every((field) => Boolean(entry.fields[field.key])));
  if (!usableEntries.length) return null;
  return <section className="saved-player-picker mt-4 rounded-xl p-3"><div className="flex items-start gap-2"><span className="saved-player-picker-icon"><History className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-extrabold text-slate-900">ID ដែលបានបញ្ជាក់ពីមុន</p><p className="mt-0.5 text-[10px] leading-4 text-slate-600">ជ្រើសមួយ ដើម្បីបំពេញព័ត៌មានដោយស្វ័យប្រវត្តិលើឧបករណ៍នេះ។ មិនរក្សាទុកឈ្មោះគណនីឡើយ។</p></div></div><div className="mt-2 flex flex-wrap gap-2">{usableEntries.map((entry) => <button key={entry.id} type="button" onClick={() => onChoose(entry)} className="saved-player-choice">{savedPlayerLabel(entry.fields)}</button>)}</div></section>;
}

export function canBrowseVerifiedPackages(fieldsReady: boolean, status?: string) {
  return fieldsReady && status === "verified";
}

export function canBrowseTopupPackages(fieldsReady: boolean, status: string | undefined, adminPreviewActive: boolean) {
  return adminPreviewActive || canBrowseVerifiedPackages(fieldsReady, status);
}

function IdentityStatus({ identity, pending, country }: { identity: ReturnType<typeof trpc.provider.validatePlayerId.useMutation>["data"]; pending: boolean; country: ReturnType<typeof countryFlagForRegion> }) {
  if (pending) return <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/75 p-3 text-xs font-semibold text-indigo-800"><OutlineLoader size={18} color="#4f46e5" />កំពុងពិនិត្យឈ្មោះគណនី…</div>;
  if (identity?.status === "verified") return <div className="identity-verified identity-verified--gold mt-4 flex items-center gap-3 rounded-xl p-3"><span className="identity-verified-mark"><AnimatedGlyph name="success" size={18} color="#fff7db" /></span><div className="min-w-0"><p className="text-[10px] font-extrabold tracking-[0.12em] text-amber-900">គណនីបានបញ្ជាក់</p><p className="identity-verified-name mt-0.5 text-sm font-extrabold">{country ? <span className="country-flag" role="img" aria-label={`${country.label} flag`}>{country.flag}</span> : null}{identity.playerName}</p><p className="mt-0.5 text-[11px] text-amber-900/75">គណនីនេះបានបញ្ជាក់រួចរាល់។</p></div><CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-amber-700" /></div>;
  if (identity?.status === "invalid") return <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3"><CircleAlert className="h-5 w-5 shrink-0 text-rose-600" /><p className="text-xs leading-5 text-rose-900">មិនអាចបញ្ជាក់គណនីនេះបានទេ។ សូមពិនិត្យ Player ID និង Server ID ម្តងទៀត។</p></div>;
  if (identity?.status === "not_supported") return <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p className="text-xs leading-5 text-amber-950">Provider មិនអាចបញ្ជាក់ Username សម្រាប់ហ្គេមនេះពេលនេះទេ។ ដើម្បីការពារការបញ្ចូល ID ខុស កញ្ចប់ត្រូវបានចាក់សោររហូតដល់ការបញ្ជាក់បានជោគជ័យ។</p></div>;
  if (identity?.status === "unavailable" || identity?.status === "error") return <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><p className="text-xs leading-5 text-amber-900">មិនអាចពិនិត្យ Username ពី provider ពេលនេះទេ។ កញ្ចប់ និងប៊ូតុងបន្តត្រូវបានចាក់សោរ—សូមព្យាយាមម្ដងទៀតបន្តិចក្រោយ។</p></div>;
  return <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><OutlineLoader size={18} color="#64748b" />កំពុងរៀបចំការពិនិត្យគណនី…</div>;
}

export type ProviderPackage = { id: string; label: string; amountLabel: string; priceLabel: string };

export function providerPackagePrice(item: Pick<ProviderPackage, "priceLabel">) {
  const value = item.priceLabel.match(/\d[\d,]*(?:\.\d+)?/)?.[0];
  const parsed = value ? Number(value.replace(/,/g, "")) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

export function sortProviderPackagesByPrice<T extends ProviderPackage>(items: T[]) {
  return [...items].sort((left, right) => providerPackagePrice(left) - providerPackagePrice(right) || left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
}

function isFullTicketPackage(item: ProviderPackage) {
  return /\bfull\s*ticket\b/i.test(`${item.label} ${item.amountLabel}`);
}

function packageText(item: ProviderPackage) {
  return `${item.label} ${item.amountLabel}`.toLowerCase();
}

function isPassPackage(item: ProviderPackage) {
  return /\b(?:weekly|daily|monthly)\b|\b(?:membership|subscription)\b|\bpass\b/.test(packageText(item));
}

function isBonusPackage(item: ProviderPackage) {
  return /\bbonus\b|first\s*top[\s-]*up|\bextra\b|\+\s*\d[\d,]*(?:\s*[a-z]+)?\b/.test(packageText(item));
}

function isSpecialPackage(item: ProviderPackage) {
  return /\b(?:promo|special|discount|sale|event|exclusive|full\s*ticket)\b/.test(packageText(item));
}

export function groupProviderPackagesByMeaning<T extends ProviderPackage>(items: T[]) {
  const standard: T[] = [];
  const bonus: T[] = [];
  const passes: T[] = [];
  const special: T[] = [];

  for (const item of sortProviderPackagesByPrice(items)) {
    if (isPassPackage(item)) passes.push(item);
    else if (isBonusPackage(item)) bonus.push(item);
    else if (isSpecialPackage(item)) special.push(item);
    else standard.push(item);
  }

  return { standard, bonus, passes, special };
}

function PackageCard({ item, selected, onSelect, gameId, gameName, gameLogoUrl }: { item: ProviderPackage; selected: boolean; onSelect: () => void; gameId: string; gameName: string; gameLogoUrl?: string }) {
  const badge = providerPackageBadge(item.label);
  const mobileLegends = isMobileLegendsGlobalGame(gameId);
  const diamondLabel = mobileLegendsDiamondLabel(item.label, item.amountLabel);
  return <article className="min-w-0"><button type="button" aria-pressed={selected} onClick={onSelect} className={`package-choice package-choice--clean package-choice--gold w-full text-left ${selected ? "package-choice--selected" : ""}`}><span className="package-choice-surface block rounded-[0.7rem] p-2.5"><span className="flex items-start justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><span className={`package-badge ${badge ? `package-badge--${badge.tone}` : "package-badge--gold"}`}>{badge?.label ?? (mobileLegends ? "MLBB · GOLD" : "TOP-UP")}</span></span>{selected ? <SelectedPackageCheck size={19} className="package-choice-check" /> : <Gem className="package-gem h-3.5 w-3.5 text-amber-600" />}</span>{mobileLegends ? <span className="mobile-legends-diamond-art mt-1.5 block"><img src={goldDiamondChestArtworkUrl} alt="Mobile Legends diamond chest" className="mobile-legends-diamond-art__image" loading="eager" fetchPriority="high" decoding="async" /><span className="mobile-legends-diamond-art__amount">{diamondLabel}</span></span> : <span className="public-package-art mt-2 flex items-center gap-2 rounded-xl px-2 py-1.5"><ProviderGameArtwork name={gameName} logoUrl={gameLogoUrl} priority className="public-package-art__logo h-10 w-10 rounded-lg" iconClassName="h-5 w-5" /><span className="min-w-0 truncate text-[11px] font-extrabold text-white">{item.amountLabel}</span></span>}<OverflowMarquee text={item.label} className={`${mobileLegends ? "mt-1" : "mt-2"} text-xs font-extrabold leading-4 text-slate-950`} /><OverflowMarquee text={mobileLegends ? "🇰🇭 Cambodia · Global" : `🇰🇭 Cambodia · ${item.amountLabel}`} className="mt-0.5 text-[10px] font-medium text-slate-500" /><span className="mt-1.5 block text-sm font-extrabold text-amber-800">{item.priceLabel}</span></span></button></article>;
}

function PackageSection({ title, description, icon: Icon, items, selectedPackageId, onSelect, gameId, gameName, gameLogoUrl, event }: { title: string; description?: string | null; icon: typeof Gem; items: ProviderPackage[]; selectedPackageId: string; onSelect: (id: string) => void; gameId: string; gameName: string; gameLogoUrl?: string; event?: boolean }) {
  if (!items.length) return null;
  return <section className={event ? "package-event-group rounded-2xl p-3" : ""}><div className="flex items-center gap-2"><span className={event ? "package-event-title-icon" : "diamond-title-icon"}><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-xs font-extrabold text-slate-950">{title}</p>{description ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p> : null}</div></div><div className={items.length === 1 ? "mx-auto mt-2 grid w-full max-w-[11.5rem] grid-cols-1 gap-2" : "mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3"}>{items.map((item) => <PackageCard key={item.id} item={item} selected={selectedPackageId === item.id} onSelect={() => onSelect(item.id)} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} />)}</div></section>;
}

function DiamondPackages({ packages, status, selectedPackageId, onSelect, gameId, gameName, gameLogoUrl }: { packages: ProviderPackage[]; status?: "ready" | "unavailable" | "error" | "verification_required"; selectedPackageId: string; onSelect: (id: string) => void; gameId: string; gameName: string; gameLogoUrl?: string }) {
  const eventContent = trpc.content.active.useQuery();
  const fullTicketEvent = (eventContent.data ?? []).find((item) => item.contentKey === "topup-event-full-ticket");
  const fullTicketPackages = fullTicketEvent ? sortProviderPackagesByPrice(packages.filter(isFullTicketPackage)) : [];
  const groupedPackages = groupProviderPackagesByMeaning(fullTicketPackages.length ? packages.filter((item) => !isFullTicketPackage(item)) : packages);
  const isMobileLegendsGlobal = isMobileLegendsGlobalGame(gameId);
  const standardTitle = isMobileLegendsGlobal ? "កញ្ចប់ពេជ្យ" : "កញ្ចប់ធម្មតា";
  const passTitle = isMobileLegendsGlobal ? "Weekly Pass និង Membership" : "Pass និង Membership";

  return <div className="mt-4 border-t border-slate-100 pt-4">{status === "ready" && packages.length ? <div className="space-y-4"><PackageSection title={fullTicketEvent?.titleKh?.trim() || "កញ្ចប់ Full Ticket"} description={fullTicketEvent?.bodyKh} icon={Ticket} items={fullTicketPackages} selectedPackageId={selectedPackageId} onSelect={onSelect} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} event /><PackageSection title={standardTitle} icon={Gem} items={groupedPackages.standard} selectedPackageId={selectedPackageId} onSelect={onSelect} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} /><PackageSection title="កញ្ចប់ Bonus និង First Top-Up" icon={Gem} items={groupedPackages.bonus} selectedPackageId={selectedPackageId} onSelect={onSelect} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} /><PackageSection title={passTitle} icon={Ticket} items={groupedPackages.passes} selectedPackageId={selectedPackageId} onSelect={onSelect} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} /><PackageSection title="កញ្ចប់ពិសេស" icon={WalletCards} items={groupedPackages.special} selectedPackageId={selectedPackageId} onSelect={onSelect} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} /></div> : <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">មិនអាចបង្ហាញកញ្ចប់សេវាសម្រាប់ពេលនេះទេ។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។</div>}</div>;
}
