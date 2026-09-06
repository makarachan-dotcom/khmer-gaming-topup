import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AnimatedBackButton } from "@/components/AnimatedBackButton";
import { OutlineLoader } from "@/components/OutlineLoader";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  Calculator,
  CheckCircle2,
  CloudOff,
  Layers3,
  Percent,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Ticket,
  Trash2,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ownerEmail = "chanmakara672@gmail.com";

/** Quick profit presets so an admin can price a whole game with one tap. */
const marginPresets = ["2", "3", "4", "5", "6", "7"] as const;

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

type GameGroup = {
  id: string;
  titleKh?: string | null;
  titleEn?: string | null;
  isActive?: boolean;
  packages?: Offer[];
};

type AvailabilityItem = {
  id: string;
  name: string;
  category?: string;
  isActive: boolean;
};
type GameReadinessStatus =
  | "ready"
  | "needs_activation"
  | "needs_sync"
  | "hidden";
type GameReadiness = {
  providerId: string;
  label: string;
  inShop: boolean;
  authorizedCount: number;
  activeCount: number;
  inactiveAuthorizedOffers: Offer[];
  status: GameReadinessStatus;
};
type EventContent = {
  id: string;
  contentKey: string;
  titleKh?: string | null;
  bodyKh?: string | null;
  isActive: boolean;
};
type OfferValues = {
  basePriceUsd: string;
  profitMarginPercent: string;
  isActive: boolean;
};

function catalogAvailabilityErrorMessage(error: { message: string }) {
  if (/no synchronized fzr cards catalog/i.test(error.message))
    return "មិនអាចរក្សាទុកឥឡូវនេះបានទេ ព្រោះបញ្ជី FazerCards ដែលបាន Sync មិនទាន់អាចប្រើបាន។ សូម Sync ម្តងទៀត នៅពេល provider ភ្ជាប់វិញ។";
  if (/selected game is not available/i.test(error.message))
    return "ហ្គេមដែលជ្រើសមិនមាននៅក្នុងបញ្ជី FazerCards ដែលបាន Sync ទេ។ ការកំណត់ចាស់មិនត្រូវបានប្តូរ។";
  if (/availability control is not configured/i.test(error.message))
    return "មិនទាន់មាន persistent storage សម្រាប់ control នេះទេ។ ការកំណត់ចាស់មិនត្រូវបានប្តូរ។";
  if (/only provider-authorized offers/i.test(error.message))
    return "កញ្ចប់នេះមិនទាន់មាននៅក្នុង database ពិត (primary) នៅឡើយទេ។ បញ្ជីដែលអ្នកឃើញឥឡូវនេះមកពី storage បម្រុង។ សូមចុច «Sync catalog» ដើម្បីនាំកញ្ចប់ FazerCards ចូល database ពិតជាមុនសិន រួចទើបកំណត់ Margin ឬលក់បាន។";
  if (
    /provider catalog storage is unavailable|database unavailable/i.test(
      error.message
    )
  )
    return "មិនអាចភ្ជាប់ database ពិត (primary) បានទេ ឬវានៅទទេ។ សូមពិនិត្យ DATABASE_URL របស់ deployment ហើយចុច «Sync catalog» ដើម្បីបញ្ចូលកញ្ចប់ជាមុនសិន។";
  return "មិនអាចរក្សាទុកការកែប្រែបានទេ។ ការកំណត់ចាស់មិនត្រូវបានប្តូរ។ សូមព្យាយាមម្ដងទៀត បន្ទាប់ពីពិនិត្យការភ្ជាប់ Admin storage។";
}

function ActivityLoader({
  size = 22,
  color = "#4f46e5",
  label,
}: {
  size?: number;
  color?: string;
  label?: string;
}) {
  return (
    <span className="inline-flex items-center gap-2" aria-live="polite">
      <OutlineLoader size={size} color={color} />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

function toNumber(value: string) {
  const parsed = Number(String(value ?? "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Sale price = provider cost + admin profit margin. Mirrors salePriceFromMargin on the server. */
function salePriceOf(basePriceUsd: string, profitMarginPercent: string) {
  return toNumber(basePriceUsd) * (1 + toNumber(profitMarginPercent) / 100);
}

function profitOf(basePriceUsd: string, profitMarginPercent: string) {
  return (
    salePriceOf(basePriceUsd, profitMarginPercent) - toNumber(basePriceUsd)
  );
}

function usd(value: number) {
  return `$${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

function normalizedName(value?: string | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function gameLabelOf(group: GameGroup) {
  return group.titleKh?.trim() || group.titleEn?.trim() || "Provider product";
}

/** A margin string the storefront policy accepts: 0-7 with at most two decimals; 0 is reserved for no-profit packages. */
function sanitizeMargin(value: string) {
  const numeric = Math.min(7, Math.max(0, toNumber(value)));
  return numeric.toFixed(2);
}

export default function AdminPricing() {
  const { user, loading } = useAuth();
  const allowed =
    user?.role === "admin" || user?.email?.toLowerCase() === ownerEmail;
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (!allowed)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <div className="rounded-2xl bg-white p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-rose-600" />
          <p className="mt-3 text-sm font-bold">Admin access only</p>
        </div>
      </div>
    );
  return (
    <DashboardLayout>
      <PricingWorkspace />
    </DashboardLayout>
  );
}

function PricingWorkspace() {
  const catalog = trpc.admin.fullCatalog.useQuery();
  const availability = trpc.admin.providerAvailability.useQuery();
  const providerStatus = trpc.admin.providerCatalogStatus.useQuery();
  const eventContent = trpc.admin.content.useQuery();
  const utils = trpc.useUtils();
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [catalogSearch, setCatalogSearch] = useState("");
  // Keep this declaration stable for the source contract test.
  // prettier-ignore
  const [catalogVisibility, setCatalogVisibility] = useState<"all" | "active" | "hidden">("active");
  const [selectedCatalogIds, setSelectedCatalogIds] = useState<Set<string>>(
    () => new Set()
  );
  const [availabilityNotice, setAvailabilityNotice] = useState<string | null>(
    null
  );
  const [batchBusy, setBatchBusy] = useState(false);
  const [pricingSearch, setPricingSearch] = useState("");
  const [storeMargin, setStoreMargin] = useState("5");
  const [bulkNotice, setBulkNotice] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const applyOfferUpdate = (
    offerId: string,
    values: {
      basePriceUsd: string;
      profitMarginPercent: string;
      isActive: boolean;
      featured?: boolean;
    }
  ) => {
    const priceUsd = salePriceOf(
      values.basePriceUsd,
      values.profitMarginPercent
    ).toFixed(2);
    utils.admin.fullCatalog.setData(undefined, current => {
      if (!current) return current;
      return {
        ...current,
        games: current.games.map(game => ({
          ...game,
          packages:
            game.packages?.map((offer: Offer) =>
              offer.id === offerId
                ? {
                    ...offer,
                    ...values,
                    priceUsd,
                    featured: values.featured ?? offer.featured,
                  }
                : offer
            ) ?? [],
        })),
      };
    });
  };

  const updateGame = trpc.admin.updateGamePackage.useMutation({
    onMutate: input => {
      const previous = utils.admin.fullCatalog.getData();
      applyOfferUpdate(input.packageId, {
        basePriceUsd: input.basePriceUsd ?? input.priceUsd ?? "0",
        profitMarginPercent: input.profitMarginPercent ?? "0.00",
        isActive: input.isActive,
        featured: input.featured,
      });
      return { previous };
    },
    onError: (_error, _input, context) =>
      utils.admin.fullCatalog.setData(undefined, context?.previous),
    onSuccess: () => utils.admin.fullCatalog.invalidate(),
  });

  const deleteGame = trpc.admin.deleteGamePackage.useMutation({
    onSuccess: () => utils.admin.fullCatalog.invalidate(),
  });
  const saveFullTicketEvent = trpc.admin.saveContent.useMutation({
    onSuccess: () => {
      utils.admin.content.invalidate();
      utils.content.active.invalidate();
    },
  });
  const syncTopup = trpc.admin.syncTopupCatalog.useMutation({
    onMutate: () => {
      setSyncNotice(null);
      updateGame.reset();
      deleteGame.reset();
      saveFullTicketEvent.reset();
    },
    onSuccess: result => {
      setSyncNotice(
        `បាន Sync ហ្គេម ${result.gamesImported} និងកញ្ចប់ ${result.offersImported} រួចរាល់។ ឥឡូវអ្នកអាចកំណត់ Base USD និង Margin សម្រាប់កញ្ចប់នីមួយៗបាន។`
      );
      utils.admin.fullCatalog.invalidate();
      utils.admin.providerCatalogStatus.invalidate();
    },
  });

  const toggleAvailability = trpc.admin.setProviderAvailability.useMutation({
    onMutate: input => {
      updateGame.reset();
      deleteGame.reset();
      saveFullTicketEvent.reset();
      syncTopup.reset();
      const previous = utils.admin.providerAvailability.getData();
      setAvailabilityNotice(null);
      utils.admin.providerAvailability.setData(undefined, current =>
        current
          ? {
              ...current,
              games: current.games.map(item =>
                item.id === input.providerId
                  ? { ...item, isActive: input.isActive }
                  : item
              ),
            }
          : current
      );
      return { previous };
    },
    onError: (error, _input, context) => {
      utils.admin.providerAvailability.setData(undefined, context?.previous);
      setAvailabilityNotice(catalogAvailabilityErrorMessage(error));
    },
    onSuccess: (_result, input) => {
      setAvailabilityNotice(
        input.isActive
          ? "បានបង្ហាញហ្គេមក្នុងហាងវិញ និងរក្សាទុករួចរាល់។"
          : "បានដកហ្គេមចេញពីហាង និងរក្សាទុករួចរាល់។ អ្នកអាចបើកវិញបាននៅតម្រង ‘មិនទាន់ Add’។"
      );
      utils.provider.games.invalidate();
      utils.admin.providerAvailability.invalidate();
    },
  });

  const setSelectedVisibility = async (isActive: boolean) => {
    const selected = Array.from(selectedCatalogIds).filter(Boolean);
    if (!selected.length) return;
    setBatchBusy(true);
    try {
      for (const providerId of selected)
        await toggleAvailability.mutateAsync({
          kind: "game",
          providerId,
          isActive,
        });
      setSelectedCatalogIds(new Set());
    } finally {
      setBatchBusy(false);
    }
  };

  /** Games the storefront actually shows. Pricing only needs these. */
  const publicGameNames = useMemo(
    () =>
      new Set(
        (availability.data?.games ?? [])
          .filter(item => item.isActive)
          .map(item => normalizedName(item.name))
      ),
    [availability.data]
  );
  const allGames = (catalog.data?.games ?? []) as GameGroup[];
  const publicGames = useMemo(
    () =>
      allGames.filter(
        game =>
          publicGameNames.has(normalizedName(game.titleEn)) ||
          publicGameNames.has(normalizedName(game.titleKh))
      ),
    [allGames, publicGameNames]
  );
  const pricingQuery = pricingSearch.trim().toLowerCase();
  const pricingGames = useMemo(
    () =>
      publicGames.filter(
        game =>
          !pricingQuery ||
          gameLabelOf(game).toLowerCase().includes(pricingQuery)
      ),
    [publicGames, pricingQuery]
  );
  const editableOffers = useMemo(
    () =>
      publicGames.flatMap(game =>
        (game.packages ?? []).filter(offer => offer.providerAuthorized)
      ),
    [publicGames]
  );
  const gameReadiness = useMemo<GameReadiness[]>(() => {
    const catalogByName = new Map<string, GameGroup>();
    for (const game of allGames) {
      const en = normalizedName(game.titleEn);
      const kh = normalizedName(game.titleKh);
      if (en) catalogByName.set(en, game);
      if (kh) catalogByName.set(kh, game);
    }
    return (availability.data?.games ?? []).map(item => {
      const matched = catalogByName.get(normalizedName(item.name));
      const authorized = (matched?.packages ?? []).filter(
        offer => offer.providerAuthorized
      );
      const activeOffers = authorized.filter(offer => offer.isActive);
      const status: GameReadinessStatus = !item.isActive
        ? "hidden"
        : activeOffers.length
          ? "ready"
          : authorized.length
            ? "needs_activation"
            : "needs_sync";
      return {
        providerId: item.id,
        label: matched ? gameLabelOf(matched) : item.name,
        inShop: item.isActive,
        authorizedCount: authorized.length,
        activeCount: activeOffers.length,
        inactiveAuthorizedOffers: authorized.filter(offer => !offer.isActive),
        status,
      };
    });
  }, [availability.data, allGames]);
  const liveOffers = editableOffers.filter(offer => offer.isActive);
  const averageMargin = editableOffers.length
    ? editableOffers.reduce(
        (total, offer) => total + toNumber(offer.profitMarginPercent),
        0
      ) / editableOffers.length
    : 0;
  const projectedProfit = liveOffers.reduce(
    (total, offer) =>
      total + profitOf(offer.basePriceUsd, offer.profitMarginPercent),
    0
  );

  /** Writes one margin across a batch of provider-authorized offers. */
  const applyMarginTo = async (
    offers: Offer[],
    marginPercent: string,
    scopeLabel: string
  ) => {
    const margin = sanitizeMargin(marginPercent);
    const targets = offers.filter(offer => offer.providerAuthorized);
    if (!targets.length) {
      setBulkNotice("មិនមានកញ្ចប់ដែល provider អនុញ្ញាតសម្រាប់កំណត់ Margin ទេ។");
      return;
    }
    setBulkBusy(true);
    setBulkNotice(null);
    // NOTE: one failed row must never abort the batch. A half-applied
    // batch leaves packages inactive, and checkout then fails with
    // "Selected game package is unavailable" for real customers. Every
    // target is attempted, paced to stay under the /api/trpc rate limit
    // (600 requests / 60s), and partial results are reported instead of
    // being silently dropped.
    let saved = 0;
    const failed: Offer[] = [];
    try {
      for (const offer of targets) {
        try {
          await updateGame.mutateAsync({
            packageId: offer.id,
            basePriceUsd: offer.basePriceUsd,
            profitMarginPercent: margin,
            isActive: offer.isActive,
            featured: Boolean(offer.featured),
          });
          saved += 1;
        } catch {
          failed.push(offer);
        }
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      if (failed.length)
        setBulkNotice(
          `រក្សាទុកបានតែ ${saved}/${targets.length} កញ្ចប់។ សូមព្យាយាមម្ដងទៀត។`
        );
      else
        setBulkNotice(
          `បានកំណត់ Margin ${margin}% លើ ${saved} កញ្ចប់ (${scopeLabel}) រួចរាល់។ តម្លៃលក់ត្រូវបានគណនាឡើងវិញដោយស្វ័យប្រវត្តិ។`
        );
    } finally {
      setBulkBusy(false);
    }
  };

  /** Turns every public offer on (or off) at once so the store can open for sale in one tap. */
  const setAllOffersLive = async (isActive: boolean) => {
    const targets = editableOffers.filter(offer => offer.isActive !== isActive);
    if (!targets.length) {
      setBulkNotice(
        isActive
          ? "កញ្ចប់ទាំងអស់កំពុងលក់រួចហើយ។"
          : "កញ្ចប់ទាំងអស់ត្រូវបានបិទរួចហើយ។"
      );
      return;
    }
    setBulkBusy(true);
    setBulkNotice(null);
    // NOTE: one failed row must never abort the batch. A half-applied
    // batch leaves packages inactive, and checkout then fails with
    // "Selected game package is unavailable" for real customers. Every
    // target is attempted, paced to stay under the /api/trpc rate limit
    // (600 requests / 60s), and partial results are reported instead of
    // being silently dropped.
    let saved = 0;
    const failed: Offer[] = [];
    try {
      for (const offer of targets) {
        try {
          await updateGame.mutateAsync({
            packageId: offer.id,
            basePriceUsd: offer.basePriceUsd,
            profitMarginPercent: sanitizeMargin(offer.profitMarginPercent),
            isActive,
            featured: Boolean(offer.featured),
          });
          saved += 1;
        } catch {
          failed.push(offer);
        }
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      if (failed.length)
        setBulkNotice(
          `រក្សាទុកបានតែ ${saved}/${targets.length} កញ្ចប់។ សូមព្យាយាមម្ដងទៀត។`
        );
      else
        setBulkNotice(
          isActive ? `បានបើកលក់ ${saved} កញ្ចប់។` : `បានបិទ ${saved} កញ្ចប់។`
        );
    } finally {
      setBulkBusy(false);
    }
  };

  const activateGamePackages = async (item: GameReadiness) => {
    const targets = item.inactiveAuthorizedOffers;
    if (!targets.length) {
      setBulkNotice(`កញ្ចប់ទាំងអស់សម្រាប់ ${item.label} កំពុងលក់រួចហើយ។`);
      return;
    }
    setBulkBusy(true);
    setBulkNotice(null);
    let saved = 0;
    const failed: Offer[] = [];
    try {
      for (const offer of targets) {
        try {
          await updateGame.mutateAsync({
            packageId: offer.id,
            basePriceUsd: offer.basePriceUsd,
            profitMarginPercent: sanitizeMargin(offer.profitMarginPercent),
            isActive: true,
            featured: Boolean(offer.featured),
          });
          saved += 1;
        } catch {
          failed.push(offer);
        }
        await new Promise(resolve => setTimeout(resolve, 60));
      }
      if (failed.length)
        setBulkNotice(
          `បើកបានតែ ${saved}/${targets.length} កញ្ចប់សម្រាប់ ${item.label}។ សូមព្យាយាមម្ដងទៀត។`
        );
      else
        setBulkNotice(
          `បានបើកលក់ ${saved} កញ្ចប់សម្រាប់ ${item.label} រួចរាល់។`
        );
    } finally {
      setBulkBusy(false);
    }
  };

  const actionError =
    availability.error ??
    toggleAvailability.error ??
    updateGame.error ??
    deleteGame.error ??
    saveFullTicketEvent.error ??
    syncTopup.error;
  const visibleActionError =
    actionError && !availabilityNotice && !syncNotice && !bulkNotice
      ? actionError
      : null;

  return (
    <main className="mx-auto max-w-6xl pb-10">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-indigo-700">
            CATALOG CONTROL
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold text-slate-950">
            គ្រប់គ្រងផលិតផល និងតម្លៃ
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            ជំហាន ១៖ Add ហ្គេមចូលហាង។ ជំហាន ២៖ កំណត់ % ចំណេញ —
            ប្រព័ន្ធគណនាតម្លៃលក់ជំនួសអ្នក។ ផ្ទាំងតម្លៃបង្ហាញតែហ្គេមដែល public
            ក្នុងហាងប៉ុណ្ណោះ។
          </p>
        </div>
        <AnimatedBackButton
          href="/admin"
          className="h-10 justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700"
        >
          ត្រឡប់ទៅ Admin
        </AnimatedBackButton>
      </header>

      {visibleActionError ? <AdminError error={visibleActionError} /> : null}
      {availabilityNotice ? (
        <div
          role="status"
          className={`mt-5 flex items-start gap-2 rounded-2xl border p-4 text-xs leading-5 ${toggleAvailability.error ? "border-rose-100 bg-rose-50 text-rose-900" : "border-emerald-100 bg-emerald-50 text-emerald-900"}`}
        >
          {toggleAvailability.error ? (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <p>{availabilityNotice}</p>
        </div>
      ) : null}
      {syncNotice ? (
        <div className="mt-5 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs leading-5 text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{syncNotice}</p>
        </div>
      ) : null}

      <PricingCommandCenter
        loading={catalog.isLoading || availability.isLoading}
        busy={bulkBusy}
        notice={bulkNotice}
        publicGameCount={publicGames.length}
        offerCount={editableOffers.length}
        liveOfferCount={liveOffers.length}
        averageMargin={averageMargin}
        projectedProfit={projectedProfit}
        margin={storeMargin}
        onMargin={setStoreMargin}
        onApplyAll={() =>
          void applyMarginTo(
            editableOffers,
            storeMargin,
            "ហ្គេម public ទាំងអស់"
          )
        }
        onOpenAll={() => void setAllOffersLive(true)}
        onCloseAll={() => {
          if (
            window.confirm(
              "បិទកញ្ចប់ទាំងអស់មែនទេ? អតិថិជននឹងមិនអាចបញ្ជាទិញបានទេ។"
            )
          )
            void setAllOffersLive(false);
        }}
        onDismissNotice={() => setBulkNotice(null)}
      />

      <CatalogInventoryControls
        loading={availability.isLoading}
        games={availability.data?.games}
        search={catalogSearch}
        visibilityFilter={catalogVisibility}
        selectedIds={selectedCatalogIds}
        busy={toggleAvailability.isPending || batchBusy}
        onSearch={setCatalogSearch}
        onVisibilityFilter={setCatalogVisibility}
        onToggle={(providerId, isActive) =>
          toggleAvailability.mutate({ kind: "game", providerId, isActive })
        }
        onToggleSelected={providerId =>
          setSelectedCatalogIds(current => {
            const next = new Set(current);
            if (next.has(providerId)) next.delete(providerId);
            else next.add(providerId);
            return next;
          })
        }
        onSetSelectedVisibility={setSelectedVisibility}
      />

      <ProviderSyncStatus
        loading={providerStatus.isLoading}
        status={providerStatus.data}
        onSyncTopup={() => syncTopup.mutate()}
        syncingTopup={syncTopup.isPending}
      />
      <GameReadinessPanel
        readiness={gameReadiness}
        loading={catalog.isLoading || availability.isLoading}
        busy={bulkBusy || toggleAvailability.isPending}
        onAddToShop={providerId =>
          toggleAvailability.mutate({
            kind: "game",
            providerId,
            isActive: true,
          })
        }
        onActivateGame={item => void activateGamePackages(item)}
        onRemoveFromShop={providerId =>
          toggleAvailability.mutate({
            kind: "game",
            providerId,
            isActive: false,
          })
        }
      />

      <section className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-lg font-extrabold text-slate-950">
              តម្លៃ និង Margin តាមហ្គេម
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
              កំណត់ % ចំណេញម្ដងសម្រាប់ហ្��េមមួយ ឬកែកញ្ចប់ណាមួយដោយឡែក។ Base USD
              គឺតម្លៃដើមពី provider។
            </p>
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">ស្វែងរកហ្គេមក្នុងផ្ទាំងតម្លៃ</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={pricingSearch}
              onChange={event => setPricingSearch(event.target.value)}
              placeholder="ស្វែងរកហ្គេម…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-9 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            {pricingSearch ? (
              <button
                type="button"
                onClick={() => setPricingSearch("")}
                aria-label="សម្អាតការស្វែងរក"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
        </div>
        {catalog.isLoading ? (
          <div className="mt-4 grid min-h-48 place-items-center rounded-2xl border border-slate-200 bg-white">
            <ActivityLoader size={30} />
          </div>
        ) : !publicGames.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs leading-6 text-slate-600">
            <Layers3 className="mx-auto h-6 w-6 text-slate-400" />
            <p className="mt-2 font-bold text-slate-800">
              មិនទាន់មានហ្គេម public សម្រាប់កំណត់តម្លៃទេ
            </p>
            <p className="mt-1">
              សូម Add ហ្គេមចូលហាងនៅផ្ទាំង «បញ្ជីហ្គេម FazerCards» ខាងលើ រួច Sync
              catalog ម្ដង។
            </p>
          </div>
        ) : !pricingGames.length ? (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-600">
            មិនមានហ្គេមត្រូវនឹងការស្វែងរក «{pricingSearch}» ទេ។
          </div>
        ) : (
          <div className="mt-4 grid gap-4">
            {pricingGames.map(game => (
              <GamePricingCard
                key={game.id}
                game={game}
                busy={bulkBusy}
                onApplyGameMargin={margin =>
                  void applyMarginTo(
                    game.packages ?? [],
                    margin,
                    gameLabelOf(game)
                  )
                }
                onSaveOffer={(offer, values) =>
                  updateGame.mutate({
                    packageId: offer.id,
                    ...values,
                    profitMarginPercent: sanitizeMargin(
                      values.profitMarginPercent
                    ),
                    featured: Boolean(offer.featured),
                  })
                }
                onDeleteOffer={offerId =>
                  deleteGame.mutate({ packageId: offerId })
                }
              />
            ))}
          </div>
        )}
      </section>

      <FullTicketEventControl
        content={eventContent.data}
        loading={eventContent.isLoading}
        saving={saveFullTicketEvent.isPending}
        onSave={input => saveFullTicketEvent.mutate(input)}
      />
    </main>
  );
}

const GAME_READINESS_META: Record<
  GameReadinessStatus,
  { label: string; hint: string; tone: string }
> = {
  ready: {
    label: "✅ លក់បាន",
    hint: "អតិថិជនឃើញ និងទិញកញ្ចប់បាន",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
  },
  needs_activation: {
    label: "⚠️ ត្រូវបើកកញ្ចប់",
    hint: "បាន Sync ហើយ តែកញ្ចប់មិនទាន់បើកលក់",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
  },
  needs_sync: {
    label: "⛔ គ្មានកញ្ចប់",
    hint: "Sync catalog ម្ដងសិន។ បើនៅតែ 0 = ហ្គេមផ្ទៀងផ្ទាត់ ID (ML/PUBG/Magic Chess) ដែលបង្ហាញកញ្ចប់តែពេលអតិថិជនបញ្ចូល ID ត្រឹមត្រូវ — ឬដកចេញពីហាង",
    tone: "border-rose-200 bg-rose-50 text-rose-800",
  },
  hidden: {
    label: "⚪ មិននៅក្នុងហាង",
    hint: "មិនទាន់ Add ចូលហាង",
    tone: "border-slate-200 bg-slate-50 text-slate-600",
  },
};

function GameReadinessPanel({
  readiness,
  loading,
  busy,
  onAddToShop,
  onActivateGame,
  onRemoveFromShop,
}: {
  readiness: GameReadiness[];
  loading: boolean;
  busy: boolean;
  onAddToShop: (providerId: string) => void;
  onActivateGame: (item: GameReadiness) => void;
  onRemoveFromShop: (providerId: string) => void;
}) {
  const [view, setView] = useState<"attention" | "all">("attention");
  const counts = useMemo(
    () => ({
      ready: readiness.filter(item => item.status === "ready").length,
      needsActivation: readiness.filter(
        item => item.status === "needs_activation"
      ).length,
      needsSync: readiness.filter(item => item.status === "needs_sync").length,
      hidden: readiness.filter(item => item.status === "hidden").length,
    }),
    [readiness]
  );
  const attentionRows = useMemo(
    () => readiness.filter(item => item.status !== "ready"),
    [readiness]
  );
  const rows = view === "attention" ? attentionRows : readiness;
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
            <Layers3 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-950">
              ស្ថានភាពហ្គេម — តើអតិថិជនឃើញកញ្ចប់ដែរឬទេ?
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">
              មើលក្នុងមួយកន្លែង៖ ហ្គេមណាលក់បាន ហ្គេមណាត្រូវការសកម្មភាព។
              ចុចប៊ូតុងដើម្បីជួសជុលភ្លាម។
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] font-bold">
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
            ✅ លក់បាន {counts.ready}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-amber-800">
            ⚠️ ត្រូវបើក {counts.needsActivation}
          </span>
          <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-rose-800">
            ⛔ គ្មានកញ្ចប់ {counts.needsSync}
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
            ⚪ មិននៅក្នុងហាង {counts.hidden}
          </span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView("attention")}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${view === "attention" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            ត្រូវការសកម្មភាព ({attentionRows.length})
          </button>
          <button
            type="button"
            onClick={() => setView("all")}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${view === "all" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}
          >
            ទាំងអស់ ({readiness.length})
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="grid min-h-32 place-items-center">
            <ActivityLoader size={28} />
          </div>
        ) : !readiness.length ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs leading-6 text-slate-600">
            មិនទាន់មានហ្គេម FazerCards ទេ។ សូម Sync catalog ជាមុនសិន។
          </p>
        ) : !rows.length ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center text-xs font-bold text-emerald-800">
            🎉 ហ្គេមទាំងអស់លក់បានហើយ! គ្មានអ្វីត្រូវធ្វើទៀតទេ។
          </p>
        ) : (
          <div className="grid gap-2">
            {rows.map(item => {
              const meta = GAME_READINESS_META[item.status];
              return (
                <div
                  key={item.providerId}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {meta.hint} · {item.activeCount}/{item.authorizedCount}{" "}
                      កញ្ចប់លក់
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    {item.status === "needs_activation" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onActivateGame(item)}
                        className="rounded-lg bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-amber-600 disabled:opacity-50"
                      >
                        បើកលក់កញ្ចប់
                      </button>
                    ) : null}
                    {item.status === "hidden" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onAddToShop(item.providerId)}
                        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
                      >
                        Add ចូលហាង
                      </button>
                    ) : null}
                    {item.status === "needs_sync" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onRemoveFromShop(item.providerId)}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        ដកចេញពីហាង
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

/** One place for store-wide profit: type a %, tap once, every public offer is repriced. */
function PricingCommandCenter({
  loading,
  busy,
  notice,
  publicGameCount,
  offerCount,
  liveOfferCount,
  averageMargin,
  projectedProfit,
  margin,
  onMargin,
  onApplyAll,
  onOpenAll,
  onCloseAll,
  onDismissNotice,
}: {
  loading: boolean;
  busy: boolean;
  notice: string | null;
  publicGameCount: number;
  offerCount: number;
  liveOfferCount: number;
  averageMargin: number;
  projectedProfit: number;
  margin: string;
  onMargin: (value: string) => void;
  onApplyAll: () => void;
  onOpenAll: () => void;
  onCloseAll: () => void;
  onDismissNotice: () => void;
}) {
  const disabled = loading || busy || !offerCount;
  const stats = [
    { label: "ហ្គេម public", value: String(publicGameCount) },
    { label: "កញ្ចប់អាចកែ", value: String(offerCount) },
    { label: "កំពុងលក់", value: `${liveOfferCount}/${offerCount}` },
    { label: "Margin មធ្យម", value: `${averageMargin.toFixed(1)}%` },
  ];
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 via-white to-emerald-50 shadow-sm">
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-600 text-white shadow-sm">
            <Percent className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-extrabold text-slate-950">
              កំណត់ចំណេញលឿន (Store margin)
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-600">
              ដាក់ % ចំណេញមួយ រួចចុច «អនុវត្តលើហ្គេម public ទាំងអស់»។ តម្លៃលក់ =
              Base USD × (1 + % ចំណេញ)។
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:shrink-0">
          {stats.map(stat => (
            <div
              key={stat.label}
              className="rounded-xl border border-white bg-white/80 px-3 py-2"
            >
              <p className="text-base font-extrabold text-slate-950">
                {stat.value}
              </p>
              <p className="mt-0.5 text-[9px] font-bold text-slate-500">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 border-t border-indigo-100/70 bg-white/60 p-4 sm:p-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div>
          <label className="block">
            <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
              % ចំណេញ (Margin)
            </span>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  value={margin}
                  onChange={event => onMargin(event.target.value)}
                  inputMode="decimal"
                  aria-label="Store margin percent"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm font-extrabold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
                  %
                </span>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={onApplyAll}
                className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 text-xs font-extrabold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {busy ? (
                  <ActivityLoader size={16} color="#ffffff" />
                ) : (
                  <Zap className="h-4 w-4" />
                )}
                អនុវត្តទាំងអស់
              </button>
            </div>
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {marginPresets.map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => onMargin(preset)}
                aria-pressed={sanitizeMargin(margin) === sanitizeMargin(preset)}
                className={`h-8 rounded-lg border px-2.5 text-[11px] font-extrabold transition ${sanitizeMargin(margin) === sanitizeMargin(preset) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:text-indigo-700"}`}
              >
                {preset}%
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-800">
              <TrendingUp className="h-3.5 w-3.5" />
              ចំណេញប៉ាន់ស្��ាន / ការលក់មួយជុំ
            </p>
            <p className="mt-1 font-display text-xl font-extrabold text-emerald-900">
              {usd(projectedProfit)}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-emerald-800/80">
              សរុបចំណេញពីកញ្ចប់ដែលកំពុងលក់ បើកញ្ចប់ម្នាក់មួយត្រូវបានទិញ។
            </p>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={onOpenAll}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              បើកលក់កញ្ចប់ទាំងអស់
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={onCloseAll}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              បិទកញ្ចប់ទាំងអស់
            </button>
          </div>
        </div>
        {notice ? (
          <div
            role="status"
            className="flex items-start justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-5 text-indigo-900 lg:col-span-2"
          >
            <p className="flex items-start gap-2">
              <Calculator className="mt-0.5 h-4 w-4 shrink-0" />
              {notice}
            </p>
            <button
              type="button"
              onClick={onDismissNotice}
              aria-label="បិទសារ"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-indigo-700 hover:bg-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/** Per-game pricing: one margin for the whole game, plus per-offer overrides. */
function GamePricingCard({
  game,
  busy,
  onApplyGameMargin,
  onSaveOffer,
  onDeleteOffer,
}: {
  game: GameGroup;
  busy: boolean;
  onApplyGameMargin: (margin: string) => void;
  onSaveOffer: (offer: Offer, values: OfferValues) => void;
  onDeleteOffer: (offerId: string) => void;
}) {
  const offers = game.packages ?? [];
  const editable = offers.filter(offer => offer.providerAuthorized);
  const live = editable.filter(offer => offer.isActive).length;
  const firstMargin = editable[0]?.profitMarginPercent ?? "10.00";
  const mixedMargin = editable.some(
    offer =>
      sanitizeMargin(offer.profitMarginPercent) !== sanitizeMargin(firstMargin)
  );
  const [margin, setMargin] = useState(() => sanitizeMargin(firstMargin));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMargin(sanitizeMargin(firstMargin));
  }, [firstMargin]);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-extrabold text-slate-950">
              {gameLabelOf(game)}
            </h3>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Public
            </span>
            {mixedMargin ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                Margin ចម្រុះ
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-[11px] font-semibold text-slate-500">
            {editable.length} កញ្ចប់អាចកែ · {live} កំពុងលក់
            {offers.length !== editable.length
              ? ` · ${offers.length - editable.length} រង់ចាំ provider`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <div className="relative">
            <input
              value={margin}
              onChange={event => setMargin(event.target.value)}
              inputMode="decimal"
              aria-label={`Margin for ${gameLabelOf(game)}`}
              className="h-10 w-24 rounded-xl border border-slate-200 bg-white pl-3 pr-7 text-sm font-extrabold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            />
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-extrabold text-slate-400">
              %
            </span>
          </div>
          <button
            type="button"
            disabled={busy || !editable.length}
            onClick={() => onApplyGameMargin(margin)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-xs font-extrabold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Zap className="h-3.5 w-3.5" />
            អនុវត្តលើហ្គេមនេះ
          </button>
          <button
            type="button"
            onClick={() => setOpen(current => !current)}
            aria-expanded={open}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {open ? "បិទកញ្ចប់" : `មើលកញ្ចប់ (${offers.length})`}
          </button>
        </div>
      </div>
      {open ? (
        <div className="grid gap-2 border-t border-slate-100 bg-slate-50/70 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {offers.length ? (
            offers.map(offer => (
              <OfferEditor
                key={offer.id}
                offer={offer}
                label={
                  offer.amountLabel ??
                  (offer.quantity
                    ? `${Number(offer.quantity).toLocaleString()} units`
                    : "Offer")
                }
                onSave={values => onSaveOffer(offer, values)}
                onDelete={() => onDeleteOffer(offer.id)}
              />
            ))
          ) : (
            <p className="text-xs text-slate-500 sm:col-span-2 xl:col-span-3">
              មិនទាន់មានកញ្ចប់ដែល Sync មកសម្រាប់ហ្គេមនេះទេ។
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

function OfferEditor({
  offer,
  label,
  onSave,
  onDelete,
}: {
  offer: Offer;
  label: string;
  onSave: (values: OfferValues) => void;
  onDelete: () => void;
}) {
  const [base, setBase] = useState(offer.basePriceUsd);
  const [margin, setMargin] = useState(offer.profitMarginPercent);
  const [active, setActive] = useState(offer.isActive);
  const canEdit = offer.providerAuthorized;
  // Round 9: an owner-editable banner on this one package, e.g. "DISCOUNT".
  // The game id comes from the provider source the catalog sync stamped here.
  const providerParts = /^fzr_cards:([^:]+):(.+)$/.exec(offer.providerSource ?? "");
  const badgeGameId = providerParts?.[1] ?? "";
  const badgeOfferId = offer.id;
  const badgeQuery = trpc.provider.packageBadges.useQuery({ gameId: badgeGameId }, { enabled: Boolean(badgeGameId) });
  const currentBadge = (badgeQuery.data ?? []).find((item) => item.offerId === badgeOfferId) ?? null;
  const [badgeLabel, setBadgeLabel] = useState("");
  const [badgeTone, setBadgeTone] = useState("discount");
  const setBadge = trpc.admin.setPackageBadge.useMutation({ onSuccess: () => { void badgeQuery.refetch(); } });
  const resetBadge = trpc.admin.resetPackageBadge.useMutation({ onSuccess: () => { void badgeQuery.refetch(); } });

  useEffect(() => {
    setBadgeLabel(currentBadge?.label ?? "");
    setBadgeTone(currentBadge?.tone ?? "discount");
  }, [currentBadge?.label, currentBadge?.tone]);

  useEffect(() => {
    setBase(offer.basePriceUsd);
    setMargin(offer.profitMarginPercent);
    setActive(offer.isActive);
  }, [offer.basePriceUsd, offer.profitMarginPercent, offer.isActive]);

  const sale = salePriceOf(base, margin);
  const profit = profitOf(base, margin);
  const dirty =
    base !== offer.basePriceUsd ||
    sanitizeMargin(margin) !== sanitizeMargin(offer.profitMarginPercent) ||
    active !== offer.isActive;

  return (
    <div
      className={`rounded-xl border bg-white p-3 ${dirty ? "border-indigo-300 ring-2 ring-indigo-100" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-extrabold text-slate-900">
            {label}
          </p>
          <p
            className={`mt-1 text-[10px] font-bold ${canEdit ? "text-emerald-700" : "text-amber-700"}`}
          >
            {canEdit
              ? `Provider authorized${offer.providerSource ? ` · ${offer.providerSource}` : ""}`
              : "Provider authorization required"}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-slate-600">
          <input
            checked={active}
            disabled={!canEdit}
            onChange={event => setActive(event.target.checked)}
            type="checkbox"
          />
          លក់
        </label>
      </div>
      {!canEdit ? (
        <p className="mt-2 rounded-lg border border-amber-100 bg-amber-50 px-2 py-1.5 text-[10px] leading-4 text-amber-800">
          Record នេះមិនអាចកែ ឬបើកបានទេ រហូតដល់ provider sync បានបញ្ជាក់ source
          របស់វា។
        </p>
      ) : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-[10px] font-bold text-slate-500">
            Base USD (ដើម)
          </span>
          <input
            disabled={!canEdit}
            value={base}
            onChange={event => setBase(event.target.value)}
            inputMode="decimal"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </label>
        <label>
          <span className="mb-1 block text-[10px] font-bold text-slate-500">
            Margin %
          </span>
          <input
            disabled={!canEdit}
            value={margin}
            onChange={event => setMargin(event.target.value)}
            inputMode="decimal"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold disabled:cursor-not-allowed disabled:bg-slate-100"
          />
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {marginPresets.map(preset => (
          <button
            key={preset}
            type="button"
            disabled={!canEdit}
            onClick={() => setMargin(preset)}
            className="h-6 rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] font-bold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {preset}%
          </button>
        ))}
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2">
        <p className="text-[10px] font-bold text-slate-500">
          តម្លៃលក់
          <strong className="mt-0.5 block text-sm font-extrabold text-slate-900">
            {usd(sale)}
          </strong>
        </p>
        <p className="text-[10px] font-bold text-slate-500">
          ចំណេញ
          <strong className="mt-0.5 block text-sm font-extrabold text-emerald-700">
            {usd(profit)}
          </strong>
        </p>
      </div>
      <div className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50 p-2">
        <p className="text-[10px] font-bold text-slate-500">Banner លើកញ្ចប់ (ជ្រើសរួស)</p>
        <div className="mt-1.5 flex gap-1.5">
          <input
            value={badgeLabel}
            onChange={event => setBadgeLabel(event.target.value)}
            maxLength={40}
            placeholder="DISCOUNT"
            className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold"
          />
          <select
            value={badgeTone}
            onChange={event => setBadgeTone(event.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-1 text-[10px] font-bold"
          >
            <option value="discount">Discount</option>
            <option value="hot">Hot</option>
            <option value="new">New</option>
            <option value="best">Best</option>
            <option value="gold">Gold</option>
          </select>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!badgeGameId || !badgeLabel.trim() || setBadge.isPending}
            onClick={() =>
              setBadge.mutate({
                gameId: badgeGameId,
                offerId: badgeOfferId,
                label: badgeLabel.trim(),
                tone: badgeTone as "discount" | "hot" | "new" | "best" | "gold",
              })
            }
            className="h-7 rounded-md bg-indigo-600 px-2 text-[10px] font-bold text-white disabled:bg-slate-300"
          >
            រក្សាទុក Banner
          </button>
          {currentBadge ? (
            <button
              type="button"
              disabled={resetBadge.isPending}
              onClick={() => resetBadge.mutate({ gameId: badgeGameId, offerId: badgeOfferId })}
              className="h-7 rounded-md border border-rose-200 bg-rose-50 px-2 text-[10px] font-bold text-rose-700"
            >
              លុប Banner
            </button>
          ) : null}
          {!badgeGameId ? <span className="text-[10px] font-bold text-amber-700">ត្រូវ Sync កញ្ចប់មុន</span> : null}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1">
        <button
          type="button"
          disabled={!canEdit}
          onClick={() =>
            onSave({
              basePriceUsd: base,
              profitMarginPercent: sanitizeMargin(margin),
              isActive: active,
            })
          }
          className="inline-flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-[10px] font-bold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          <Save className="h-3 w-3" />
          រក្សាទុក
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`លុប ${label} ពិតមែនទេ?`)) onDelete();
          }}
          className="grid h-8 w-8 place-items-center rounded-lg border border-rose-200 bg-rose-50 text-rose-700"
          aria-label="Delete offer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function FullTicketEventControl({
  content,
  loading,
  saving,
  onSave,
}: {
  content?: EventContent[];
  loading: boolean;
  saving: boolean;
  onSave: (input: {
    contentKey: string;
    titleKh: string;
    bodyKh?: string;
    isActive: boolean;
  }) => void;
}) {
  const event = content?.find(
    item => item.contentKey === "topup-event-full-ticket"
  );
  const [title, setTitle] = useState("កញ្ចប់ Full Ticket");
  const [description, setDescription] = useState(
    "បង្ហាញតែកញ្ចប់ Full Ticket ដែល Provider មានក្នុងពេល Event ប៉ុណ្ណោះ។"
  );

  useEffect(() => {
    if (!event) return;
    setTitle(event.titleKh?.trim() || "កញ្ចប់ Full Ticket");
    setDescription(
      event.bodyKh?.trim() ||
        "បង្ហាញតែកញ្ចប់ Full Ticket ដែល Provider មានក្នុងពេល Event ប៉ុណ្ណោះ។"
    );
  }, [event?.id]);

  const persist = (isActive: boolean) =>
    onSave({
      contentKey: "topup-event-full-ticket",
      titleKh: title.trim() || "កញ្ចប់ Full Ticket",
      bodyKh: description.trim() || undefined,
      isActive,
    });
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 via-white to-indigo-50 p-4 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-600 text-white shadow-sm">
            <Ticket className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-extrabold text-slate-950">
                Event · Full Ticket
              </h2>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${event?.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}
              >
                {event?.isActive ? "កំពុងបង្ហាញ" : "មិនទាន់បង្ហាញ"}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
              បើក section នេះតែពេលមាន Event។
              វាមិនបង្កើតផលិតផលថ្មីទេ—អតិថិជននឹងឃើញតែកញ្ចប់ Provider
              ពិតដែលមានពាក្យ “Full Ticket” ប៉ុណ្ណោះ។
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={loading || saving}
          onClick={() => persist(!event?.isActive)}
          className={`inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${event?.isActive ? "bg-slate-900 hover:bg-slate-700" : "bg-violet-600 hover:bg-violet-700"}`}
        >
          {saving ? (
            <ActivityLoader size={16} color="#ffffff" />
          ) : (
            <CalendarDays className="h-4 w-4" />
          )}
          {event?.isActive ? "បិទ Event" : "បើក Event"}
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
            ចំណងជើងដែលបង្ហាញលើហាង
          </span>
          <input
            value={title}
            onChange={event => setTitle(event.target.value)}
            maxLength={240}
            className="h-10 w-full rounded-xl border border-violet-100 bg-white px-3 text-xs font-semibold text-slate-900 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </label>
        <label>
          <span className="mb-1.5 block text-[10px] font-bold text-slate-600">
            អត្ថបទពណ៌នា (ជាជម្រើស)
          </span>
          <input
            value={description}
            onChange={event => setDescription(event.target.value)}
            maxLength={5000}
            className="h-10 w-full rounded-xl border border-violet-100 bg-white px-3 text-xs text-slate-800 outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={loading || saving}
        onClick={() => persist(Boolean(event?.isActive))}
        className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Save className="h-3.5 w-3.5" />
        រក្សាទុកអត្ថបទ Event
      </button>
    </section>
  );
}

/** Game-only inventory control. SMM has been retired from the store. */
function CatalogInventoryControls({
  loading,
  games,
  search,
  visibilityFilter,
  selectedIds,
  busy,
  onSearch,
  onVisibilityFilter,
  onToggle,
  onToggleSelected,
  onSetSelectedVisibility,
}: {
  loading: boolean;
  games?: AvailabilityItem[];
  search: string;
  visibilityFilter: "all" | "active" | "hidden";
  selectedIds: Set<string>;
  busy: boolean;
  onSearch: (value: string) => void;
  onVisibilityFilter: (value: "all" | "active" | "hidden") => void;
  onToggle: (providerId: string, isActive: boolean) => void;
  onToggleSelected: (providerId: string) => void;
  onSetSelectedVisibility: (isActive: boolean) => void;
}) {
  const query = search.trim().toLowerCase();
  const items = useMemo(
    () =>
      [...(games ?? [])].sort((left, right) =>
        left.name.localeCompare(right.name)
      ),
    [games]
  );
  const filtered = useMemo(
    () =>
      items.filter(item => {
        const matchesSearch = !query || item.name.toLowerCase().includes(query);
        const matchesVisibility =
          visibilityFilter === "all" ||
          (visibilityFilter === "active" ? item.isActive : !item.isActive);
        return matchesSearch && matchesVisibility;
      }),
    [items, query, visibilityFilter]
  );
  const activeCount = items.filter(item => item.isActive).length;
  const selectedCount = filtered.filter(item =>
    selectedIds.has(item.id)
  ).length;
  const allFilteredSelected =
    Boolean(filtered.length) && selectedCount === filtered.length;

  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
              <Layers3 className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-extrabold text-slate-950">
                បញ្ជីហ្គេម FazerCards
              </h2>
              <p className="mt-0.5 max-w-xl text-xs leading-5 text-slate-500">
                ចុច «បន្ថែមចូលហាង» ដើម្បី public ហ្គេម។ សូម Add
                តែហ្គេមដែលអ្នកចង់លក់ ដើម្បីឲ្យទំព័រដើមមិនឡើងហ្គេមច្រើនពេក។
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center sm:flex">
            <div className="rounded-xl bg-slate-50 px-3 py-2">
              <p className="text-lg font-extrabold text-slate-950">
                {items.length}
              </p>
              <p className="text-[9px] font-bold text-slate-500">ហ្គេមសរុប</p>
            </div>
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <p className="text-lg font-extrabold text-emerald-700">
                {activeCount}
              </p>
              <p className="text-[9px] font-bold text-emerald-700/70">
                ក្នុងហាង
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto]">
          <label className="relative block">
            <span className="sr-only">ស្វែងរកហ្គេម</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={event => onSearch(event.target.value)}
              placeholder="ស្វែងរកហ្គេម…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-9 text-xs text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
            {search ? (
              <button
                type="button"
                onClick={() => onSearch("")}
                aria-label="សម្អាតការស្វែងរក"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </label>
          <div
            className="flex overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-1"
            role="group"
            aria-label="ស្ថានភាពហ្គេម"
          >
            {(
              [
                { value: "active", label: "ក្នុងហាង" },
                { value: "hidden", label: "មិនទាន់ Add" },
                { value: "all", label: "ទាំងអស់" },
              ] as const
            ).map(filter => (
              <button
                key={filter.value}
                type="button"
                onClick={() => onVisibilityFilter(filter.value)}
                aria-pressed={visibilityFilter === filter.value}
                className={`h-8 shrink-0 rounded-lg px-3 text-[10px] font-bold ${visibilityFilter === filter.value ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-white"}`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {filtered.length ? (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
          <label className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
            <input
              type="checkbox"
              checked={allFilteredSelected}
              onChange={() =>
                filtered.forEach(item => {
                  if (
                    allFilteredSelected
                      ? selectedIds.has(item.id)
                      : !selectedIds.has(item.id)
                  )
                    onToggleSelected(item.id);
                })
              }
            />
            ជ្រើសទាំងអស់ក្នុងតម្រង ({filtered.length})
          </label>
          {selectedCount ? (
            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => onSetSelectedVisibility(true)}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-50"
              >
                បន្ថែម {selectedCount} ចូលហាង
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onSetSelectedVisibility(false)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 text-[10px] font-bold text-slate-700 disabled:opacity-50"
              >
                ដកចេញ
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div className="grid min-h-32 place-items-center p-6">
          <ActivityLoader size={26} />
        </div>
      ) : !filtered.length ? (
        <div className="p-6 text-center text-xs text-slate-500">
          មិនមានហ្គេមត្រូវនឹងតម្រងទេ។
        </div>
      ) : (
        <ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto">
          {filtered.map(item => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <label className="flex min-w-0 items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => onToggleSelected(item.id)}
                />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-900">
                    {item.name}
                  </span>
                  <span
                    className={`mt-0.5 block text-[10px] font-bold ${item.isActive ? "text-emerald-700" : "text-slate-400"}`}
                  >
                    {item.isActive ? "កំពុងបង្ហាញក្នុងហាង" : "មិនទាន់ Add"}
                  </span>
                </span>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => onToggle(item.id, !item.isActive)}
                className={`inline-flex h-8 shrink-0 items-center rounded-lg px-2.5 text-[10px] font-bold transition disabled:opacity-50 ${item.isActive ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
              >
                {item.isActive ? "ដកចេញពីហាង" : "បន្ថែមចូលហាង"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AdminError({ error }: { error: { message: string } }) {
  const message = catalogAvailabilityErrorMessage(error);
  return (
    <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-xs leading-5 text-rose-900">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
      <p>{message}</p>
    </div>
  );
}

function ProviderSyncStatus({
  loading,
  status,
  onSyncTopup,
  syncingTopup,
}: {
  loading: boolean;
  status?: { configured: boolean };
  onSyncTopup: () => void;
  syncingTopup: boolean;
}) {
  const ready = status?.configured;
  return (
    <div className="mt-6">
      <div
        className={`flex flex-col gap-3 rounded-2xl border p-4 text-xs sm:flex-row sm:items-center sm:justify-between ${ready ? "border-emerald-100 bg-emerald-50 text-emerald-900" : "border-slate-200 bg-white text-slate-700"}`}
      >
        <div className="flex items-start gap-3">
          {ready ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
          ) : (
            <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
          )}
          <div>
            <p className="font-bold">FZR Cards · Game Top-up</p>
            <p className="mt-1 leading-5">
              {loading
                ? "កំពុងពិនិត្យ provider connection។ អ្នកអាចចាប់ផ្ដើម Sync បាន ហើយ server នឹងផ្ទៀងផ្ទាត់មុនរក្សាទុក។"
                : ready
                  ? "អាចទាញទិន្នន័យពី provider បាន។ Sync ដើម្បីទាញ Base USD ថ្មីមកកំណត់ចំណេញ។"
                  : "មិនទាន់អាច sync បានទេ។ មិនមានការបង្កើតផលិតផលក្លែងក្លាយឡើយ។"}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={syncingTopup || (!loading && !ready)}
          onClick={onSyncTopup}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {syncingTopup ? (
            <ActivityLoader size={16} color="#ffffff" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Sync catalog
        </button>
      </div>
    </div>
  );
}
