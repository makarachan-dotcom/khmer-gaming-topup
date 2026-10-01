import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeDollarSign,
  Check,
  CheckCircle2,
  ChevronDown,
  Crown,
  Gamepad2,
  Gem,
  History,
  Lock,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ADMIN_PURCHASE_DAILY_LIMIT,
  ADMIN_PURCHASE_PRICE_USD,
} from "@shared/adminPurchase";

type CatalogGame = {
  id: string;
  titleEn: string;
  titleKh: string;
  requiresZone?: boolean | null;
  isActive?: boolean | null;
  packages?: Array<{
    id: string;
    amountLabel: string;
    priceUsd?: string | number | null;
    isActive?: boolean | null;
  }>;
};

type PurchaseHistoryRow = {
  id: string;
  packageName: string;
  playerId: string;
  priceUsd?: string | number | null;
  realPriceUsd?: string | number | null;
  createdAt: string | Date;
};

const formatUsd = (value: string | number | null | undefined) => {
  const num = Number(value);
  return Number.isFinite(num) ? `$${num.toFixed(2)}` : "—";
};

const needsZoneForGame = (game: CatalogGame) =>
  Boolean(game.requiresZone) ||
  /mobile[\s_-]*legends/i.test(`${game.titleEn} ${game.titleKh}`);

function StepHead({ n, kicker, title }: { n: string; kicker: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-600 text-xs font-extrabold text-slate-950 shadow-sm shadow-amber-500/40">
        {n}
      </span>
      <div>
        <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-700/80">{kicker}</p>
        <h3 className="font-display text-sm font-extrabold text-slate-900">{title}</h3>
      </div>
    </div>
  );
}

export function AdminPurchasePanel() {
  const catalog = trpc.admin.adminPurchaseCatalog.useQuery();
  const history = trpc.admin.adminPurchases.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const [gameId, setGameId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [purchaseCode, setPurchaseCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    orderNumber: string;
    trackingCode: string;
    packageName: string;
  } | null>(null);

  const games = useMemo(() => {
    const list = ((catalog.data as { games?: CatalogGame[] } | undefined)?.games ?? []).filter(
      game => game.isActive !== false && (game.packages ?? []).some(pkg => pkg.isActive !== false),
    );
    return list;
  }, [catalog.data]);

  const selectedGame = useMemo(
    () => games.find(game => game.id === gameId) ?? null,
    [games, gameId],
  );
  const packages = useMemo(
    () => (selectedGame?.packages ?? []).filter(pkg => pkg.isActive !== false),
    [selectedGame],
  );
  const needsZone = selectedGame ? needsZoneForGame(selectedGame) : false;
  const selectedPackage = useMemo(
    () => packages.find(pkg => pkg.id === packageId) ?? null,
    [packages, packageId],
  );

  const usedToday = useMemo(() => {
    const rows = (history.data ?? []) as PurchaseHistoryRow[];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return rows.filter(row => new Date(row.createdAt).getTime() >= cutoff).length;
  }, [history.data]);
  const remaining = Math.max(ADMIN_PURCHASE_DAILY_LIMIT - usedToday, 0);
  const quotaPct = Math.min(100, (usedToday / ADMIN_PURCHASE_DAILY_LIMIT) * 100);

  const createAdminPurchase = trpc.admin.createAdminPurchase.useMutation({
    onSuccess: data => {
      setResult({
        orderNumber: data.orderNumber,
        trackingCode: data.trackingCode,
        packageName: data.packageName,
      });
      setError(null);
      setAcknowledged(false);
      setPurchaseCode("");
      void utils.admin.adminPurchases.invalidate();
      void catalog.refetch();
    },
    onError: issue => {
      setError(issue.message || "មិនអាចបង្កើតការបញ្ជាទិញបានទេ");
      setResult(null);
    },
  });

  const busy = createAdminPurchase.isPending;
  const canSubmit =
    !busy &&
    acknowledged &&
    selectedPackage &&
    playerId.trim().length >= 2 &&
    purchaseCode.length >= 1 &&
    (!needsZone || zoneId.trim().length >= 1) &&
    remaining > 0;

  const doPurchase = async () => {
    if (!canSubmit || !selectedPackage) return;
    setConfirmOpen(false);
    setError(null);
    setResult(null);
    await createAdminPurchase.mutateAsync({
      packageId: selectedPackage.id,
      playerId: playerId.trim(),
      zoneId: needsZone ? zoneId.trim() : undefined,
      purchaseCode,
    });
  };

  const inputClass =
    "h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 shadow-sm outline-none transition placeholder:font-normal placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200";

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="overflow-hidden rounded-3xl border border-amber-200/60 bg-white shadow-xl shadow-amber-100/50"
    >
      {/* ── Hero header ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-slate-950 px-5 py-6 text-white sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-amber-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-16 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl"
        />
        <Gem
          aria-hidden="true"
          className="pointer-events-none absolute right-6 top-6 h-10 w-10 rotate-12 text-amber-400/20"
        />
        <div className="relative flex items-start gap-4">
          <div className="grid h-13 w-13 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-3 shadow-lg shadow-amber-500/40">
            <Crown className="h-6 w-6 text-slate-950" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[10px] font-extrabold tracking-[0.16em] text-amber-300 ring-1 ring-amber-400/40">
                ADMIN ONLY
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-extrabold text-slate-950">
                <Sparkles className="h-3 w-3" />
                ADMIN PRICE • ${ADMIN_PURCHASE_PRICE_USD}
              </span>
            </div>
            <h2 className="mt-2 font-display text-xl font-extrabold tracking-tight">
              ទិញជា Admin
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-300">
              ជ្រើសរើសកញ្ចប់ណាមួយនៅលើវេបសាយ — ឯងនឹងឃើញតម្លៃពិតរបស់កញ្ចប់នីមួយៗ
              តែពេលបញ្ជាទិញគិតតែ{" "}
              <span className="font-extrabold text-amber-300">${ADMIN_PURCHASE_PRICE_USD}</span>{" "}
              ប៉ុណ្ណោះ។ ការបញ្ជាទិញជាការទិញពិត ហើយ top-up ពិតនឹងត្រូវបញ្ជូនទៅ provider តាមផ្លូវធម្មតា។
            </p>
          </div>
        </div>
        <div className="relative mt-4 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10 backdrop-blur">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="inline-flex items-center gap-1.5 text-slate-200">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-300" />
              កូតាទិញក្នុង 24 ម៉ោង
            </span>
            <span className="text-amber-300">
              សល់ {remaining}/{ADMIN_PURCHASE_DAILY_LIMIT} ដង
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 transition-all duration-500"
              style={{ width: `${quotaPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="space-y-6 bg-gradient-to-b from-amber-50/60 to-white px-5 py-6 sm:px-6">
        {catalog.isLoading ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-amber-200 bg-amber-50/50 py-10">
            <p className="text-xs font-semibold text-amber-800">កំពុងទាញកាតាឡុក…</p>
          </div>
        ) : (
          <>
            {/* Step 1 — game */}
            <section className="space-y-3">
              <StepHead n="1" kicker="SELECT GAME" title="ជ្រើសរើសហ្គេម" />
              <div className="relative">
                <Gamepad2 className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                <select
                  className={cn(inputClass, "appearance-none pr-10")}
                  value={gameId}
                  onChange={event => {
                    setGameId(event.target.value);
                    setPackageId("");
                    setResult(null);
                  }}
                >
                  <option value="">— ជ្រើសរើសហ្គេម —</option>
                  {games.map(game => (
                    <option key={game.id} value={game.id}>
                      {game.titleEn}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </section>

            {/* Step 2 — package cards */}
            <section className="space-y-3">
              <StepHead n="2" kicker="SELECT PACKAGE" title="ជ្រើសរើសកញ្ចប់" />
              {!selectedGame ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center">
                  <BadgeDollarSign className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-400">
                    ជ្រើសរើសហ្គេមជាមុនសិន ដើម្បីមើលកញ្ចប់
                  </p>
                </div>
              ) : packages.length === 0 ? (
                <p className="text-xs text-slate-500">ហ្គេមនេះមិនមានកញ្ចប់ទេ។</p>
              ) : (
                <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-0.5 sm:grid-cols-3">
                  {packages.map(pkg => {
                    const selected = pkg.id === packageId;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={() => {
                          setPackageId(pkg.id);
                          setResult(null);
                        }}
                        aria-pressed={selected}
                        className={cn(
                          "relative rounded-2xl border p-3 text-left transition-all duration-150 active:scale-[0.98]",
                          selected
                            ? "border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100/60 shadow-lg shadow-amber-200/60 ring-2 ring-amber-300"
                            : "border-slate-200 bg-white shadow-sm hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md",
                        )}
                      >
                        {selected ? (
                          <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 shadow">
                            <Check className="h-3 w-3 text-slate-950" strokeWidth={3} />
                          </span>
                        ) : null}
                        <p className="pr-6 text-xs font-extrabold leading-4 text-slate-900">
                          {pkg.amountLabel}
                        </p>
                        <p className="mt-1.5 text-[11px] font-medium text-slate-400 line-through">
                          {formatUsd(pkg.priceUsd)}
                        </p>
                        <p className="text-sm font-extrabold text-amber-600 drop-shadow-[0_0_8px_rgba(245,158,11,0.35)]">
                          ${ADMIN_PURCHASE_PRICE_USD}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Step 3 — player */}
            <section className="space-y-3">
              <StepHead n="3" kicker="PLAYER ACCOUNT" title="គណនីអ្នកលេង" />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                  <input
                    className={inputClass}
                    value={playerId}
                    onChange={event => setPlayerId(event.target.value)}
                    placeholder="Player ID"
                    maxLength={128}
                  />
                </div>
                {needsZone ? (
                  <div className="relative">
                    <Server className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                    <input
                      className={inputClass}
                      value={zoneId}
                      onChange={event => setZoneId(event.target.value)}
                      placeholder="Zone / Server ID"
                      maxLength={128}
                    />
                  </div>
                ) : null}
              </div>
            </section>

            {/* Step 4 — purchase code */}
            <section className="space-y-3">
              <StepHead n="4" kicker="SECURITY CODE" title="លេខកូដសុវត្ថិភាព" />
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-600" />
                <input
                  type="password"
                  className={cn(inputClass, "border-amber-200 bg-amber-50/40 focus:border-amber-400")}
                  value={purchaseCode}
                  onChange={event => setPurchaseCode(event.target.value)}
                  placeholder="លេខកូដទិញ (ត្រូវបញ្ចូលម្ដងទៀតរាល់ការទិញ)"
                  maxLength={128}
                  autoComplete="off"
                />
              </div>
            </section>
          </>
        )}

        {/* Order summary */}
        {selectedPackage ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="relative overflow-hidden rounded-2xl bg-slate-950 p-4 text-white shadow-lg shadow-slate-950/20"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-500/20 blur-2xl"
            />
            <p className="text-[10px] font-extrabold tracking-[0.18em] text-amber-300/90">
              សង្ខេបការបញ្ជាទិញ
            </p>
            <p className="mt-1.5 text-sm font-bold">
              {selectedGame?.titleEn} • {selectedPackage.amountLabel}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-slate-400">
                តម្លៃពិត៖ <span className="line-through">{formatUsd(selectedPackage.priceUsd)}</span>
              </span>
              <span className="text-slate-500">→</span>
              <span className="text-base font-extrabold text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.5)]">
                តម្លៃ admin: ${ADMIN_PURCHASE_PRICE_USD}
              </span>
            </div>
          </motion.div>
        ) : null}

        {/* Acknowledge */}
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-xs font-semibold leading-5 text-slate-700 shadow-sm transition hover:border-amber-300">
          <input
            type="checkbox"
            checked={acknowledged}
            disabled={busy}
            onChange={event => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-500 accent-amber-500"
          />
          <span>
            ខ្ញុំយល់ថាការទិញនេះគិតថ្លៃតែ{" "}
            <span className="font-extrabold text-amber-700">${ADMIN_PURCHASE_PRICE_USD}</span>{" "}
            (តម្លៃ admin) ហើយ top-up ពិតនឹងត្រូវបញ្ជូនទៅកាន់គណនីហ្គេមខាងលើ។
          </span>
        </label>

        {/* CTA */}
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => {
            if (canSubmit) setConfirmOpen(true);
          }}
          className="group relative h-13 w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-amber-400 to-amber-600 bg-[length:200%_100%] bg-left py-3.5 text-sm font-extrabold text-slate-950 shadow-lg shadow-amber-500/30 transition-all duration-300 hover:bg-right hover:shadow-xl hover:shadow-amber-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:from-slate-200 disabled:via-slate-200 disabled:to-slate-200 disabled:text-slate-400 disabled:shadow-none"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/50 to-transparent transition-transform duration-700 group-hover:translate-x-full group-disabled:hidden"
          />
          <span className="relative flex items-center justify-center gap-2">
            <Crown className="h-4 w-4" />
            {busy ? "កំពុងបង្កើត…" : `បញ្ជាទិញ — $${ADMIN_PURCHASE_PRICE_USD}`}
          </span>
        </button>

        {/* Error */}
        {error ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs leading-5 text-rose-900 shadow-sm"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
            {error}
          </motion.p>
        ) : null}

        {/* Success */}
        {result ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-md shadow-emerald-100"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-md shadow-emerald-500/30">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </span>
              <div className="min-w-0 text-xs leading-6 text-emerald-950">
                <p className="font-display text-sm font-extrabold">
                  បានបញ្ជាទិញជោគជ័យ — ${ADMIN_PURCHASE_PRICE_USD}
                </p>
                <p>កញ្ចប់៖ {result.packageName}</p>
                <p>
                  Order №៖ <span className="font-bold">{result.orderNumber}</span>
                </p>
                <p>
                  Tracking៖ <span className="font-bold">{result.trackingCode}</span>
                </p>
              </div>
            </div>
          </motion.div>
        ) : null}

        {/* History */}
        {(history.data ?? []).length > 0 ? (
          <section className="space-y-2.5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-amber-600" />
              <p className="font-display text-sm font-extrabold text-slate-900">ប្រវត្តិទិញថ្មីៗ</p>
            </div>
            <ul className="divide-y divide-amber-100/70 overflow-hidden rounded-2xl border border-amber-100 bg-white shadow-sm">
              {((history.data ?? []) as PurchaseHistoryRow[]).slice(0, 5).map(row => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-[11px] transition hover:bg-amber-50/50"
                >
                  <span className="font-bold text-slate-800">{row.packageName}</span>
                  <span className="text-slate-500">
                    {row.playerId} · <span className="line-through">{formatUsd(row.realPriceUsd)}</span>
                    {" → "}
                    <span className="font-extrabold text-amber-600">${ADMIN_PURCHASE_PRICE_USD}</span>
                    {" · "}
                    {new Date(row.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {/* ── Confirm dialog ──────────────────────────────────────── */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="rounded-3xl border-amber-200">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-600 shadow-md shadow-amber-500/30">
                <Crown className="h-5 w-5 text-slate-950" />
              </span>
              <div>
                <AlertDialogTitle className="font-display text-base font-extrabold text-slate-950">
                  បញ្ជាក់ការបញ្ជាទិញ
                </AlertDialogTitle>
                <AlertDialogDescription className="text-xs">
                  ការបញ្ជាទិញជាការទិញពិត — top-up នឹងត្រូវបញ្ជូនទៅ provider។
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          {selectedPackage ? (
            <div className="rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-white">
              <p className="font-bold">
                {selectedGame?.titleEn} • {selectedPackage.amountLabel}
              </p>
              <p className="text-slate-300">
                Player ID៖ <span className="font-bold text-white">{playerId.trim()}</span>
                {needsZone ? (
                  <>
                    {" "}· Zone៖ <span className="font-bold text-white">{zoneId.trim()}</span>
                  </>
                ) : null}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-2">
                <span className="text-slate-400">
                  តម្លៃពិត <span className="line-through">{formatUsd(selectedPackage.priceUsd)}</span>
                </span>
                <span className="text-slate-500">→</span>
                <span className="text-sm font-extrabold text-amber-300">
                  តម្លៃ admin ${ADMIN_PURCHASE_PRICE_USD}
                </span>
              </p>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">បោះបង់</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void doPurchase()}
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 font-extrabold text-slate-950 shadow-md shadow-amber-500/30 hover:from-amber-400 hover:to-amber-300"
            >
              បញ្ជាក់ទិញ — ${ADMIN_PURCHASE_PRICE_USD}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.article>
  );
}
