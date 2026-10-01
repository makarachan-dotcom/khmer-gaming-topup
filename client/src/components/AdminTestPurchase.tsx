import { useMemo, useState } from "react";
import { FlaskConical, ShieldAlert } from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  ADMIN_TEST_ORDER_DAILY_LIMIT,
  ADMIN_TEST_ORDER_PRICE_USD,
} from "@shared/adminTestOrder";

type CatalogGame = {
  id: string;
  titleEn: string;
  titleKh: string;
  requiresZone?: boolean | null;
  isActive?: boolean | null;
  packages?: Array<{
    id: string;
    amountLabel: string;
    isActive?: boolean | null;
  }>;
};

const needsZoneForGame = (game: CatalogGame) =>
  Boolean(game.requiresZone) ||
  /mobile[\s_-]*legends/i.test(`${game.titleEn} ${game.titleKh}`);

export function AdminTestPurchasePanel() {
  const catalog = trpc.admin.testOrderCatalog.useQuery();
  const history = trpc.admin.testOrders.useQuery({ limit: 20 });
  const utils = trpc.useUtils();

  const [gameId, setGameId] = useState("");
  const [packageId, setPackageId] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [purchaseCode, setPurchaseCode] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
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
    const rows = history.data ?? [];
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return rows.filter(row => new Date(row.createdAt).getTime() >= cutoff).length;
  }, [history.data]);
  const remaining = Math.max(ADMIN_TEST_ORDER_DAILY_LIMIT - usedToday, 0);

  const createTestOrder = trpc.admin.createTestOrder.useMutation({
    onSuccess: data => {
      setResult({
        orderNumber: data.orderNumber,
        trackingCode: data.trackingCode,
        packageName: data.packageName,
      });
      setError(null);
      setAcknowledged(false);
      setPurchaseCode("");
      void utils.admin.testOrders.invalidate();
      void catalog.refetch();
    },
    onError: issue => {
      setError(issue.message || "មិនអាចបង្កើត test order បានទេ");
      setResult(null);
    },
  });

  const busy = createTestOrder.isPending;
  const canSubmit =
    !busy &&
    acknowledged &&
    selectedPackage &&
    playerId.trim().length >= 2 &&
    purchaseCode.length >= 1 &&
    (!needsZone || zoneId.trim().length >= 1) &&
    remaining > 0;

  const submit = async () => {
    if (!canSubmit || !selectedPackage) return;
    if (
      !window.confirm(
        `ទិញសាកល្បង "${selectedGame?.titleEn} • ${selectedPackage.amountLabel}" តម្លៃ $${ADMIN_TEST_ORDER_PRICE_USD} សម្រាប់ Player ID ${playerId.trim()}${needsZone ? ` / Zone ${zoneId.trim()}` : ""} មែនទេ? Top-up ពិតនឹងត្រូវបញ្ជូនទៅ provider។`,
      )
    )
      return;
    setError(null);
    setResult(null);
    await createTestOrder.mutateAsync({
      packageId: selectedPackage.id,
      playerId: playerId.trim(),
      zoneId: needsZone ? zoneId.trim() : undefined,
      purchaseCode,
    });
  };

  const inputClass =
    "h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-400";

  return (
    <article className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">
          ADMIN ONLY
        </span>
        <span className="rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-950">
          TEST • $${ADMIN_TEST_ORDER_PRICE_USD}
        </span>
      </div>
      <h2 className="mt-3 flex items-center gap-2 font-display text-lg font-bold text-slate-950">
        <FlaskConical className="h-5 w-5 text-amber-600" />
        ទិញសាកល្បងសម្រាប់ Admin — $${ADMIN_TEST_ORDER_PRICE_USD}
      </h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-700">
        ជ្រើសរើសកញ្ចប់ណាមួយនៅលើវេបសាយ រួចទិញសាកល្បងក្នុងតម្លៃថេរ{" "}
        <span className="font-bold text-emerald-700">$${ADMIN_TEST_ORDER_PRICE_USD}</span> ដោយមិនចាំបាច់បង់ប្រាក់។
        Top-up ពិតនឹងត្រូវបញ្ជូនទៅ provider តាមផ្លូវធម្មតា។ សល់{" "}
        <span className="font-bold">{remaining}/{ADMIN_TEST_ORDER_DAILY_LIMIT}</span> ដងក្នុង 24 ម៉ោង។
      </p>

      {catalog.isLoading ? (
        <p className="mt-4 text-xs text-slate-500">កំពុងទាញកាតាឡុក…</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">ហ្គេម</span>
            <select
              className={inputClass}
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
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">កញ្ចប់</span>
            <select
              className={inputClass}
              value={packageId}
              disabled={!selectedGame}
              onChange={event => {
                setPackageId(event.target.value);
                setResult(null);
              }}
            >
              <option value="">— ជ្រើសរើសកញ្ចប់ —</option>
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.amountLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-bold text-slate-600">Player ID</span>
            <input
              className={inputClass}
              value={playerId}
              onChange={event => setPlayerId(event.target.value)}
              placeholder="Player ID"
              maxLength={128}
            />
          </label>
          {needsZone ? (
            <label className="block">
              <span className="mb-1 block text-xs font-bold text-slate-600">Zone / Server ID</span>
              <input
                className={inputClass}
                value={zoneId}
                onChange={event => setZoneId(event.target.value)}
                placeholder="Zone ID"
                maxLength={128}
              />
            </label>
          ) : null}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-bold text-slate-600">
              លេខកូដទិញសាកល្បង <span className="font-normal text-slate-400">(ត្រូវបញ្ចូលម្ដងទៀតរាល់ការទិញ)</span>
            </span>
            <input
              type="password"
              className={inputClass}
              value={purchaseCode}
              onChange={event => setPurchaseCode(event.target.value)}
              placeholder="Purchase code"
              maxLength={128}
              autoComplete="off"
            />
          </label>
        </div>
      )}

      <label className="mt-4 flex max-w-3xl items-start gap-2 text-xs font-semibold text-slate-700">
        <input
          type="checkbox"
          checked={acknowledged}
          disabled={busy}
          onChange={event => setAcknowledged(event.target.checked)}
          className="mt-0.5"
        />
        ខ្ញុំយល់ថា test order នេះគិតថ្លៃតែ $${ADMIN_TEST_ORDER_PRICE_USD} ហើយ top-up
        ពិតនឹងត្រូវបញ្ជូនទៅកាន់គណនីហ្គេមខាងលើ។
      </label>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="mt-3 inline-flex h-11 items-center justify-center rounded-xl bg-slate-950 px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
      >
        {busy ? "កំពុងបង្កើត…" : `ទិញសាកល្បង — $${ADMIN_TEST_ORDER_PRICE_USD}`}
      </button>

      {error ? (
        <p className="mt-3 flex max-w-3xl items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-6 text-emerald-950">
          <p className="font-bold">បានបង្កើត test order ជោគជ័យ — $${ADMIN_TEST_ORDER_PRICE_USD}</p>
          <p>កញ្ចប់៖ {result.packageName}</p>
          <p>Order №៖ {result.orderNumber}</p>
          <p>Tracking៖ {result.trackingCode}</p>
        </div>
      ) : null}

      {(history.data ?? []).length > 0 ? (
        <div className="mt-4 max-w-3xl">
          <p className="text-xs font-bold text-slate-600">ប្រវត្តិទិញសាកល្បងថ្មីៗ</p>
          <ul className="mt-2 divide-y divide-amber-100 rounded-xl border border-amber-100 bg-white">
            {(history.data ?? []).slice(0, 5).map(row => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[11px]">
                <span className="font-semibold text-slate-800">{row.packageName}</span>
                <span className="text-slate-500">
                  {row.playerId} · $${ADMIN_TEST_ORDER_PRICE_USD} · {new Date(row.createdAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
