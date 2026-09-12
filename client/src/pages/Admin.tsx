import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminDigitalServices } from "@/components/AdminDigitalServices";
import { AdminDeliveryForm } from "@/components/AdminDeliveryForm";
import { ServiceLogo } from "@/components/BrandMark";
import { isCdkOrder, readAdminCdkToken } from "@shared/cdkToken";
import { formatUsd } from "@/lib/display";
import { prepareAdminImage } from "@/lib/adminImageUpload";
import { trpc } from "@/lib/trpc";
import { CalendarClock, Check, CircleAlert, Copy, CreditCard, Gift, PackageCheck, Radio, ShieldAlert, ShieldCheck, ShoppingBag, SkipForward, Ticket, Trash2, Trophy, Upload, UsersRound, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useLocation } from "wouter";
import { LoadingV2 } from "@/components/OutlineLoader";

const adminEmail = "chanmakara672@gmail.com";
const tabs = ["overview", "orders", "listings", "catalog", "digital", "operations"] as const;
type Tab = (typeof tabs)[number];
const tabPermissions: Record<Tab, "dashboard" | "orders" | "catalog" | "marketplace" | "operations"> = { overview: "dashboard", orders: "orders", listings: "marketplace", catalog: "catalog", digital: "catalog", operations: "operations" };
export default function Admin() { const { loading, user } = useAuth(); const [location] = useLocation(); const requestedTab = new URLSearchParams(location.split("?")[1] ?? "").get("tab"); const [tab, setTab] = useState<Tab>(() => tabs.includes(requestedTab as Tab) ? requestedTab as Tab : "overview"); useEffect(() => { if (tabs.includes(requestedTab as Tab)) setTab(requestedTab as Tab); }, [requestedTab]); const isOwner = user?.email?.toLowerCase() === adminEmail; const isAdmin = isOwner || user?.role === "admin"; if (loading) return <div className="min-h-screen bg-slate-50" />; if (!isAdmin) return <AdminDenied />; return <DashboardLayout><AdminWorkspace tab={tab} onTab={setTab} isOwner={isOwner} /></DashboardLayout>; }
function AdminDenied() { return <div className="grid min-h-screen place-items-center bg-slate-50 p-4"><div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-xl shadow-slate-200/50"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 font-display text-xl font-bold text-slate-950">Admin access only</h1><p className="mt-2 text-sm leading-6 text-slate-600">This workspace is restricted to the designated administrator account.</p></div></div>; }
function AdminWorkspace({ tab, onTab, isOwner }: { tab: Tab; onTab: (tab: Tab) => void; isOwner: boolean }) { const access = trpc.admin.myPermissions.useQuery(); const allowedTabs = tabs.filter((item) => Boolean(access.data?.isOwner || access.data?.permissions.includes(tabPermissions[item]))); const visibleTab = allowedTabs.includes(tab) ? tab : (allowedTabs[0] ?? "overview"); useEffect(() => { if (!access.isLoading && !allowedTabs.includes(tab) && allowedTabs[0]) onTab(allowedTabs[0]); }, [access.isLoading, allowedTabs.join(","), onTab, tab]); const overview = trpc.admin.overview.useQuery(undefined, { enabled: visibleTab === "overview" }); return <div className="mx-auto max-w-7xl pb-10"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">ADMINISTRATION</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">ផ្ទាំងគ្រប់គ្រងហាង</h1><p className="mt-2 text-sm text-slate-500">គ្រប់គ្រងការកម្មង់, ទីផ្សារគណនី, តម្លៃសេវា និងប្រតិបត្តិការហាង។</p></div><div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800"><ShieldCheck className="h-4 w-4" />{isOwner ? "Owner admin mode" : "Administrator mode"}</div></div><div className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1">{allowedTabs.map((item) => <button key={item} onClick={() => onTab(item)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${visibleTab === item ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500"}`}>{labelForTab(item)}</button>)}</div>{overview.error ? <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 p-3 text-xs leading-5 text-rose-900"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />មិនអាចទាញទិន្នន័យ Admin បានទេ។ សូម refresh ឬពិនិត្យការភ្ជាប់ server រួចព្យាយាមម្ដងទៀត។</div> : null}{visibleTab === "overview" && <><StorefrontUiControl isOwner={isOwner} /><Overview data={overview.data} loading={overview.isLoading} /><SalesTrend data={overview.data?.salesTrend ?? []} /></>}{visibleTab === "orders" && <Orders />}{visibleTab === "listings" && <Listings />}{visibleTab === "catalog" && <Catalog isOwner={isOwner} />}{visibleTab === "digital" && <AdminDigitalServices />}{visibleTab === "operations" && <Operations />}</div>; }
function StorefrontUiControl({ isOwner }: { isOwner: boolean }) {
  const utils = trpc.useUtils();
  const current = trpc.content.storefrontUi.useQuery();
  const save = trpc.admin.setStorefrontUi.useMutation({
    onSuccess: (result) => {
      const ui = result.ui === "gamer" ? "gamer" : "classic";
      document.documentElement.setAttribute("data-ui", ui);
      try { document.cookie = `zurs-ui=${ui}; Path=/; Max-Age=31536000; SameSite=Lax`; } catch { /* private mode */ }
      if (ui === "classic") {
        document.documentElement.setAttribute("data-theme", "light");
        document.documentElement.style.colorScheme = "light";
      }
      void utils.content.storefrontUi.invalidate();
    },
  });
  const ui = current.data?.ui === "gamer" ? "gamer" : "classic";
  const pick = (next: "classic" | "gamer") => {
    if (!isOwner || save.isPending || next === ui) return;
    save.mutate({ ui: next });
  };
  return (
    <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm sm:p-5">
      <p className="text-[10px] font-extrabold tracking-[0.14em] text-amber-800">STOREFRONT UI</p>
      <h2 className="mt-1 text-sm font-bold text-slate-950">ប្ដូររូបរាងហាងសាធារណៈ</h2>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-600">Classic គឺ UI ចាស់ដែលអតិថិជនស្គាល់។ Gamer គឺ UI ថ្មី (dark + ៣ជំហាន)។ មានតែ Owner ទេដែលប្ដូរបាន ហើយវាអនុវត្តលើគ្រប់អ្នកទិញ។</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!isOwner || save.isPending} onClick={() => pick("classic")} className={`h-10 rounded-xl px-4 text-xs font-bold ${ui === "classic" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Classic · UI ចាស់</button>
        <button type="button" disabled={!isOwner || save.isPending} onClick={() => pick("gamer")} className={`h-10 rounded-xl px-4 text-xs font-bold ${ui === "gamer" ? "bg-slate-950 text-white" : "border border-slate-200 bg-white text-slate-700"}`}>Gamer · UI ថ្មី</button>
      </div>
      <p className="mt-2 text-[11px] font-semibold text-slate-500">{isOwner ? (save.isPending ? "កំពុងរក្សាទុក…" : ui === "gamer" ? "អតិថិជនកំពុងឃើញ UI ថ្មី" : "អតិថិជនកំពុងឃើញ UI ចាស់") : "Owner only"}</p>
      {save.error ? <p className="mt-2 text-xs font-semibold text-rose-700">{save.error.message}</p> : null}
    </section>
  );
}
function Overview({ data, loading }: { data: { orders: number; pendingOrders: number; paidOrders: number; revenue: string; pendingListings: number; totalUsers: number } | undefined; loading: boolean }) { const cards = [{ label: "ការកម្មង់សរុប", value: data?.orders ?? 0, icon: ShoppingBag, style: "bg-indigo-50 text-indigo-700" }, { label: "រង់ចាំទូទាត់", value: data?.pendingOrders ?? 0, icon: CreditCard, style: "bg-amber-50 text-amber-700" }, { label: "ការផ្សាយរង់ចាំ", value: data?.pendingListings ?? 0, icon: CircleAlert, style: "bg-fuchsia-50 text-fuchsia-700" }, { label: "ចំណូលបានបង់", value: formatUsd(data?.revenue ?? "0"), icon: PackageCheck, style: "bg-emerald-50 text-emerald-700" }]; return <section className="mt-6">{loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map((item) => <div key={item} className="h-28 animate-pulse rounded-2xl bg-slate-200" />)}</div> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, style }) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className={`grid h-9 w-9 place-items-center rounded-xl ${style}`}><Icon className="h-4 w-4" /></div><p className="mt-4 font-display text-2xl font-bold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div>)}</div>}<div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold text-slate-900">ស្ថានភាពហាង</h2><p className="mt-2 text-sm leading-7 text-slate-600">កាតាឡុក, ការកម្មង់ និងទីផ្សារគណនីត្រូវបានភ្ជាប់ទៅទិន្នន័យហាង។ ការផ្សាយថ្មីបង្ហាញភ្លាមៗ ហើយអ្នកអាច Hold ឬលុបវាពីផ្ទាំងការផ្សាយបាន។</p></div><div className="rounded-2xl bg-slate-950 p-5 text-white"><p className="text-xs font-bold tracking-[0.13em] text-indigo-300">PAYMENT STATUS</p><p className="mt-3 font-display text-lg font-bold">ACLEDA ToanChetPay</p><p className="mt-2 text-xs leading-6 text-slate-400">នៅស្ថានភាពរង់ចាំការកំណត់ Merchant sandbox credentials។ គ្មាន order ណាមួយត្រូវបានសម្គាល់ថាបង់រួចដោយគ្មានការបញ្ជាក់ពីអ្នកផ្តល់សេវាទេ។</p></div></div></section>; }
function isPartnerOrder(details: unknown) {
  if (!details || typeof details !== "object") return false;
  const row = details as Record<string, unknown>;
  return row.kind === "partner_service" || row.adminQueue === "partner_service";
}

function Orders() {
  const orders = trpc.admin.orders.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.admin.updateOrderStatus.useMutation({ onSuccess: () => utils.admin.orders.invalidate() });
  const [filter, setFilter] = useState<"all" | "game" | "digital">("digital");
  const all = orders.data ?? [];
  const digitalPending = all.filter(({ order }) => isPartnerOrder(order.details) && order.status === "paid").length;
  const rows = all.filter(({ order }) => {
    const partner = isPartnerOrder(order.details);
    if (filter === "digital") return partner;
    if (filter === "game") return !partner;
    return true;
  }).sort((a, b) => {
    const rank = (row: typeof a) => (isPartnerOrder(row.order.details) && row.order.status === "paid" ? 0 : 1);
    return rank(a) - rank(b);
  });
  const chip = (id: typeof filter, label: string) => (
    <button type="button" onClick={() => setFilter(id)} className={`h-8 rounded-full px-3 text-[11px] font-bold ${filter === id ? "bg-slate-950 text-white" : "bg-slate-100 text-slate-600"}`}>{label}</button>
  );
  return (
    <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">ការកម្មង់</h2>
          <p className="mt-1 text-xs text-slate-500">សេវាឌីជីថលដែលបានបង់ ត្រូវបំពេញដោយដៃក្នុង ៥–១០ នាទី។</p>
        </div>
        <div className="flex flex-wrap gap-1">{chip("digital", digitalPending ? `សេវាឌីជីថល · ${digitalPending}` : "សេវាឌីជីថល")}{chip("game", "ហ្គេម")}{chip("all", "ទាំងអស់")}</div>
      </div>
      {orders.isLoading ? <div className="p-8 text-center"><LoadingV2 size={20} color="#4f46e5" className="mx-auto h-5 w-5 text-indigo-600" /></div> : !rows.length ? <Empty text="មិនទាន់មានការកម្មង់ទេ។" /> : (
        <div className="divide-y divide-slate-100">
          {rows.map(({ order, user }) => {
            const partner = isPartnerOrder(order.details);
            const details = (order.details && typeof order.details === "object" ? order.details : {}) as Record<string, unknown>;
            const note = typeof details.customerNote === "string" ? details.customerNote : "";
            const delivery = typeof details.partnerDeliveryType === "string" ? details.partnerDeliveryType : "";
            const needsFulfillment = partner && order.status === "paid";
            const cdkToken = readAdminCdkToken(details);
            const cdk = isCdkOrder(details);
            return (
              <article key={order.id} className={`p-4 ${needsFulfillment ? "bg-amber-50/70" : ""}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
                  {partner ? <ServiceLogo text={order.productName} size={28} /> : <ShoppingBag className="h-4 w-4 text-slate-500" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-bold text-indigo-700">{order.orderNumber}</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{order.productName}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{user?.email ?? user?.name ?? "—"}{partner ? ` · ${delivery || "Digital"}` : ""}{needsFulfillment ? " · ត្រូវបំពេញ" : ""}</p>
                  {note ? <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{note}</p> : null}
                </div>
                <strong className="text-sm font-extrabold text-slate-950">{formatUsd(order.subtotal)}</strong>
                {!partner && needsFulfillment ? (
                  <button type="button" disabled={update.isPending} onClick={() => update.mutate({ orderId: order.id, status: "delivered" })} className="h-8 rounded-lg bg-emerald-600 px-2.5 text-[10px] font-bold text-white disabled:opacity-40">បំពេញហើយ</button>
                ) : null}
                <select value={order.status} disabled={update.isPending} onChange={(event) => update.mutate({ orderId: order.id, status: event.target.value as "pending" | "awaiting_payment" | "paid" | "delivered" | "failed" | "expired" | "refunded" })} className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-bold text-slate-700">
                  {["pending", "awaiting_payment", "paid", "delivered", "failed", "expired", "refunded"].map((status) => <option key={status}>{status}</option>)}
                </select>
                </div>
                {cdk ? <AdminCdkPanel orderId={order.id} token={cdkToken} submitted={Boolean(details.cdkTokenSubmitted)} paid={order.status === "paid"} /> : null}
                {partner && (order.status === "paid" || order.status === "delivered") ? (
                  <AdminDeliveryForm orderId={order.id} defaultMethod={delivery} productName={order.productName} />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
function AdminCdkPanel({ orderId, token, submitted, paid }: { orderId: string; token: string | null; submitted: boolean; paid: boolean }) {
  const utils = trpc.useUtils();
  const upgrade = trpc.admin.confirmCdkUpgrade.useMutation({ onSuccess: () => void utils.admin.orders.invalidate() });
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch { /* clipboard can be blocked */ }
  };
  return (
    <div className="zurs-cdk-admin">
      <p>{submitted ? "Token ពីអតិថិជន" : "រង់ចាំ token ពីអតិថិជន"}</p>
      {token ? (
        <>
          <code>{token}</code>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void copy()}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}Copy token</button>
            {paid ? <button type="button" disabled={upgrade.isPending} onClick={() => upgrade.mutate({ orderId })}>Plan បាន upgrade</button> : null}
          </div>
        </>
      ) : <p className="!font-semibold !text-amber-700">អតិថិជនមិនទាន់ paste token។</p>}
      {upgrade.isSuccess ? <p className="mt-2 !font-semibold !text-emerald-700">Plan បាន upgrade។ អតិថិជនឃើញក្នុងគណនី។</p> : null}
      {upgrade.error ? <p className="mt-2 !font-semibold !text-rose-700">{upgrade.error.message}</p> : null}
    </div>
  );
}
function Listings() {
  const listings = trpc.admin.listings.useQuery();
  const utils = trpc.useUtils();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const review = trpc.admin.reviewListing.useMutation({ onSuccess: () => { utils.admin.listings.invalidate(); utils.admin.overview.invalidate(); } });
  const remove = trpc.admin.deleteListing.useMutation({ onSuccess: () => { utils.admin.listings.invalidate(); utils.admin.overview.invalidate(); } });
  const busy = review.isPending || remove.isPending;
  return <section className="mt-6"><div className="mb-3"><h2 className="text-sm font-bold text-slate-900">Marketplace listing control</h2><p className="mt-1 text-xs text-slate-500">All seller account requests appear here immediately. You can see the required listing and seller information, then publish, hold, reject, or permanently delete any listing.</p></div>{listings.isLoading ? <div className="grid gap-3 md:grid-cols-2">{[1,2].map((item) => <div key={item} className="h-52 animate-pulse rounded-2xl bg-slate-200" />)}</div> : !listings.data?.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white"><Empty text="No seller account requests have been submitted yet." /></div> : <div className="grid gap-3 xl:grid-cols-2">{listings.data.map(({ listing, seller }) => { const note = notes[listing.id] ?? listing.reviewNote ?? ""; return <article key={listing.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><div><span className="rounded-full bg-fuchsia-50 px-2 py-1 text-[10px] font-bold text-fuchsia-700">{listing.listingType}</span><h3 className="mt-3 font-display font-bold text-slate-950">{listing.title}</h3><p className="mt-1 text-xs text-slate-500">{listing.game} • {listing.rankLevel}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${listing.status === "approved" ? "bg-emerald-50 text-emerald-700" : listing.status === "closed" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{listing.status === "closed" ? "on hold" : listing.status}</span></div><div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 sm:grid-cols-2"><p><b>Seller:</b> {seller?.name ?? "Member"}</p><p><b>Email:</b> {seller?.email ?? "Not available"}</p><p><b>Price:</b> {listing.priceUsd ? `$${listing.priceUsd}` : "Not specified"}</p><p><b>Contact:</b> {listing.contactMethod}</p><p><b>Telegram:</b> {listing.telegramUsername ? `@${listing.telegramUsername.replace(/^@/, "")}` : "Not provided"}</p><p><b>Screenshots:</b> {Array.isArray(listing.screenshots) ? listing.screenshots.length : 0}</p><p className="whitespace-pre-wrap leading-5 sm:col-span-2"><b>Description:</b> {listing.description}</p></div><textarea value={note} onChange={(event) => setNotes((current) => ({ ...current, [listing.id]: event.target.value }))} rows={2} placeholder="Internal note" className="mt-3 w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs" /><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><button disabled={busy || listing.status === "approved"} onClick={() => review.mutate({ listingId: listing.id, status: "approved", reviewNote: note || undefined })} className="h-9 rounded-lg bg-emerald-600 text-xs font-bold text-white disabled:opacity-50">Publish</button><button disabled={busy || listing.status === "closed"} onClick={() => review.mutate({ listingId: listing.id, status: "closed", reviewNote: note || "Placed on hold by administrator" })} className="h-9 rounded-lg bg-amber-500 text-xs font-bold text-white disabled:opacity-50">Hold</button><button disabled={busy || listing.status === "rejected"} onClick={() => review.mutate({ listingId: listing.id, status: "rejected", reviewNote: note || undefined })} className="h-9 rounded-lg bg-slate-700 text-xs font-bold text-white disabled:opacity-50">Reject</button><button disabled={busy} onClick={() => { if (window.confirm(`Delete “${listing.title}” permanently?`)) remove.mutate({ listingId: listing.id }); }} className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-rose-600 text-xs font-bold text-white disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" />Delete</button></div></article>; })}</div>}</section>;
}
function Catalog({ isOwner }: { isOwner: boolean }) { const catalog = trpc.admin.catalog.useQuery(); const utils = trpc.useUtils(); const updatePackage = trpc.admin.updateGamePackage.useMutation({ onSuccess: () => { utils.admin.catalog.invalidate(); utils.catalog.games.invalidate(); } }); return <section className="mt-6"><AdminOnlyMlbbTestOffer isOwner={isOwner} /><div className="mt-5 grid gap-5"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">កញ្ចប់ហ្គេម</h2></div>{catalog.data?.games.map((game) => <div key={game.id} className="border-b border-slate-100 p-4 last:border-0"><p className="font-display text-sm font-bold text-slate-900">{game.titleKh}</p><div className="mt-3 space-y-2">{game.packages.map((pkg) => <PriceRow key={pkg.id} label={`${pkg.amountLabel} ${game.currencyLabel}`} price={pkg.priceUsd} active={pkg.isActive} onSave={(price, active) => updatePackage.mutate({ packageId: pkg.id, priceUsd: price, isActive: active, featured: pkg.featured })} />)}</div></div>)}</div></div></section>; }
function AdminOnlyMlbbTestOffer({ isOwner }: { isOwner: boolean }) {
  const [, setLocation] = useLocation();
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createTestOrder = trpc.orders.createAdminKhqrTest.useMutation();
  const beginPayment = trpc.orders.beginPayment.useMutation();
  const busy = createTestOrder.isPending || beginPayment.isPending;
  const startTest = async () => {
    if (!isOwner || !acknowledged || busy) return;
    if (!window.confirm("បង្កើត Admin KHQR Test Product តម្លៃ $0.02 និង KHQR ពិតសម្រាប់សាកល្បងមែនទេ? កុំស្កេន QR ប្រសិនបើអ្នកមិនចង់ទូទាត់ពិត។")) return;
    try {
      setError(null);
      const order = await createTestOrder.mutateAsync();
      const session = await beginPayment.mutateAsync({ orderId: order.id });
      setLocation(`/checkout/${session.order.id}`);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "មិនអាចបង្កើត KHQR Test Product បានទេ");
    }
  };
 return <article className="rounded-2xl border border-dashed border-amber-300 bg-amber-50 p-4 shadow-sm"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-white">ADMIN ONLY</span><span className="rounded-full bg-amber-200 px-2.5 py-1 text-[10px] font-bold text-amber-950">TEST • KHQR $0.02</span></div><h2 className="mt-3 font-display text-lg font-bold text-slate-950">Mobile Legends — KHQR Test Package</h2><p className="mt-1 text-sm font-bold text-emerald-700">$0.02 USD</p><p className="mt-2 max-w-3xl text-xs leading-5 text-slate-700">កញ្ចប់សាកល្បងនេះបង្ហាញ និងអាចប្រើបានសម្រាប់ Owner admin ប៉ុណ្ណោះ។ វាមិនស្ថិតក្នុង public/provider catalog ទេ។ បន្ទាប់ពី Bakong បញ្ជាក់ការទូទាត់ វាត្រូវបានបញ្ចប់ជា Test Product ដោយមិនបញ្ជូន top-up ពិតទៅ provider។</p></div><div className="shrink-0 rounded-xl border border-amber-200 bg-white p-3 text-xs"><label className="flex max-w-72 items-start gap-2 font-semibold text-slate-700"><input type="checkbox" checked={acknowledged} disabled={!isOwner || busy} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5" />ខ្ញុំយល់ថា KHQR នេះតម្លៃ $0.02 អាចទូទាត់ប្រាក់ពិត</label><button type="button" disabled={!isOwner || !acknowledged || busy} onClick={() => void startTest()} className="mt-3 inline-flex h-9 w-full items-center justify-center rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy ? "កំពុងរៀបចំ KHQR…" : isOwner ? "បង្កើត KHQR Test $0.02" : "Owner only"}</button>{error ? <p className="mt-2 max-w-72 text-[11px] leading-4 text-rose-700">{error}</p> : null}</div></div></article>; }
function PaymentLocationSettings() {
  const utils = trpc.useUtils();
  const content = trpc.admin.content.useQuery();
  const savedLocation = (content.data ?? []).find((item) => item.contentKey === "payment-location")?.bodyKh ?? "";
  const [location, setLocation] = useState(savedLocation);
  const save = trpc.admin.saveContent.useMutation({ onSuccess: () => { void utils.admin.content.invalidate(); void utils.content.active.invalidate(); } });
  useEffect(() => setLocation(savedLocation), [savedLocation]);
  const enabled = Boolean(location.trim());
  return <section className="xl:col-span-2 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm sm:p-5"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-950 text-amber-300"><CreditCard className="h-5 w-5" /></span><div><p className="text-[10px] font-extrabold tracking-[0.14em] text-amber-800">HOMEPAGE PAYMENT LOCATION</p><h2 className="mt-1 text-sm font-bold text-slate-950">អាសយដ្ឋានទទួលការទូទាត់</h2><p className="mt-1 text-xs leading-5 text-slate-600">អត្ថបទនេះបង្ហាញក្នុងផ្នែក ACCEPT PAYMENT នៅទំព័រដើម។ ទុកទទេដើម្បីមិនបង្ហាញអាសយដ្ឋានជាសាធារណៈ។</p></div></div><label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-700">Location / Address</span><textarea value={location} onChange={(event) => setLocation(event.target.value)} rows={2} maxLength={500} placeholder="ឧ. Phnom Penh, Cambodia · ទទួលការទូទាត់តាម KHQR" className="w-full resize-none rounded-xl border border-amber-200 bg-white p-3 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label><div className="mt-3 flex flex-wrap items-center gap-3"><button type="button" disabled={save.isPending} onClick={() => save.mutate({ contentKey: "payment-location", titleKh: "ACCEPT PAYMENT", bodyKh: location.trim() || undefined, isActive: enabled })} className="inline-flex h-10 items-center rounded-xl bg-slate-950 px-4 text-xs font-bold text-white transition hover:bg-slate-800 active:scale-[0.97] disabled:opacity-45">{save.isPending ? "កំពុងរក្សាទុក…" : "រក្សាទុកអាសយដ្ឋាន"}</button><span className={`text-xs font-semibold ${enabled ? "text-emerald-700" : "text-slate-500"}`}>{enabled ? "បង្ហាញជាសាធារណៈ" : "មិនបង្ហាញជាសាធារណៈ"}</span></div>{save.error ? <p className="mt-3 text-xs font-semibold text-rose-700">{save.error.message}</p> : null}</section>;
}

function Operations() { const payments = trpc.admin.payments.useQuery(); const users = trpc.admin.operationUsers.useQuery(); const content = trpc.admin.content.useQuery(); const utils = trpc.useUtils(); const saveContent = trpc.admin.saveContent.useMutation({ onSuccess: () => utils.admin.content.invalidate() }); const [key, setKey] = useState(""); const [title, setTitle] = useState(""); const [body, setBody] = useState(""); return <section className="mt-6 grid gap-5 xl:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">Payment transactions</h2></div>{payments.data?.length ? <div className="divide-y divide-slate-100">{payments.data.map(({ payment, order }) => <div key={payment.id} className="p-4 text-xs"><p className="font-bold text-slate-800">{order?.orderNumber ?? payment.orderId}</p><p className="mt-1 text-slate-500">{payment.provider} • {payment.status} • {formatUsd(payment.amount)}</p></div>)}</div> : <Empty text="មិនទាន់មានការទូទាត់។" />}</div><div className="rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">អ្នកប្រើប្រាស់</h2></div>{users.data?.length ? <div className="divide-y divide-slate-100">{users.data.map((user) => <div key={user.id} className="p-4 text-xs"><p className="font-bold text-slate-800">{user.name ?? "—"}</p><p className="mt-1 text-slate-500">{user.email ?? "No email"} • {user.role}</p></div>)}</div> : <Empty text="មិនទាន់មានអ្នកប្រើប្រាស់។" />}</div><div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-sm font-bold text-slate-900">មាតិកា និងប្រកាស</h2><p className="mt-1 text-xs text-slate-500">រក្សាទុក Banner copy, promotion, ឬ announcement ដោយប្រើ Content key ដែលសមស្រប។</p><div className="mt-4 grid gap-2 sm:grid-cols-2"><input value={key} onChange={(event) => setKey(event.target.value)} placeholder="ឧ. homepage-promotion" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs" /><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="ចំណងជើងជាភាសាខ្មែរ" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs" /></div><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="ខ្លឹមសារ ឬសេចក្តីប្រកាស" rows={3} className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs" /><button disabled={!key.trim() || saveContent.isPending} onClick={() => saveContent.mutate({ contentKey: key, titleKh: title || undefined, bodyKh: body || undefined, isActive: true })} className="mt-2 h-9 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-50">{saveContent.isPending ? "កំពុងរក្សាទុក…" : "រក្សាទុកមាតិកា"}</button>{content.data?.length ? <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-100">{content.data.map((item) => <div key={item.id} className="p-3 text-xs"><p className="font-bold text-slate-800">{item.contentKey}</p><p className="mt-1 text-slate-500">{item.titleKh ?? item.bodyKh ?? "(មិនមានខ្លឹមសារ)"}</p></div>)}</div> : null}</div></section>; }
function SpinSettingsEditor({ event, disabled, onSaved }: { event: { id: string; status: string; spinEnabled: boolean; minParticipantCount: number; winnerCount: number; consolationGiftCount: number }; disabled: boolean; onSaved: () => void }) { const [spinEnabled, setSpinEnabled] = useState(event.spinEnabled); const [threshold, setThreshold] = useState(String(event.minParticipantCount)); const [winnerCount, setWinnerCount] = useState(String(event.winnerCount)); const [consolationCount, setConsolationCount] = useState(String(event.consolationGiftCount)); const save = trpc.admin.saveLiveSpinSettings.useMutation({ onSuccess: onSaved }); useEffect(() => { setSpinEnabled(event.spinEnabled); setThreshold(String(event.minParticipantCount)); setWinnerCount(String(event.winnerCount)); setConsolationCount(String(event.consolationGiftCount)); }, [event.id, event.spinEnabled, event.minParticipantCount, event.winnerCount, event.consolationGiftCount]); return <div><div className="flex items-center gap-2"><Radio className="h-4 w-4 text-cyan-600" /><div><h3 className="text-sm font-bold text-slate-950">Spin Settings</h3><p className="mt-1 text-xs text-slate-500">Settings ទាំងនេះត្រូវបាន audit និង lock ជាមួយ fairness proof នៅពេល lock entries។</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700">SPIN ON/OFF<span className="mt-2 flex items-center gap-2 font-normal"><input type="checkbox" checked={spinEnabled} disabled={disabled} onChange={(e) => setSpinEnabled(e.target.checked)} />{spinEnabled ? "ON" : "OFF · tickets roll over"}</span></label><label className="text-xs font-bold text-slate-700">TICKET THRESHOLD<input inputMode="numeric" value={threshold} disabled={disabled} onChange={(e) => setThreshold(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><label className="text-xs font-bold text-slate-700">NUMBER OF WINNERS<input inputMode="numeric" value={winnerCount} disabled={disabled} onChange={(e) => setWinnerCount(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><label className="text-xs font-bold text-slate-700">CONSOLATION COUNT<input inputMode="numeric" value={consolationCount} disabled={disabled} onChange={(e) => setConsolationCount(e.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label></div><button type="button" disabled={disabled || save.isPending} onClick={() => save.mutate({ eventId: event.id, spinEnabled, minParticipantCount: Math.max(100, Number(threshold) || 100), winnerCount: Math.min(10, Math.max(1, Number(winnerCount) || 3)), consolationGiftCount: Math.min(10, Math.max(0, Number(consolationCount) || 10)) })} className="mt-3 h-9 rounded-lg bg-slate-950 px-3 text-xs font-bold text-white disabled:opacity-40">{save.isPending ? "កំពុងរក្សាទុក…" : "រក្សាទុក Spin Settings"}</button></div>; }

function ConsolationGiftEditor({ eventId, initial, disabled, onSaved }: { eventId: string; initial?: { nameKh: string; valueLabel: string; descriptionKh: string | null; mediaUrl: string | null; isActive: boolean }; disabled: boolean; onSaved: () => void }) { const [nameKh, setNameKh] = useState(initial?.nameKh ?? "កាដូលើកទឹកចិត្ត"); const [valueLabel, setValueLabel] = useState(initial?.valueLabel ?? "អំណោយសម្រាប់អ្នកចូលរួម"); const [descriptionKh, setDescriptionKh] = useState(initial?.descriptionKh ?? "ផ្តល់តាមរយៈពេលតភ្ជាប់ជាមួយ Live។"); const [isActive, setIsActive] = useState(initial?.isActive ?? true); const save = trpc.admin.saveLiveSpinConsolationGift.useMutation({ onSuccess: onSaved }); useEffect(() => { setNameKh(initial?.nameKh ?? "កាដូលើកទឹកចិត្ត"); setValueLabel(initial?.valueLabel ?? "អំណោយសម្រាប់អ្នកចូលរួម"); setDescriptionKh(initial?.descriptionKh ?? "ផ្តល់តាមរយៈពេលតភ្ជាប់ជាមួយ Live។"); setIsActive(initial?.isActive ?? true); }, [eventId, initial?.nameKh, initial?.valueLabel, initial?.descriptionKh, initial?.isActive]); return <div className="mt-6 border-t border-slate-100 pt-5"><div className="flex items-center gap-2"><Gift className="h-4 w-4 text-amber-500" /><div><h3 className="text-sm font-bold text-slate-950">Consolation Gift Content</h3><p className="mt-1 text-xs text-slate-500">កាដូមួយនេះត្រូវបានប្រើសម្រាប់អ្នកទទួល connection-duration consolation ទាំងអស់។</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><input value={nameKh} disabled={disabled} onChange={(e) => setNameKh(e.target.value)} placeholder="ឈ្មោះកាដូ" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs" /><input value={valueLabel} disabled={disabled} onChange={(e) => setValueLabel(e.target.value)} placeholder="តម្លៃ/ស្លាកកាដូ" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs" /></div><textarea value={descriptionKh} disabled={disabled} onChange={(e) => setDescriptionKh(e.target.value)} rows={2} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs" /><label className="mt-2 flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={isActive} disabled={disabled} onChange={(e) => setIsActive(e.target.checked)} />Active gift</label><button type="button" disabled={disabled || save.isPending || !nameKh.trim() || !valueLabel.trim()} onClick={() => save.mutate({ eventId, slotNumber: 1, nameKh, valueLabel, descriptionKh: descriptionKh || null, mediaUrl: initial?.mediaUrl ?? null, isActive })} className="mt-3 h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-950 disabled:opacity-40">{save.isPending ? "កំពុងរក្សាទុក…" : "រក្សាទុក Consolation Gift"}</button></div>; }

function PriceRow({ label, price, active, onSave }: { label: string; price: string; active: boolean; onSave: (price: string, active: boolean) => void }) { const [value, setValue] = useState(price); const [isActive, setIsActive] = useState(active); return <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2"><p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-700">{label}</p><input value={value} onChange={(event) => setValue(event.target.value)} className="h-8 w-20 rounded-lg border border-slate-200 bg-white px-2 text-xs" /><label className="flex items-center gap-1 text-[10px] text-slate-500"><input checked={isActive} onChange={(event) => setIsActive(event.target.checked)} type="checkbox" />Live</label><button onClick={() => onSave(value, isActive)} className="h-8 rounded-lg bg-slate-900 px-2 text-[10px] font-bold text-white">Save</button></div>; }
function Empty({ text }: { text: string }) { return <div className="p-8 text-center text-xs text-slate-500">{text}</div>; }
function SalesTrend({ data }: { data: { day: string; revenue: string; orders: number }[] }) { const peak = Math.max(1, ...data.map((item) => Number(item.revenue))); return <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-end justify-between"><div><h2 className="text-sm font-bold text-slate-900">ចំណូល 7 ថ្ងៃចុងក្រោយ</h2><p className="mt-1 text-xs text-slate-500">ផ្អែកលើការកម្មង់ដែលបានបង់ប្រាក់ ឬបញ្ចប់។</p></div><span className="text-xs font-bold text-indigo-700">Live data</span></div><div className="mt-5 grid h-32 grid-cols-7 items-end gap-2">{data.map((item) => <div className="flex h-full flex-col justify-end" key={item.day}><div className="rounded-t-md bg-gradient-to-t from-indigo-600 to-violet-400" style={{ height: `${Math.max(5, (Number(item.revenue) / peak) * 100)}%` }} title={`${item.day}: ${formatUsd(item.revenue)}`} /><p className="mt-2 text-center text-[9px] text-slate-500">{item.day.slice(5)}</p></div>)}</div></section>; }
function labelForTab(tab: Tab) { return ({ overview: "ទិដ្ឋភាពទូទៅ", orders: "ការកម្មង់", listings: "ការផ្សាយ", catalog: "កាតាឡុក", digital: "សេវាឌីជីថល", operations: "ប្រតិបត្តិការ" })[tab]; }

function nextSundayThreePm() {
  const now = new Date();
  const target = new Date(now);
  const daysUntilSunday = (7 - target.getDay()) % 7 || 7;
  target.setDate(target.getDate() + daysUntilSunday);
  target.setHours(15, 0, 0, 0);
  return new Date(target.getTime() - target.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function LiveSpinControl() {
  const utils = trpc.useUtils();
  const events = trpc.admin.liveSpinEvents.useQuery();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const activeEventId = selectedEventId || events.data?.[0]?.id || "";
  const detail = trpc.admin.liveSpinEventDetail.useQuery({ eventId: activeEventId }, { enabled: Boolean(activeEventId) });
  const [scheduledAt, setScheduledAt] = useState(nextSundayThreePm);
  const [adMediaUrl, setAdMediaUrl] = useState("");
  const [adDurationSeconds, setAdDurationSeconds] = useState("30");
  const adVideoInputRef = useRef<HTMLInputElement>(null);
  const adVideoUpload = trpc.uploads.adminLiveSpinMedia.useMutation();
  const [notice, setNotice] = useState<string | null>(null);
  const refresh = () => { void utils.admin.liveSpinEvents.invalidate(); if (activeEventId) void utils.admin.liveSpinEventDetail.invalidate({ eventId: activeEventId }); };
  const create = trpc.admin.createLiveSpinEvent.useMutation({ onSuccess: (result) => { setSelectedEventId(result.id); setNotice("បានបង្កើត Live Spin draft និង fairness commitment រួចរាល់។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const announce = trpc.admin.announceLiveSpinEvent.useMutation({ onSuccess: () => { setNotice("បានប្រកាស Live Spin រួចរាល់។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const lock = trpc.admin.lockLiveSpinParticipants.useMutation({ onSuccess: (result) => { setNotice(result.status === "skipped" ? "សប្តាហ៍នេះត្រូវបាន skip ព្រោះមិនទាន់ដល់ 100 អ្នកចូលរួម។ Tickets ត្រូវបាន roll over។" : "បាន lock participant snapshot និង fairness proof រួចរាល់។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const waiting = trpc.admin.startLiveSpinLobby.useMutation({ onSuccess: () => { setNotice("Waiting lobby បានបើករួចរាល់។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const goLive = trpc.admin.startLiveSpin.useMutation({ onSuccess: () => { setNotice("Live Spin បានចាប់ផ្តើម។ Server នឹងបន្ត phase តាម timestamps ដែលបានកត់ត្រា។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const advance = trpc.admin.advanceLiveSpinPhase.useMutation({ onSuccess: () => refresh(), onError: (issue) => setNotice(issue.message) });
  const end = trpc.admin.endLiveSpinEvent.useMutation({ onSuccess: () => { setNotice("Live Spin បានបញ្ចប់ និង audit record ត្រូវបានរក្សាទុក។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const skip = trpc.admin.skipLiveSpinWeek.useMutation({ onSuccess: () => { setNotice("បាន skip សប្តាហ៍នេះ; tickets ទាំងអស់ roll over ទៅ event បន្ទាប់។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const savePrize = trpc.admin.saveLiveSpinPrizeTier.useMutation({ onSuccess: () => { setNotice("បានរក្សាទុក prize tier។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const createTest = trpc.admin.createOwnerLiveSpinTestEvent.useMutation({ onSuccess: (result) => { setSelectedEventId(result.id); setNotice("បានបង្កើត Owner test event។ Customer អាចមើលបានតែប៉ុណ្ណោះ។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const addTestEntry = trpc.admin.addOwnerLiveSpinTestEntry.useMutation({ onSuccess: () => { setNotice("Owner test entry បានបន្ថែម។ អាច Lock entries រួចបន្ត flow បាន។"); refresh(); }, onError: (issue) => setNotice(issue.message) });
  const event = detail.data?.event;
  const busy = create.isPending || createTest.isPending || addTestEntry.isPending || announce.isPending || lock.isPending || waiting.isPending || goLive.isPending || advance.isPending || end.isPending || skip.isPending || savePrize.isPending;
  const chooseAdVideo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (!["video/mp4", "video/webm"].includes(file.type)) throw new Error("សូមប្រើ MP4 ឬ WEBM short video ប៉ុណ្ណោះ");
      if (file.size > 4 * 1024 * 1024) throw new Error("Short video ត្រូវមានទំហំក្រោម 4 MB");
      const result = await adVideoUpload.mutateAsync({ fileName: file.name, contentType: file.type as "video/mp4" | "video/webm", dataUrl: await fileAsDataUrl(file) });
      setAdMediaUrl(result.url);
      setNotice("បាន upload ad video ទៅ ZURS media រួចរាល់។");
    } catch (issue) {
      setNotice(issue instanceof Error ? issue.message : "មិនអាច upload ad video បានទេ");
    }
  };
  const createEvent = () => {
    const live = new Date(scheduledAt);
    if (Number.isNaN(live.getTime())) { setNotice("សូមជ្រើសថ្ងៃ និងម៉ោង Live Spin ត្រឹមត្រូវ។"); return; }
    const cutoff = new Date(live.getTime() - 10 * 60_000);
    const lobby = new Date(live.getTime() - 5 * 60_000);
    const announceAt = new Date(live.getTime() - 48 * 60 * 60_000);
    create.mutate({ scheduledAt: live, announcementStartsAt: announceAt, entryCutoffAt: cutoff, lobbyStartsAt: lobby, adMediaUrl: adMediaUrl.trim() || null, adDurationSeconds: Math.max(0, Math.min(7200, Number(adDurationSeconds) || 0)), minParticipantCount: 100 });
  };
  useEffect(() => {
    if (!event || advance.isPending) return;
    const transitionAt = event.status === "live" && event.liveStartedAt ? new Date(event.liveStartedAt).getTime() + event.nameStripSeconds * 1_000 : event.status === "winner_revealed" && event.winnerRevealedAt ? new Date(event.winnerRevealedAt).getTime() + (event.winnerSpoilerSeconds + event.winnerCelebrationSeconds) * 1_000 : event.status === "prize_countdown" && event.prizeCountdownStartedAt ? new Date(event.prizeCountdownStartedAt).getTime() + event.prizeCountdownSeconds * 1_000 : event.status === "prize_revealed" && event.prizeRevealedAt ? new Date(event.prizeRevealedAt).getTime() + 5_000 : null;
    if (!transitionAt) return;
    const timer = window.setTimeout(() => advance.mutate({ eventId: event.id }), Math.max(500, transitionAt - Date.now() + 500));
    return () => window.clearTimeout(timer);
  }, [advance, event?.id, event?.liveStartedAt, event?.nameStripSeconds, event?.prizeCountdownSeconds, event?.prizeCountdownStartedAt, event?.prizeRevealedAt, event?.status, event?.winnerCelebrationSeconds, event?.winnerRevealedAt, event?.winnerSpoilerSeconds]);
  const action = (type: "announce" | "lock" | "waiting" | "live" | "end" | "skip") => {
    if (!event || busy) return;
    const messages = { announce: "ប្រកាស Live Spin នេះឬ?", lock: "Lock participant snapshot ឥឡូវនេះឬ? ក្រោយ lock មិនអាចកែ prize បានទេ។", waiting: "បើក Waiting Lobby ឥឡូវនេះឬ?", live: "ចាប់ផ្តើម Live Spin ឥឡូវនេះឬ?", end: "បញ្ចប់ Live Spin ឥឡូវនេះឬ?", skip: "Skip this week ឬ? Tickets នឹង roll over ទៅ event បន្ទាប់។" };
    if (!window.confirm(messages[type])) return;
    if (type === "announce") announce.mutate({ eventId: event.id });
    if (type === "lock") lock.mutate({ eventId: event.id });
    if (type === "waiting") waiting.mutate({ eventId: event.id });
    if (type === "live") goLive.mutate({ eventId: event.id });
    if (type === "end") end.mutate({ eventId: event.id, reason: "Owner ended the scheduled Live Spin after the prize reveal." });
    if (type === "skip") skip.mutate({ eventId: event.id, reason: "Owner skipped this weekly loyalty giveaway; all unused tickets roll over." });
  };
  return <section className="mt-6 space-y-5"><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold">OWNER TEST MODE</p><p className="mt-1 text-xs leading-5">បង្កើត test event មើលជាសាធារណៈបាន ប៉ុន្តែមានតែ Owner ដែលអាចបន្ថែម test entry។ មិនបង្កើត order, payment, customer ticket ឬរង្វាន់ពិតទេ។</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { if (window.confirm("បង្កើត public-view-only Owner Live Spin test ឥឡូវនេះឬ?")) createTest.mutate(); }} className="h-9 rounded-xl bg-amber-500 px-3 text-xs font-bold text-slate-950 disabled:opacity-40">Create test</button>{event?.isTest ? <button type="button" disabled={busy || !["draft", "announced"].includes(event.status)} onClick={() => addTestEntry.mutate({ eventId: event.id })} className="h-9 rounded-xl border border-amber-300 bg-white px-3 text-xs font-bold text-amber-950 disabled:opacity-40">Join test as Owner</button> : null}</div></div></div><div className="overflow-hidden rounded-3xl border border-cyan-100 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-5 text-white shadow-xl shadow-cyan-950/15"><div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start"><div><div className="flex items-center gap-2 text-cyan-200"><Radio className="h-4 w-4" /><span className="text-xs font-bold tracking-[0.16em]">OWNER-ONLY LIVE SPIN</span></div><h2 className="mt-3 font-display text-2xl font-bold">Weekly Loyalty Giveaway</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Ticket 1 សម្រាប់រាល់ 7 orders ដែលបានបង់ប្រាក់រួច និងមានតម្លៃយ៉ាងហោច $1។ ប្រសិនបើមិនទាន់ដល់ 100 អ្នកចូលរួម tickets នឹង roll over ដោយស្វ័យប្រវត្តិ។</p></div><div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-xs"><p className="font-bold text-cyan-200">DEFAULT SCHEDULE</p><p className="mt-1 font-semibold">ថ្ងៃអាទិត្យ · 3:00 រសៀល</p><p className="mt-1 text-slate-300">Asia/Phnom_Penh · 18+ only</p></div></div></div><div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]"><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-indigo-600" /><h3 className="text-sm font-bold text-slate-950">បង្កើត Weekly Live Spin</h3></div><p className="mt-1 text-xs leading-5 text-slate-500">បង្កើត draft ជាមួយ hidden CSPRNG seed និង SHA-256 commitment មុន announce។</p><label className="mt-4 block text-xs font-bold text-slate-700">ថ្ងៃអាទិត្យ · 3:00 រសៀល (Asia/Phnom_Penh)<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><label className="mt-3 block text-xs font-bold text-slate-700">Ad video URL <span className="font-normal text-slate-400">(optional, 9:16)</span><input value={adMediaUrl} onChange={(event) => setAdMediaUrl(event.target.value)} placeholder="https://…" className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><div className="mt-2 flex items-center gap-2"><button type="button" disabled={busy || adVideoUpload.isPending} onClick={() => adVideoInputRef.current?.click()} className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-[10px] font-bold text-indigo-800 disabled:opacity-40"><Upload className="h-3 w-3" />{adVideoUpload.isPending ? "កំពុង upload…" : "Upload short ad video"}</button><input ref={adVideoInputRef} className="hidden" type="file" accept="video/mp4,video/webm" onChange={chooseAdVideo} /><span className="text-[10px] text-slate-500">MP4 / WEBM ≤4 MB</span></div><label className="mt-3 block text-xs font-bold text-slate-700">Ad duration (seconds)<input inputMode="numeric" value={adDurationSeconds} onChange={(event) => setAdDurationSeconds(event.target.value)} className="mt-1 h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm" /></label><button type="button" disabled={busy} onClick={createEvent} className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white disabled:opacity-50"><Gift className="h-4 w-4" />បង្កើត Live Spin draft</button></article><article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /><h3 className="text-sm font-bold text-slate-950">Live Spin lifecycle</h3></div><select value={activeEventId} onChange={(event) => setSelectedEventId(event.target.value)} className="max-w-48 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">{!events.data?.length ? <option value="">មិនទាន់មាន event</option> : events.data.map((item) => <option key={item.id} value={item.id}>{item.weekKey} · {item.status}</option>)}</select></div>{event ? <><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold tracking-wide text-slate-500">STATUS</p><p className="mt-1 text-sm font-bold text-slate-900">{event.isTest ? `TEST · ${event.status}` : event.status}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold tracking-wide text-slate-500">THRESHOLD</p><p className="mt-1 text-sm font-bold text-slate-900">{event.lockedParticipantCount || 0} / {event.minParticipantCount}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold tracking-wide text-slate-500">ENTRIES LOCKED</p><p className="mt-1 text-sm font-bold text-slate-900">{event.lockedEntryCount || 0}</p></div></div><div className="mt-4 rounded-xl border border-cyan-100 bg-cyan-50 p-3 text-xs leading-5 text-cyan-950"><p className="font-bold">Provably fair commitment</p><p className="mt-1 break-all font-mono text-[10px]">{event.fairnessCommitmentHash ?? "Will be created with the event"}</p><p className="mt-2 text-cyan-800">Participant snapshot និង prize tiers lock មុន Live។ Fairness seed មិនអាចបង្ហាញមុន prize reveal បានទេ។</p></div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3"><button type="button" disabled={busy || event.status !== "draft"} onClick={() => action("announce")} className="h-10 rounded-xl bg-indigo-600 px-3 text-xs font-bold text-white disabled:opacity-40">Announce</button><button type="button" disabled={busy || !["draft", "announced"].includes(event.status)} onClick={() => action("lock")} className="h-10 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white disabled:opacity-40">Lock entries</button><button type="button" disabled={busy || event.status !== "locked"} onClick={() => action("waiting")} className="h-10 rounded-xl bg-cyan-600 px-3 text-xs font-bold text-white disabled:opacity-40">Waiting lobby</button><button type="button" disabled={busy || event.status !== "waiting"} onClick={() => action("live")} className="h-10 rounded-xl bg-emerald-600 px-3 text-xs font-bold text-white disabled:opacity-40">Go Live</button><button type="button" disabled={busy || event.status !== "prize_revealed"} onClick={() => action("end")} className="h-10 rounded-xl bg-slate-700 px-3 text-xs font-bold text-white disabled:opacity-40">End Live</button></div><button type="button" disabled={busy || ["live", "winner_revealed", "prize_countdown", "prize_revealed", "ended", "skipped"].includes(event.status)} onClick={() => action("skip")} className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-950 disabled:opacity-40"><SkipForward className="h-4 w-4" />Skip this week · Roll over all tickets</button></> : <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-5 text-center text-xs text-slate-500">សូមបង្កើត weekly event មុនកំណត់ lifecycle និង prize tiers។</div>}</article></div>{event ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-2"><Ticket className="h-4 w-4 text-indigo-600" /><div><h3 className="text-sm font-bold text-slate-950">Prize tiers 1–10</h3><p className="mt-1 text-xs text-slate-500">ត្រូវការ prize ដែល active ចំនួន 10 មុនអាចបើក Waiting Lobby។ ក្រោយ lock participants មិនអាចកែបានទេ។</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{Array.from({ length: 10 }, (_, index) => { const tierNumber = index + 1; const existing = detail.data?.prizes.find((prize) => prize.tierNumber === tierNumber); return <PrizeTierEditor key={tierNumber} eventId={event.id} tierNumber={tierNumber} initial={existing} disabled={busy || !["draft", "announced"].includes(event.status)} onSave={(values) => savePrize.mutate({ eventId: event.id, tierNumber, ...values })} />; })}</div></section> : null}{event ? <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><SpinSettingsEditor event={event} disabled={busy || !["draft", "announced"].includes(event.status)} onSaved={refresh} /><ConsolationGiftEditor eventId={event.id} initial={detail.data?.consolationGifts?.[0]} disabled={busy || !["draft", "announced"].includes(event.status)} onSaved={refresh} /></section> : null}{notice ? <p className={`rounded-xl border p-3 text-xs leading-5 ${/បាន|roll over/i.test(notice) ? "border-emerald-100 bg-emerald-50 text-emerald-900" : "border-rose-100 bg-rose-50 text-rose-800"}`}>{notice}</p> : null}</section>;
}

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("មិនអាចអាន media file បានទេ"));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function PrizeTierEditor({ eventId, tierNumber, initial, disabled, onSave }: { eventId: string; tierNumber: number; initial?: { nameKh: string; valueLabel: string; descriptionKh: string | null; mediaUrl: string | null; isGrandPrize: boolean; isActive: boolean }; disabled: boolean; onSave: (values: { nameKh: string; valueLabel: string; descriptionKh: string | null; mediaUrl: string | null; isGrandPrize: boolean; isActive: boolean }) => void }) {
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const upload = trpc.uploads.adminLiveSpinMedia.useMutation();
  const [nameKh, setNameKh] = useState(initial?.nameKh ?? `រង្វាន់ទី ${tierNumber}`);
  const [valueLabel, setValueLabel] = useState(initial?.valueLabel ?? "");
  const [descriptionKh, setDescriptionKh] = useState(initial?.descriptionKh ?? "");
  const [mediaUrl, setMediaUrl] = useState(initial?.mediaUrl ?? "");
  const [active, setActive] = useState(initial?.isActive ?? true);
  const [grand, setGrand] = useState(initial?.isGrandPrize ?? tierNumber === 1);
  const [uploadError, setUploadError] = useState<string | null>(null);
  useEffect(() => { setNameKh(initial?.nameKh ?? `រង្វាន់ទី ${tierNumber}`); setValueLabel(initial?.valueLabel ?? ""); setDescriptionKh(initial?.descriptionKh ?? ""); setMediaUrl(initial?.mediaUrl ?? ""); setActive(initial?.isActive ?? true); setGrand(initial?.isGrandPrize ?? tierNumber === 1); }, [initial?.descriptionKh, initial?.isActive, initial?.isGrandPrize, initial?.mediaUrl, initial?.nameKh, initial?.valueLabel, tierNumber]);
  const chooseMedia = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      setUploadError(null);
      if (!["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"].includes(file.type)) throw new Error("សូមប្រើ JPG, PNG, WEBP, MP4 ឬ WEBM ប៉ុណ្ណោះ");
      if (file.size > 4 * 1024 * 1024) throw new Error("រូបភាព ឬ short video ត្រូវមានទំហំក្រោម 4 MB");
      const prepared = file.type.startsWith("image/") ? await prepareAdminImage(file, "square") : { fileName: file.name, contentType: file.type as "video/mp4" | "video/webm", dataUrl: await fileAsDataUrl(file) };
      const result = await upload.mutateAsync({ fileName: prepared.fileName, contentType: prepared.contentType, dataUrl: prepared.dataUrl });
      setMediaUrl(result.url);
    } catch (issue) {
      setUploadError(issue instanceof Error ? issue.message : "មិនអាច upload Live Spin media បានទេ");
    }
  };
  const isVideo = /\.(?:mp4|webm)(?:$|\?)/i.test(mediaUrl);
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold text-slate-800">#{tierNumber}</span>{grand ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-800">GRAND</span> : null}</div><input value={nameKh} disabled={disabled} onChange={(event) => setNameKh(event.target.value)} className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px]" placeholder="ឈ្មោះរង្វាន់" /><input value={valueLabel} disabled={disabled} onChange={(event) => setValueLabel(event.target.value)} className="mt-2 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-[11px]" placeholder="តម្លៃ / prize" /><textarea value={descriptionKh} disabled={disabled} onChange={(event) => setDescriptionKh(event.target.value)} rows={2} className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]" placeholder="ពិពណ៌នារង្វាន់ (optional)" /><div className="mt-2 flex items-center gap-2"><button type="button" disabled={disabled || upload.isPending} onClick={() => mediaInputRef.current?.click()} className="inline-flex h-8 items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 text-[10px] font-bold text-indigo-800 disabled:opacity-40"><Upload className="h-3 w-3" />{upload.isPending ? "កំពុង upload…" : "Upload media"}</button><input ref={mediaInputRef} className="hidden" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={chooseMedia} />{mediaUrl ? <span className="truncate text-[10px] text-emerald-700">Media ready</span> : <span className="text-[10px] text-slate-500">Image / short video ≤4 MB</span>}</div>{mediaUrl ? isVideo ? <video src={mediaUrl} muted playsInline controls className="mt-2 h-20 w-full rounded-lg bg-slate-900 object-contain" /> : <img src={mediaUrl} alt={`រង្វាន់ទី ${tierNumber}`} className="mt-2 h-20 w-full rounded-lg bg-white object-contain" /> : null}<div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-600"><label className="flex items-center gap-1"><input checked={active} disabled={disabled} onChange={(event) => setActive(event.target.checked)} type="checkbox" />Live</label><label className="flex items-center gap-1"><input checked={grand} disabled={disabled} onChange={(event) => setGrand(event.target.checked)} type="checkbox" />Grand</label></div>{uploadError || upload.error ? <p className="mt-2 text-[10px] leading-4 text-rose-600">{uploadError ?? upload.error?.message}</p> : null}<button type="button" disabled={disabled || upload.isPending || !nameKh.trim() || !valueLabel.trim()} onClick={() => onSave({ nameKh, valueLabel, descriptionKh: descriptionKh.trim() || null, mediaUrl: mediaUrl.trim() || null, isGrandPrize: grand, isActive: active })} className="mt-2 h-8 w-full rounded-lg bg-slate-900 text-[10px] font-bold text-white disabled:opacity-40">Save tier</button></div>;
}
