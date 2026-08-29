import StorefrontLayout from "@/components/StorefrontLayout";
import { AnimatedGlyph } from "@/components/AnimatedGlyph";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { ProviderGameArtwork } from "@/components/ProviderGameIdentity";
import { PaymentMethodPreselect } from "@/components/PaymentMethodGate";
import { VerifiedAccountBar } from "@/components/VerifiedAccountBar";
import { OverflowMarquee } from "@/components/OverflowMarquee";
import { useSelectedProduct } from "@/contexts/SelectedProductContext";
import { useStorefrontHeader } from "@/contexts/StorefrontHeaderContext";
import { useAuth } from "@/_core/hooks/useAuth";
import { SelectedPackageCheck } from "@/components/SelectedPackageCheck";
import { countryFlagForRegion, providerPackageBadge } from "@/lib/providerPresentation";
import { buildPackageCategories, categoryLabelForPackage, filterPackagesByCategory, type PackageCategory } from "@/lib/packageCategories";
import { goldDiamondChestArtworkUrl, isMobileLegendsGlobalGame, mobileLegendsDiamondLabel, mobileLegendsPackageTone } from "@/lib/mobileLegendsAssets";
import { isPubgTopupGame, pubgUcArtworkForAmount, pubgUcDisplayAmount, pubgUcFallbackArtwork } from "@/lib/pubgUcAssets";
import { suppliedProductArtworkForPackage } from "@/lib/suppliedProductArtwork";
import { generatedPackageArtworkForPackage, type GeneratedPackageArtworkKind } from "@/lib/generatedPackageArtwork";
import { providerGameImageKey, resolvedGameArtworkFor } from "@/lib/originalGameArtwork";
import { toWebsiteMediaUrl } from "@/lib/mediaUrl";
import { trpc } from "@/lib/trpc";
import { subscribeToPackageArtworkChanges } from "@/lib/packageArtworkBroadcast";
import { subscribeToPublicAssetChanges } from "@/lib/publicAssetBroadcast";
import { ArrowLeft, BadgePercent, Box, CalendarClock, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Crown, Eye, Gem, Gift, History, Search, ShieldAlert, Sparkles, TrendingUp, UserRound, WalletCards } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";

type SavedPlayerEntry = { id: string; fields: Record<string, string>; savedAt: number };

const localCategoryPreviewGame = { id: "category-preview", name: "ZURS Package Preview", region: "Global", logoUrl: undefined as string | undefined, requiredFields: [] as GameField[] };
const localCategoryPreviewPackages: ProviderPackage[] = [
  { id: "preview-token-1", label: "86 Diamonds", amountLabel: "86 Diamonds", priceLabel: "$1.10" },
  { id: "preview-token-2", label: "172 Diamonds", amountLabel: "172 Diamonds", priceLabel: "$2.10" },
  { id: "preview-weekly", label: "Weekly Membership", amountLabel: "Weekly Membership", priceLabel: "$2.99" },
  { id: "preview-super", label: "60 UC + 5 UC", amountLabel: "65 UC", priceLabel: "$0.80" },
  { id: "preview-special", label: "Promo Crate", amountLabel: "1 Crate", priceLabel: "$1.10" },
  { id: "preview-special-2", label: "Special Event Pack", amountLabel: "Event Pack", priceLabel: "$4.90" },
];
const PackageArtworkOverridesContext = createContext<Record<string, string>>({});
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
  const utils = trpc.useUtils();
  const gameId = gameIdFromTopupPath(location);
  const localCategoryPreview = import.meta.env.DEV && typeof window !== "undefined" && new URLSearchParams(window.location.search).get("categoryPreview") === "1";
  const gameInput = useMemo(() => ({ gameId }), [gameId]);
  const gameQuery = trpc.provider.gameDetails.useQuery(gameInput, { enabled: Boolean(gameId) });
  const gameImages = trpc.provider.gameImages.useQuery(undefined, { staleTime: 0, refetchInterval: 5_000 });
  const paymentReadiness = trpc.payments.readiness.useQuery();
  const { user } = useAuth();
  const { setPlayerTitle } = useStorefrontHeader();
  const isOwnerAdmin = user?.role === "admin" || user?.email?.trim().toLowerCase() === "chanmakara672@gmail.com";
  const providerPackages = trpc.provider.packages.useMutation();
  const validatePlayerId = trpc.provider.validatePlayerId.useMutation();
  const [details, setDetails] = useState<Record<string, string>>({});
  const [showPackages, setShowPackages] = useState(false);
  const [adminPreviewEnabled, setAdminPreviewEnabled] = useState(false);
  const [selectedPackageId, setSelectedPackageIdState] = useState("");
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayerEntry[]>([]);
  const [autofillVersion, setAutofillVersion] = useState(0);
  const [idAccuracyConfirmed, setIdAccuracyConfirmed] = useState(false);
  useEffect(() => subscribeToPublicAssetChanges((area) => { if (area === "game-images") void utils.provider.gameImages.invalidate(); }), [utils]);
  useEffect(() => { if (localCategoryPreview) setShowPackages(true); }, [localCategoryPreview]);
  const [identityCollapsed, setIdentityCollapsed] = useState(false);
  const identityFormRef = useRef<HTMLFormElement>(null);
  const verifiedCardRef = useRef<HTMLElement>(null);
  const { setSelectedProduct, clearSelectedProduct, setSelectedPaymentMethodId } = useSelectedProduct();
  const game = gameQuery.data?.status === "ready" ? gameQuery.data.game : localCategoryPreview ? localCategoryPreviewGame : null;
  const gameImageOverride = (gameImages.data ?? []).find((item) => item.gameId === providerGameImageKey(game?.id ?? gameId, game?.name ?? ""));
  const gameArtwork = resolvedGameArtworkFor(game?.id ?? gameId, game?.name ?? "", gameImageOverride);
  const gameLogoUrl = gameImageOverride?.logoUrl ?? game?.logoUrl;
  const fieldsReady = Boolean(game && game.requiredFields.filter((field) => field.required).every((field) => details[field.key]?.trim()));
  const providerFields = useMemo(() => {
    if (!game || !fieldsReady) return null;
    return Object.fromEntries(game.requiredFields.filter((field) => field.required || Boolean(details[field.key]?.trim())).map((field) => [field.key, details[field.key]!.trim()]));
  }, [details, fieldsReady, game]);
  const checkoutAccount = checkoutAccountFields(providerFields);
  const requiresVerifiedPlayerName = requiresVerifiedUsername(game?.id ?? gameId);
  const identityRequired = requiresPlayerIdentityCheck(game?.requiredFields ?? []);
  const validationInput = useMemo(() => game && providerFields && identityRequired ? { gameId: game.id, fields: providerFields } : null, [game, identityRequired, providerFields]);
  const adminPreviewActive = isOwnerAdmin && adminPreviewEnabled;
  const identity = validatePlayerId.data;
  const identityVerified = identity?.status === "verified";
  const canBrowsePackages = canBrowseTopupPackages(fieldsReady, identity?.status, adminPreviewActive, identityRequired, idAccuracyConfirmed);
  const publicPackagePreview = trpc.provider.packagePreview.useQuery({ gameId }, { enabled: Boolean(gameId) && showPackages && !canBrowsePackages && !adminPreviewActive, staleTime: 60_000 });
  const adminPreview = trpc.admin.previewGamePackages.useQuery({ gameId }, { enabled: Boolean(gameId) && adminPreviewActive, staleTime: 60_000 });
  const customerPackages = showPackages && canBrowsePackages ? providerPackages.data?.packages ?? [] : publicPackagePreview.data?.packages ?? [];
  const packages = localCategoryPreview ? localCategoryPreviewPackages : adminPreviewActive ? adminPreview.data?.packages ?? [] : customerPackages;
  const packageStatus = localCategoryPreview ? "ready" : adminPreviewActive ? adminPreview.data?.status : (showPackages && canBrowsePackages ? providerPackages.data?.status : publicPackagePreview.data?.status);
  const country = countryFlagForRegion(identity?.status === "verified" ? identity.region : null);

  const setSelectedPackageId = (id: string) => {
    if (id === selectedPackageId) {
      setSelectedPackageIdState("");
      clearSelectedProduct();
      return;
    }
    setSelectedPackageIdState(id);
    const selected = packages.find((item) => item.id === id);
    const hasRequiredVerifiedName = !requiresVerifiedPlayerName || Boolean(identityVerified && identity?.playerName);
    if (selected && !adminPreviewActive && canBrowsePackages && hasRequiredVerifiedName) setSelectedProduct({ ...selected, gameName: game?.name ?? "", gameLogoUrl, playerId: checkoutAccount.playerId ?? undefined, zoneId: checkoutAccount.zoneId, playerName: identity?.playerName ?? undefined, requiresVerifiedPlayerName });
    else clearSelectedProduct();
  };

  useEffect(() => {
    if (!validationInput) return;
    const timer = window.setTimeout(() => validatePlayerId.mutate(validationInput), 650);
    return () => window.clearTimeout(timer);
  }, [validationInput]);

  // Keep the selected package while navigating to /checkout/preview. Clearing it
  // during this route's unmount made the payment preview lose its order context.
  useEffect(() => () => { setPlayerTitle(null); }, [setPlayerTitle]);

  useEffect(() => {
    if (!identityVerified) {
      setIdentityCollapsed(false);
      setPlayerTitle(null);
      return;
    }
    setIdentityCollapsed(true);
  }, [identityVerified, setPlayerTitle]);

  useEffect(() => {
    const target = verifiedCardRef.current;
    if (!target || !identityVerified || !identityCollapsed || !identity?.playerName) {
      setPlayerTitle(null);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setPlayerTitle(entry?.isIntersecting ? null : identity.playerName);
    }, { threshold: 0.2 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [identity?.playerName, identityCollapsed, identityVerified, setPlayerTitle]);

  useEffect(() => {
    setSavedPlayers(game ? readVerifiedPlayerEntries(game.id) : []);
  }, [game?.id]);

  useEffect(() => {
    setSelectedPackageIdState("");
    clearSelectedProduct();
    setSelectedPaymentMethodId(null);
  }, [gameId]);

  useEffect(() => {
    if (!game || identity?.status !== "verified" || !providerFields) return;
    setSavedPlayers(saveVerifiedPlayerEntry(game.id, providerFields));
  }, [game?.id, identity?.status, providerFields]);

  const updateDetail = (key: string, value: string) => {
    setIdentityCollapsed(false);
    setDetails((current) => ({ ...current, [key]: value }));
    validatePlayerId.reset();
    setShowPackages(false);
    setSelectedPackageIdState("");
    clearSelectedProduct();
    setSelectedPaymentMethodId(null);
    setIdAccuracyConfirmed(false);
  };

  const chooseSavedPlayer = (entry: SavedPlayerEntry) => {
    setIdentityCollapsed(false);
    setDetails(entry.fields);
    validatePlayerId.reset();
    setShowPackages(false);
    setSelectedPackageIdState("");
    clearSelectedProduct();
    setSelectedPaymentMethodId(null);
    setIdAccuracyConfirmed(false);
    setAutofillVersion((current) => current + 1);
  };

  const editIdentity = () => {
    setIdentityCollapsed(false);
    setShowPackages(false);
    setSelectedPackageIdState("");
    clearSelectedProduct();
    setSelectedPaymentMethodId(null);
    setIdAccuracyConfirmed(false);
    validatePlayerId.reset();
    window.setTimeout(() => {
      const firstInput = identityFormRef.current?.querySelector<HTMLInputElement>("input[required], input");
      firstInput?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      firstInput?.focus();
    }, 0);
  };

  const loadPackages = () => {
    if (!game) return;
    setShowPackages(true);
    if (!adminPreviewActive && canBrowsePackages) providerPackages.mutate({ gameId: game.id, fields: providerFields ?? {}, idAccuracyConfirmed });
  };

  return <StorefrontLayout><main className="container game-topup-container py-5 sm:py-9"><LoadingOverlay open={gameQuery.isLoading || providerPackages.isPending || adminPreview.isLoading || (showPackages && publicPackagePreview.isLoading)} label={providerPackages.isPending || adminPreview.isLoading || publicPackagePreview.isLoading ? "កំពុងរៀបចំកញ្ចប់សេវា…" : "កំពុងរៀបចំព័ត៌មានហ្គេម…"} /><Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:text-indigo-700"><ArrowLeft className="motion-icon h-4 w-4" />ត្រឡប់ទៅជ្រើសហ្គេម</Link>{gameQuery.isLoading ? <section className="mt-4 grid min-h-80 place-items-center rounded-[1.5rem] bg-white/80"><div className="text-center text-xs text-slate-500"><OutlineLoader size={32} color="#4f46e5" /><p className="mt-3">កំពុងរៀបចំព័ត៌មានហ្គេម…</p></div></section> : game ? <section className="mt-4 space-y-4"><aside className="game-detail-hero premium-shine relative min-h-[17rem] overflow-hidden rounded-[1.5rem] bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/20 sm:min-h-[18.5rem] sm:p-7" style={{ "--hero-accent": gameArtwork?.accent ?? "#46d8ff" } as React.CSSProperties}>{gameArtwork ? <img src={gameArtwork.src} alt="" className="game-detail-hero__art" style={{ objectPosition: gameArtwork.position ?? "center right" }} loading="eager" fetchPriority="high" decoding="async" /> : null}<div className="game-detail-hero__scrim" aria-hidden="true" /><div aria-hidden="true" className="diamond-decor diamond-decor--one"><Gem /></div><div aria-hidden="true" className="diamond-decor diamond-decor--two"><Gem /></div><div className="relative z-10 flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-center sm:gap-5"><ProviderGameArtwork name={game.name} region={game.region} logoUrl={gameLogoUrl} priority className="h-24 w-24 rounded-[1.35rem] sm:h-28 sm:w-28" iconClassName="h-9 w-9" /><div className="min-w-0"><p className="game-detail-hero__eyebrow">OFFICIAL GAME TOP-UP</p><h1 className="game-detail-hero__title mt-1.5">{game.name}</h1><p className="mt-2.5 max-w-xl text-xs leading-6 text-slate-100/90 sm:text-sm">បំពេញព័ត៌មានគណនីរបស់អ្នកឲ្យត្រឹមត្រូវ ដើម្បីជ្រើសកញ្ចប់ និងតម្លៃសម្រាប់ហ្គេមនេះ។</p><div className="game-detail-hero__account-chip mt-4"><UserRound className="h-4 w-4" />{identityVerified && identityCollapsed ? "គណនីបានបញ្ជាក់" : `${game.requiredFields.length || "0"} ព័ត៌មានគណនីត្រូវបំពេញ`}</div></div></div></aside><section className="surface rounded-[1.5rem] p-4 sm:p-5"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">GAME TOP-UP</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">បំពេញព័ត៌មាន {game.name}</h2>{!paymentReadiness.isLoading && !paymentReadiness.data?.ready ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p>អ្នកអាចពិនិត្យកញ្ចប់ និងតម្លៃបាន។ ប៊ូតុងទិញត្រូវបានបិទជាបណ្តោះអាសន្ន ខណៈហាងកំពុងពិនិត្យសុវត្ថិភាពការទូទាត់។</p></div> : null}<SavedPlayerPicker entries={savedPlayers} fields={game.requiredFields} onChoose={chooseSavedPlayer} />{identityVerified ? <VerifiedAccountBar anchorRef={verifiedCardRef} collapsed={identityCollapsed} playerName={identity.playerName} fields={providerFields ?? {}} onEdit={editIdentity} /> : null}<form ref={identityFormRef} onSubmit={(event) => { event.preventDefault(); loadPackages(); }} className={`mt-4 identity-flow ${identityCollapsed ? "identity-flow--collapsed" : ""}`}>{game.requiredFields.length ? <div className="identity-fields grid gap-3 sm:grid-cols-2">{game.requiredFields.map((field) => <label key={field.key} className="block"><span className="mb-1.5 block text-xs font-semibold text-slate-700">{field.label}{field.required ? <span className="ml-1 text-indigo-600">*</span> : null}</span><input key={`${field.key}-${autofillVersion}`} required={field.required} type={field.kind} value={details[field.key] ?? ""} onChange={(event) => updateDetail(field.key, event.target.value)} placeholder={field.placeholder ?? field.label} className={`h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white ${autofillVersion ? "saved-id-autofill" : ""}`} /></label>)}</div> : <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">ហ្គេមនេះមិនទាមទារព័ត៌មានគណនីបន្ថែមទេ។ សូមបន្តពិនិត្យកញ្ចប់សេវា។</div>}<div className="identity-validation-state">{validationInput ? <IdentityStatus identity={identity} pending={validatePlayerId.isPending} country={country} idAccuracyConfirmed={idAccuracyConfirmed} onIdAccuracyConfirmedChange={setIdAccuracyConfirmed} fields={providerFields ?? {}} /> : <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600">សូមបំពេញព័ត៌មានដែលត្រូវការ។ ប្រព័ន្ធនឹងពិនិត្យឈ្មោះគណនីដោយស្វ័យប្រវត្តិ នៅពេលហ្គេមគាំទ្រ។</div>}</div><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={loadPackages} disabled={providerPackages.isPending || adminPreview.isLoading || publicPackagePreview.isLoading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{providerPackages.isPending || adminPreview.isLoading || publicPackagePreview.isLoading ? <OutlineLoader size={19} color="#ffffff" /> : <Eye className="h-4 w-4" />}{adminPreviewActive ? "ផ្ទុក Admin UI" : "មើលកញ្ចប់ និងតម្លៃ"}<ChevronRight className="h-4 w-4" /></button>{isOwnerAdmin ? <button type="button" onClick={() => { setAdminPreviewEnabled((current) => !current); setShowPackages(true); setSelectedPackageIdState(""); clearSelectedProduct(); setSelectedPaymentMethodId(null); }} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-extrabold transition ${adminPreviewActive ? "border-amber-300 bg-amber-50 text-amber-900" : "border-indigo-200 bg-indigo-50 text-indigo-800 hover:border-indigo-300 hover:bg-indigo-100"}`}><Eye className="h-4 w-4" />{adminPreviewActive ? "បិទ Admin Preview" : "មើល UI ជា Admin"}</button> : null}</div></form>{adminPreviewActive ? <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950"><strong>Admin Preview</strong>៖ អ្នកកំពុងមើល package UI ដោយមិនបញ្ចូល Player ID។ Preview នេះមិនអនុញ្ញាតឱ្យជ្រើសទិញ ឬបង្កើត order ទេ។</div> : null}{showPackages ? <>{canBrowsePackages && !adminPreviewActive ? <PaymentMethodPreselect /> : null}<PackagePreviewNotice verified={canBrowsePackages} adminPreview={adminPreviewActive} /><DiamondPackages packages={packages} status={packageStatus} selectedPackageId={selectedPackageId} onSelect={setSelectedPackageId} gameId={game.id} gameName={game.name} gameLogoUrl={gameLogoUrl} /></> : null}</section></section> : <section className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-white/75 p-8 text-center"><p className="font-display text-xl font-bold text-slate-900">មិនអាចរកឃើញហ្គេមនេះទេ</p><p className="mt-2 text-sm text-slate-500">សូមត្រឡប់ទៅទំព័រដើម ហើយជ្រើសហ្គេមពីបញ្ជីរបស់យើង។</p><Link href="/" className="mt-5 inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white">ត្រឡប់ទៅជ្រើសហ្គេម</Link></section>}</main></StorefrontLayout>;
}

function SavedPlayerPicker({ entries, fields, onChoose }: { entries: SavedPlayerEntry[]; fields: GameField[]; onChoose: (entry: SavedPlayerEntry) => void }) {
  const usableEntries = entries.filter((entry) => fields.filter((field) => field.required).every((field) => Boolean(entry.fields[field.key])));
  if (!usableEntries.length) return null;
  return <section className="saved-player-picker mt-4 rounded-xl p-3"><div className="flex items-start gap-2"><span className="saved-player-picker-icon"><History className="h-4 w-4" /></span><div className="min-w-0"><p className="text-xs font-extrabold text-slate-900">ID ដែលបានបញ្ជាក់ពីមុន</p><p className="mt-0.5 text-[10px] leading-4 text-slate-600">ជ្រើសមួយ ដើម្បីបំពេញព័ត៌មានដោយស្វ័យប្រវត្តិលើឧបករណ៍នេះ។ មិនរក្សាទុកឈ្មោះគណនីឡើយ។</p></div></div><div className="mt-2 flex flex-wrap gap-2">{usableEntries.map((entry) => <button key={entry.id} type="button" onClick={() => onChoose(entry)} className="saved-player-choice">{savedPlayerLabel(entry.fields)}</button>)}</div>{usableEntries.length >= 2 ? <p className="mt-3 rounded-lg border border-cyan-100 bg-cyan-50/80 p-2.5 text-[10px] font-semibold leading-5 text-cyan-950">អ្នកមាន ID គណនីច្រើនជាងមួយនៅលើឧបករណ៍នេះ។ សូមជ្រើស ID តែមួយដែលត្រូវការទិញកញ្ចប់ ហើយពិនិត្យឈ្មោះគណនីម្តងទៀត មុនបន្ត។</p> : null}</section>;
}

function checkoutAccountFields(fields: Record<string, string> | null) {
  const entries = Object.entries(fields ?? {});
  const playerId = entries.find(([key]) => /(?:player|user|account|game|uid).*id|id.*(?:player|user|account|game|uid)/i.test(key))?.[1] ?? null;
  const zoneId = entries.find(([key]) => /(?:zone|server|region).*id|id.*(?:zone|server|region)|^(?:zone|server|region)$/i.test(key))?.[1] ?? null;
  return { playerId, zoneId };
}

export function canBrowseVerifiedPackages(fieldsReady: boolean, status?: string) {
  return fieldsReady && status === "verified";
}

export function requiresVerifiedUsername(gameId: string) {
  return /^(?:mobile_legends|free_fire|pubg_mobile|blood_strike|honor_of_kings|magic_chess)(?:_|$)/i.test(gameId.trim());
}

export function requiresPlayerIdentityCheck(fields: GameField[]) {
  return fields.some((field) => /(?:player|user|account|game|zone|server|uid).*\bid\b|\bid\b.*(?:player|user|account|game|zone|server)|(?:^|[_\s-])(?:player|user|account|zone|server|uid)(?:[_\s-]|$)/i.test(`${field.key} ${field.label}`));
}

export function canBrowseTopupPackages(fieldsReady: boolean, status: string | undefined, adminPreviewActive: boolean, identityRequired = true, idAccuracyConfirmed = false) {
  return adminPreviewActive || (identityRequired ? (canBrowseVerifiedPackages(fieldsReady, status) || (status === "not_supported" && idAccuracyConfirmed)) : fieldsReady);
}

function PackagePreviewNotice({ verified, adminPreview }: { verified: boolean; adminPreview: boolean }) {
  if (adminPreview) return null;
  return <div className={`package-preview-notice ${verified ? "package-preview-notice--verified" : ""}`}><span className="package-preview-notice__icon"><Eye className="h-4 w-4" /></span><p><strong>{verified ? "កញ្ចប់បានត្រៀមរួច" : "មើលកញ្ចប់បានដោយមិនបញ្ចូល ID"}</strong><span>{verified ? "អ្នកអាចជ្រើសកញ្ចប់បាន។ ស្ថានភាពទិញនៅតែអាស្រ័យលើការកំណត់សុវត្ថិភាពរបស់ហាង។" : "សម្រាប់ពិនិត្យតម្លៃ និងកញ្ចប់ជាមុន។ សូមបំពេញ និងបញ្ជាក់ Player ID មុនពេលបន្តប្រតិបត្តិការ។"}</span></p></div>;
}

function IdentityStatus({ identity, pending, country, idAccuracyConfirmed, onIdAccuracyConfirmedChange, fields = {} }: { identity: ReturnType<typeof trpc.provider.validatePlayerId.useMutation>["data"]; pending: boolean; country: ReturnType<typeof countryFlagForRegion>; idAccuracyConfirmed: boolean; onIdAccuracyConfirmedChange: (confirmed: boolean) => void; fields?: Record<string, string> }) {
  if (pending) return <div className="mt-4 flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/75 p-3 text-xs font-semibold text-indigo-800"><OutlineLoader size={18} color="#4f46e5" />កំពុងពិនិត្យឈ្មោះគណនី…</div>;
  if (identity?.status === "verified") return null;
  if (identity?.status === "invalid") return <div className="mt-4 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-3"><CircleAlert className="h-5 w-5 shrink-0 text-rose-600" /><p className="text-xs leading-5 text-rose-900">មិនអាចបញ្ជាក់គណនីនេះបានទេ។ សូមពិនិត្យ Player ID និង Server ID ម្តងទៀត។</p></div>;
  if (identity?.status === "not_supported") return <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3"><div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><p className="text-xs leading-5 text-amber-950">ហ្គេមនេះមិនទាន់មានសេវាពិនិត្យឈ្មោះគណនីទេ។ សូមពិនិត្យ Player ID និង Server ID ឲ្យត្រឹមត្រូវ ព្រោះការបញ្ចូលព័ត៌មានខុសអាចមិនអាចកែប្រែបាន។</p></div><label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg bg-white/75 p-2.5 text-xs font-semibold leading-5 text-amber-950"><input type="checkbox" checked={idAccuracyConfirmed} onChange={(event) => onIdAccuracyConfirmedChange(event.target.checked)} className="mt-1 h-4 w-4 rounded border-amber-400 text-amber-700 focus:ring-amber-500" /><span>ខ្ញុំបានពិនិត្យព័ត៌មានគណនីរួចរាល់ ហើយយល់ព្រមបន្តមើលកញ្ចប់សម្រាប់ហ្គេមនេះ។</span></label></div>;
  if (identity?.status === "unavailable" || identity?.status === "error") return <div className="mt-4 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 p-3"><ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" /><p className="text-xs leading-5 text-amber-900">មិនអាចពិនិត្យ Username ពេលនេះទេ។ កញ្ចប់ និងប៊ូតុងបន្តត្រូវបានចាក់សោរ—សូមព្យាយាមម្ដងទៀតបន្តិចក្រោយ។</p></div>;
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

export const initialDiamondPackageLimit = 10;

export function visibleDiamondPackageItems<T>(items: T[], expanded: boolean) {
  return expanded ? items : items.slice(0, initialDiamondPackageLimit);
}

export function recommendedProviderPackage<T extends ProviderPackage>(items: T[]) {
  const sorted = sortProviderPackagesByPrice(items);
  return sorted.find((item) => /recommended|popular|best\s*value/i.test(`${item.label} ${item.amountLabel}`)) ?? sorted[Math.floor((sorted.length - 1) / 2)] ?? null;
}

function isFullTicketPackage(item: ProviderPackage) {
  return /\bfull\s*ticket\b/i.test(`${item.label} ${item.amountLabel}`);
}

const bloodStrikeArtworkByPackage = {
  seasonPass: "/manus-storage/zurs-bloodstrike-season-pass-art_401099ae.png",
  levelUp: "/manus-storage/zurs-bloodstrike-level-up-art_7c8e8592.png",
  elitePass: "/manus-storage/zurs-bloodstrike-elite-pass-art_5114b26b.png",
  premiumPass: "/manus-storage/zurs-bloodstrike-premium-pass-art_b708bf33.png",
} as const;

export function gameThemedArtworkForPackage(gameId: string, label: string, amountLabel: string) {
  if (!/blood[\s_-]*strike/i.test(gameId)) return null;
  const packageCopy = `${label} ${amountLabel}`.toLowerCase();
  if (/\bpremium\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.premiumPass;
  if (/\belite\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.elitePass;
  if (/\blevel\s*up\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.levelUp;
  if (/\bseason\s*pass\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.seasonPass;
  if (/\b(?:deal|sale|discount)\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.seasonPass;
  if (/\b(?:bc|currency)\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.levelUp;
  if (/\b(?:lucky|bag|chest|crate)\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.elitePass;
  if (/\b(?:pre[\s-]?order|promo|special|cornucopia|event)\b/.test(packageCopy)) return bloodStrikeArtworkByPackage.premiumPass;
  return null;
}

function GeneratedPackageArtworkVisual({ kind, artworkUrl, amount, gameId, gameName, gameLogoUrl, label }: { kind: GeneratedPackageArtworkKind; artworkUrl: string; amount: string; gameId: string; gameName: string; gameLogoUrl?: string; label: string }) {
  const themedArtwork = gameThemedArtworkForPackage(gameId, label, amount);
  return <span className={`generated-package-art generated-package-art--${kind} mt-1.5 block`}><img src={themedArtwork ?? artworkUrl} alt="" className="generated-package-art__scene" loading="eager" fetchPriority="high" decoding="async" draggable={false} /><ProviderGameArtwork name={gameName} logoUrl={gameLogoUrl} priority showCountryFlag={false} className="generated-package-art__logo h-8 w-8 rounded-full" iconClassName="h-4 w-4" /><span className="generated-package-art__amount">{amount}</span></span>;
}

const legacyMobileLegendsArtworkIconByKind: Record<GeneratedPackageArtworkKind, typeof Gem> = {
  diamonds: Gem,
  pass: Crown,
  "level-up": TrendingUp,
  special: Sparkles,
  deal: BadgePercent,
  bc: Box,
  "lucky-bag": Gift,
  preorder: CalendarClock,
};

export function usesLegacyMobileLegendsArtwork(gameId: string, hasSuppliedArtwork: boolean) {
  return isMobileLegendsGlobalGame(gameId) && !hasSuppliedArtwork;
}

export function usesMobileLegendsDiamondChestArtwork(gameId: string, label: string, amountLabel: string, hasSuppliedArtwork = false) {
  return isMobileLegendsGlobalGame(gameId) && !hasSuppliedArtwork && isCurrencyPackage({ id: "", label, amountLabel, priceLabel: "" });
}

function LegacyMobileLegendsArtworkVisual({ kind, amount, gameName, gameLogoUrl }: { kind: GeneratedPackageArtworkKind; amount: string; gameName: string; gameLogoUrl?: string }) {
  const Icon = legacyMobileLegendsArtworkIconByKind[kind];
  return <span className={`generated-package-art generated-package-art--${kind} mt-1.5 block`}><span aria-hidden="true" className="generated-package-art__flare" /><span aria-hidden="true" className="generated-package-art__symbol"><Icon className="h-7 w-7" strokeWidth={1.7} /></span><ProviderGameArtwork name={gameName} logoUrl={gameLogoUrl} priority showCountryFlag={false} className="generated-package-art__logo h-8 w-8 rounded-full" iconClassName="h-4 w-4" /><span className="generated-package-art__amount">{amount}</span></span>;
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

function isCurrencyPackage(item: ProviderPackage) {
  return !isPassPackage(item) && !isSpecialPackage(item) && !isFullTicketPackage(item);
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

export function partitionProviderPackagesForFullTicketEvent<T extends ProviderPackage>(items: T[], eventIsActive: boolean) {
  const eventPackages = sortProviderPackagesByPrice(items.filter(isFullTicketPackage));
  return {
    eventPackages: eventIsActive ? eventPackages : [],
    storefrontPackages: eventIsActive ? items.filter((item) => !isFullTicketPackage(item)) : items.filter((item) => !isFullTicketPackage(item)),
  };
}

function PackageCard({ item, selected, onSelect, gameId, gameName, gameLogoUrl }: { item: ProviderPackage; selected: boolean; onSelect: () => void; gameId: string; gameName: string; gameLogoUrl?: string }) {
  const artworkOverrides = useContext(PackageArtworkOverridesContext);
  const badge = providerPackageBadge(item.label);
  const mobileLegends = isMobileLegendsGlobalGame(gameId);
  const pubg = isPubgTopupGame(gameId, gameName);
  const diamondLabel = mobileLegendsDiamondLabel(item.label, item.amountLabel);
  const mobileLegendsTone = mobileLegends ? mobileLegendsPackageTone(item.label, item.amountLabel) : null;
  const suppliedArtwork = artworkOverrides[item.id] ?? suppliedProductArtworkForPackage(gameId, item.amountLabel);
  const pubgArtwork = pubg ? pubgUcArtworkForAmount(item.amountLabel) : null;
  const generatedArtwork = generatedPackageArtworkForPackage(item.label, item.amountLabel);
  const packageAmount = mobileLegends ? diamondLabel : pubg ? pubgUcDisplayAmount(item.amountLabel) : item.amountLabel;
  const usesArtCard = Boolean(suppliedArtwork ?? pubgArtwork) || Boolean(generatedArtwork.kind);
  const legacyMobileLegendsArtwork = usesLegacyMobileLegendsArtwork(gameId, Boolean(suppliedArtwork));
  const mobileLegendsDiamondChestArtwork = usesMobileLegendsDiamondChestArtwork(gameId, item.label, item.amountLabel, Boolean(suppliedArtwork));
  return <article className="min-w-0"><button type="button" aria-pressed={selected} onClick={onSelect} className={`package-choice package-choice--clean package-choice--gold ${mobileLegendsTone ? `package-choice--mlbb-${mobileLegendsTone}` : ""} w-full text-left ${selected ? "package-choice--selected" : ""}`}><span className="package-choice-surface block rounded-[0.7rem] p-2.5"><span className="flex items-start justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5"><span className={`package-badge ${badge ? `package-badge--${badge.tone}` : "package-badge--gold"}`}>{badge?.label ?? (mobileLegends ? "MLBB · GOLD" : pubg ? "PUBG UC" : "TOP-UP")}</span></span>{selected ? <SelectedPackageCheck size={19} className="package-choice-check" /> : <span className="package-artwork-dot" aria-hidden="true" />}</span>{mobileLegendsDiamondChestArtwork ? <span className="mobile-legends-diamond-art mt-1.5 block"><img src={goldDiamondChestArtworkUrl} alt="Mobile Legends diamond chest" className="mobile-legends-diamond-art__image" loading="eager" fetchPriority="high" decoding="async" draggable={false} /><ProviderGameArtwork name={gameName} logoUrl={gameLogoUrl} priority showCountryFlag={false} className="mobile-legends-diamond-art__logo h-8 w-8 rounded-full" iconClassName="h-4 w-4" /><span className="mobile-legends-diamond-art__amount">{diamondLabel}</span></span> : suppliedArtwork ? <span className={`supplied-package-art ${mobileLegendsTone ? `supplied-package-art--mlbb-${mobileLegendsTone}` : ""} mt-1.5 block`}><img src={suppliedArtwork} alt={`${gameName} ${item.amountLabel}`} className="supplied-package-art__image" loading="eager" fetchPriority="high" decoding="async" draggable={false} />{mobileLegends ? <ProviderGameArtwork name={gameName} logoUrl={gameLogoUrl} priority showCountryFlag={false} className="supplied-package-art__logo h-8 w-8 rounded-full" iconClassName="h-4 w-4" /> : null}</span> : pubgArtwork ? <span className="pubg-uc-art mt-1.5 block"><img src={pubgArtwork} alt={`${gameName} ${item.amountLabel}`} className="pubg-uc-art__image" loading="eager" fetchPriority="high" decoding="async" draggable={false} /><span className="pubg-uc-art__amount">{packageAmount}</span></span> : legacyMobileLegendsArtwork ? <LegacyMobileLegendsArtworkVisual kind={generatedArtwork.kind} amount={packageAmount} gameName={gameName} gameLogoUrl={gameLogoUrl} /> : <GeneratedPackageArtworkVisual kind={generatedArtwork.kind} artworkUrl={generatedArtwork.url} amount={packageAmount} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} label={item.label} />}<OverflowMarquee text={item.label} className={`${usesArtCard ? "mt-1" : "mt-2"} text-xs font-extrabold leading-4 text-slate-950`} /><OverflowMarquee text={mobileLegends ? "🇰🇭 Cambodia · Global" : `🇰🇭 Cambodia · ${item.amountLabel}`} className="mt-0.5 text-[10px] font-medium text-slate-500" /><span className="mt-1.5 block text-sm font-extrabold text-amber-800">{item.priceLabel}</span></span></button></article>;
}

function PackageSection({ title, description, icon: Icon, items, selectedPackageId, onSelect, gameId, gameName, gameLogoUrl, progressive = false }: { title: string; description?: string | null; icon: typeof Gem; items: ProviderPackage[]; selectedPackageId: string; onSelect: (id: string) => void; gameId: string; gameName: string; gameLogoUrl?: string; progressive?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (!items.length) return null;
  const visibleItems = progressive ? visibleDiamondPackageItems(items, expanded) : items;
  const hiddenCount = items.length - visibleItems.length;
  return <section className="package-section"><div className="package-section-header flex items-center gap-2"><span className="diamond-title-icon"><Icon className="h-3.5 w-3.5" /></span><div className="min-w-0"><p className="text-xs font-extrabold text-slate-950">{title}</p>{description ? <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{description}</p> : null}</div><span className="ml-auto shrink-0 rounded-full bg-white/75 px-2 py-0.5 text-[9px] font-bold text-slate-500">{items.length}</span></div><div className={visibleItems.length === 1 ? "mx-auto mt-3 grid w-full max-w-[11.5rem] grid-cols-1 gap-2" : "mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"}>{visibleItems.map((item) => <PackageCard key={item.id} item={item} selected={selectedPackageId === item.id} onSelect={() => onSelect(item.id)} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} />)}</div>{progressive && items.length > initialDiamondPackageLimit ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)} className="package-see-more mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-white/80 px-3 text-xs font-extrabold text-indigo-800 shadow-sm"><span>{expanded ? "បង្រួមកញ្ចប់" : `មើលបន្ថែម ${hiddenCount} កញ្ចប់`}</span><ChevronDown className={`package-see-more__icon h-4 w-4 ${expanded ? "package-see-more__icon--expanded" : ""}`} /></button> : null}</section>;
}

function artworkUrlWithRevision(mediaUrl: string, updatedAt: Date | string) {
  const revision = new Date(updatedAt).getTime();
  if (!Number.isFinite(revision)) return mediaUrl;
  return `${mediaUrl}${mediaUrl.includes("?") ? "&" : "?"}v=${revision}`;
}

function DiamondPackages({ packages, status, selectedPackageId, onSelect, gameId, gameName, gameLogoUrl }: { packages: ProviderPackage[]; status?: "ready" | "unavailable" | "error" | "verification_required"; selectedPackageId: string; onSelect: (id: string) => void; gameId: string; gameName: string; gameLogoUrl?: string }) {
  const eventContent = trpc.content.active.useQuery();
  const { data: packageArtworkData, refetch: refetchPackageArtwork } = trpc.provider.packageArtwork.useQuery({ gameId }, { enabled: Boolean(gameId), refetchInterval: 1_000, refetchIntervalInBackground: true, refetchOnWindowFocus: true, staleTime: 0 });
  const categoryAssignments = trpc.provider.packageCategories.useQuery({ gameId }, { enabled: Boolean(gameId), staleTime: 0 });
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [packageSearch, setPackageSearch] = useState("");
  const categoryTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const artworkOverrides = useMemo(() => Object.fromEntries((packageArtworkData ?? []).map((item) => [item.offerId, artworkUrlWithRevision(toWebsiteMediaUrl(item.mediaUrl), item.updatedAt)])), [packageArtworkData]);
  const categoryOverrides = useMemo(() => new Map((categoryAssignments.data ?? []).map((item) => [item.offerId, item.categoryLabel])), [categoryAssignments.data]);
  useEffect(() => subscribeToPackageArtworkChanges((changedGameId) => { if (changedGameId === gameId) void refetchPackageArtwork(); }), [gameId, refetchPackageArtwork]);
  const fullTicketEvent = (eventContent.data ?? []).find((item) => item.contentKey === "topup-event-full-ticket");
  const { eventPackages: fullTicketPackages, storefrontPackages } = partitionProviderPackagesForFullTicketEvent(packages, Boolean(fullTicketEvent));
  const gamePackages = useMemo(() => sortProviderPackagesByPrice([...storefrontPackages, ...fullTicketPackages]), [fullTicketPackages, storefrontPackages]);
  const categoryTabs = useMemo<PackageCategory[]>(() => buildPackageCategories(gamePackages, categoryOverrides), [categoryOverrides, gamePackages]);
  const searchValue = packageSearch.trim().toLocaleLowerCase();
  const visiblePackages = useMemo(() => searchValue ? gamePackages.filter((item) => (item.label + " " + item.amountLabel + " " + item.priceLabel).toLocaleLowerCase().includes(searchValue)) : filterPackagesByCategory(gamePackages, selectedCategoryId, categoryOverrides), [categoryOverrides, gamePackages, searchValue, selectedCategoryId]);

  useEffect(() => {
    if (selectedCategoryId !== "all" && !categoryTabs.some((category) => category.id === selectedCategoryId)) setSelectedCategoryId("all");
  }, [categoryTabs, selectedCategoryId]);

  useEffect(() => {
    const activeTab = categoryTabRefs.current[selectedCategoryId];
    if (!activeTab) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeTab.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
  }, [selectedCategoryId]);

  return (
    <PackageArtworkOverridesContext.Provider value={artworkOverrides}>
      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        {status === "ready" && packages.length ? <>
          <section className="package-category-browser" aria-labelledby="package-category-heading">
            <header className="package-category-browser__header">
              <span className="package-category-browser__gem"><Gem className="h-4 w-4" /></span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.18em] text-amber-300/80">GAME PACKAGES</p>
                <h2 id="package-category-heading" className="package-category-browser__title">ជ្រើសរើសកញ្ចប់</h2>
              </div>
              <span className="package-category-browser__total">{gamePackages.length}</span>
            </header>
            <nav className="package-category-tabs mt-4" aria-label="ប្រភេទកញ្ចប់">
              <button ref={(element) => { categoryTabRefs.current.all = element; }} type="button" onClick={() => setSelectedCategoryId("all")} aria-pressed={selectedCategoryId === "all"} className={`package-category-tab ${selectedCategoryId === "all" ? "package-category-tab--active" : ""}`}><span>ទាំងអស់</span><b>{gamePackages.length}</b></button>
              {categoryTabs.map((category) => <button key={category.id} ref={(element) => { categoryTabRefs.current[category.id] = element; }} type="button" onClick={() => setSelectedCategoryId(category.id)} aria-pressed={selectedCategoryId === category.id} className={`package-category-tab ${selectedCategoryId === category.id ? "package-category-tab--active" : ""}`}><span>{category.label}</span><b>{category.count}</b></button>)}
            </nav>
            <label className="package-category-search mt-3">
              <Search className="h-4 w-4" />
              <span className="sr-only">ស្វែងរកគ្រប់កញ្ចប់</span>
              <input value={packageSearch} onChange={(event) => setPackageSearch(event.target.value)} placeholder="ស្វែងរកគ្រប់កញ្ចប់…" />
            </label>
            <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-semibold text-slate-300">
              <span>{searchValue ? "លទ្ធផលស្វែងរកគ្រប់កញ្ចប់" : `ប្រភេទ៖ ${selectedCategoryId === "all" ? "ទាំងអស់" : categoryTabs.find((category) => category.id === selectedCategoryId)?.label ?? "ទាំងអស់"}`}</span>
              <span>{visiblePackages.length} កញ្ចប់</span>
            </div>
          </section>
          <div key={searchValue ? `search:${searchValue}` : selectedCategoryId} className="package-category-grid grid grid-cols-2 gap-2 sm:grid-cols-3">
            {visiblePackages.map((item) => <PackageCard key={item.id} item={item} selected={selectedPackageId === item.id} onSelect={() => onSelect(item.id)} gameId={gameId} gameName={gameName} gameLogoUrl={gameLogoUrl} />)}
          </div>
          {!visiblePackages.length ? <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">មិនមានកញ្ចប់ត្រូវនឹងការស្វែងរកនេះទេ។ សូមសាកល្បងពាក្យផ្សេង ឬជ្រើស «ទាំងអស់»។</div> : null}
        </> : <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">មិនអាចបង្ហាញកញ្ចប់សេវាសម្រាប់ពេលនេះទេ។ សូមព្យាយាមម្តងទៀតនៅពេលក្រោយ។</div>}
      </div>
    </PackageArtworkOverridesContext.Provider>
  );
}
