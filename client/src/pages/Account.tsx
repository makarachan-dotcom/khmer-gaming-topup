import { Reveal } from "@/components/Reveal";
import { useAuth } from "@/_core/hooks/useAuth";
import StorefrontLayout from "@/components/StorefrontLayout";
import { Seo } from "@/components/Seo";
import { CompactDisclosure } from "@/components/CompactDisclosure";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { OutlineLoader } from "@/components/OutlineLoader";
import { getAccountDashboardState } from "@/lib/accountDashboardState";
import { khmerDiamondCopy } from "@/lib/khmerDiamondCopy";
import { accountRecoveryMessage } from "@/lib/accountRecovery";
import { trpc } from "@/lib/trpc";
import { checkAccessBan, formatCountdownKh } from "@/lib/loginGuard";
import { requestSupportChat } from "@/components/SupportMascot";
import { AnimatedEmoji } from "@/components/AnimatedEmoji";
import { VerifiedName } from "@/components/VerifiedName";
import { DeliveryVault, WaitingDelivery } from "@/components/DeliveryVault";
import { CdkUpgradeCard } from "@/components/CdkUpgradeCard";
import type { PartnerDelivery } from "@shared/partnerDelivery";
import type { PublicCdkStatus } from "@shared/cdkToken";
import { Check, ChevronDown, Crown, LogOut, Mail, MessageCircle, ReceiptText, ShieldAlert, ShieldCheck, ShoppingBag, UserRound, Ticket } from "lucide-react";
import React, { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";

const sparklesEmoji = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kXzBrYNIYeExUoGY.svg";
type AccountOrderEvent = { id: string; messageKh: string; status: string; createdAt: Date | string };
type AccountOrder = { id: string; orderNumber: string; trackingCode?: string; productName: string; subtotal: string | number; currency: string; status: string; orderType: string; createdAt: Date | string; events?: AccountOrderEvent[]; delivery?: PartnerDelivery | null; cdk?: PublicCdkStatus | null };
type AccountTransaction = { id: string; orderNumber: string; productName: string; amount: string | number; currency: string; status: string; createdAt: Date | string };

export default function Account() {
  const { user, loading, logout } = useAuth();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const saveName = trpc.auth.setMemberDisplayName.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const orders = trpc.orders.mine.useQuery(undefined, { enabled: Boolean(user) });
  const transactions = trpc.orders.paymentHistory.useQuery(undefined, { enabled: Boolean(user) });
  const save = (skip = false) => saveName.mutate({ name: skip ? undefined : name });
  const dashboardState = getAccountDashboardState(user);
  const onboarding = dashboardState.needsDisplayName ? <OnboardingCard name={name} onNameChange={setName} pending={saveName.isPending} error={accountRecoveryMessage(saveName.error?.message)} onSave={() => save(false)} onSkip={() => save(true)} /> : null;

  return <StorefrontLayout><Seo noindex /><LoadingOverlay open={loading} label="កំពុងរៀបចំគណនី…" /><main className="container py-6 sm:py-10 zp-page"><Reveal as="section" index={0}><section className="glass-panel relative mx-auto w-full max-w-4xl overflow-hidden rounded-[1.5rem] p-5 sm:p-9"><img src={sparklesEmoji} alt="" aria-hidden="true" className="emoji-asset float-emoji absolute right-8 top-7 h-7 w-7" /><div className="relative"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">ZURS MEMBER</p><h1 className="mt-2 font-display text-2xl font-bold leading-tight text-slate-950 sm:text-4xl">គណនីរបស់អ្នក</h1>{loading ? <LoadingPanel /> : !user ? <SignedOutCard /> : <MemberDashboard name={user.displayName ?? "ZURS Member"} isAdmin={dashboardState.isAdmin} onLogout={logout} logoutPending={loading} onboarding={onboarding} orders={orders.data ?? []} ordersLoading={orders.isLoading} transactions={transactions.data ?? []} transactionsLoading={transactions.isLoading} />}</div></section><AccountHelp /></Reveal></main></StorefrontLayout>;
}

function LoadingPanel() { return <div className="mt-5 flex items-center gap-2 rounded-xl bg-white/70 p-4 text-xs text-slate-600"><OutlineLoader size={22} color="#c99712" />កំពុងរៀបចំគណនី…</div>; }

function AccountHelp() { return <section className="mx-auto mt-5 max-w-4xl"><div className="mb-3"><p className="text-[10px] font-bold tracking-[0.16em] text-indigo-700">ZURS HELP</p><h2 className="mt-1 font-display text-xl font-bold text-slate-950">សំណួរដែលសួរញឹកញាប់</h2><p className="mt-1 text-xs leading-5 text-slate-500">ព័ត៌មានសំខាន់សម្រាប់ការប្រើប្រាស់ Top-up និងការគាំទ្រគណនី។</p></div><div className="grid gap-3"><CompactDisclosure label="របៀបមើលកញ្ចប់ Top-up" summary="ជ្រើសហ្គេម បំពេញព័ត៌មានគណនី ហើយពិនិត្យកញ្ចប់"><p>ចូលទៅកាន់ទំព័រ <strong>បញ្ចូលពេជ្យ / Top-up</strong> ជ្រើសឈ្មោះហ្គេមរបស់អ្នកជាមុនសិន។ បន្ទាប់មកបំពេញព័ត៌មានគណនី និងពិនិត្យកញ្ចប់ដែលបង្ហាញសម្រាប់ហ្គេមនោះ។</p></CompactDisclosure><CompactDisclosure label="ត្រូវបំពេញលេខ ID ដូចម្តេច?" summary="ពិនិត្យលេខ Player ID និង Server ID មុនជ្រើសកញ្ចប់"><p>បំពេញព័ត៌មានគណនីឲ្យត្រឹមត្រូវ ហើយពិនិត្យឈ្មោះដែលប្រព័ន្ធបង្ហាញ មុនមើលកញ្ចប់។ សម្រាប់ហ្គេមដែលមិនគាំទ្រការផ្ទៀងផ្ទាត់ឈ្មោះ សូមពិនិត្យលេខ ID ដោយប្រុងប្រយ័ត្ន។</p></CompactDisclosure><CompactDisclosure label="ត្រូវការជំនួយបន្ថែម?" summary="ប្រើ Ticket ក្នុងគណនីសម្រាប់បញ្ហាការបញ្ជាទិញ"><p>បើមានបញ្ហាជាមួយការបញ្ជាទិញ សូមបើក Ticket ដោយប្រើ Purchase ID របស់អ្នក។ ក្រុមគាំទ្រនឹងពិនិត្យតាមប្រវត្តិស្ថានភាពដែលពាក់ព័ន្ធ។</p></CompactDisclosure></div></section>; }

function SignedOutCard() {
  // Both entry points lead to the ZURS sign-in page. Email sign-in is our own
  // one-time-code flow, so "Connect with Email" must land on /login rather than
  // reuse the Google OAuth redirect it used to share with the primary button.
  const loginUrl = "/login?returnTo=%2Faccount";
  // "ចូលគណនី" is the Google button, so it must go to the OAuth route — not to
  // /login, which is the email one-time-code flow behind "Connect with Email".
  const googleUrl = "/api/auth/google?returnTo=%2Faccount";
  const [ban, setBan] = useState<{ blocked: boolean; retryAfter: number }>({ blocked: false, retryAfter: 0 });
  const [checked, setChecked] = useState(false);

  // Ask the server whether this visitor is serving a ban. While one is active
  // the sign-in controls are removed outright: the requirement is that nothing
  // is offered at all, not that clicking one fails.
  useEffect(() => {
    let cancelled = false;
    void checkAccessBan().then((state) => {
      if (cancelled) return;
      setBan({ blocked: state.blocked, retryAfter: state.retryAfter });
      setChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Local countdown so the card restores itself the moment the ban expires,
  // without the visitor having to reload the page.
  useEffect(() => {
    if (!ban.blocked) return;
    const timer = window.setInterval(() => {
      setBan((current) => {
        const next = current.retryAfter - 1;
        return next > 0 ? { blocked: true, retryAfter: next } : { blocked: false, retryAfter: 0 };
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [ban.blocked]);

  if (ban.blocked) {
    return (
      <>
        <p className="mt-3 text-xs leading-6 text-slate-600 sm:text-sm sm:leading-7">ការចូលគណនីពីឧបករណ៍ និងបណ្តាញអិនទើណតនេះ ត្រូវបានផ្អាកជាបណ្តោះអាសន្ន។</p>
        <div className="zl-ban-card mt-5 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/80 p-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-rose-100 text-rose-700">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-rose-900">គណនីត្រូវបានផ្អាក ២៤ ម៉ោង</p>
              <p className="mt-0.5 text-xs leading-5 text-rose-700">សូមព្យាយាមម្ដងទៀតក្នុងរយៈពេល {formatCountdownKh(ban.retryAfter)}។</p>
            </div>
          </div>
          {/* While banned, Google sign-in stays open (Google already ran its own
              checks) and support is reachable. "Connect with Email" is the only
              door that stays shut for the full 24 hours. */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a href={googleUrl} className="inline-flex h-10 items-center gap-2 rounded-xl zbtn zbtn--primary"><span className="zs-chat__point" aria-hidden="true"><AnimatedEmoji emoji="👉" size={20} /></span>ចូលគណនី</a>
            <button type="button" onClick={() => requestSupportChat({ topic: "ការផ្អាក ២៤ ម៉ោង" })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-50"><MessageCircle className="h-3.5 w-3.5" />ឆាតជាមួយជំនួយ</button>
          </div>
          <p className="mt-3 border-t border-rose-200/70 pt-3 text-[11px] leading-5 text-rose-700/90">
            បើអ្នកមិនម៉ានជាមួយការផ្អាកនេះ សូមទាក់ទង Support ដើម្បីដោះបែនវិញ។
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="mt-3 text-xs leading-6 text-slate-600 sm:text-sm sm:leading-7">ចូលគណនីរបស់អ្នក ដើម្បីរក្សាទុកពិត៌មាន និងគ្រប់គ្រងសកម្មភាពរបស់អ្នកជាមួយ ZURS STORE។</p>
      <div className="mt-5 rounded-xl border border-white/90 bg-white/65 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><UserRound className="h-5 w-5" /></div>
          <div><p className="text-sm font-bold text-slate-900">ZURS Member</p><p className="mt-0.5 text-xs text-slate-500">ចូលគណនីរបស់អ្នកដើម្បីបន្ត។</p></div>
        </div>
        <div className="mt-4 flex items-center gap-2 text-xs text-emerald-800"><ShieldCheck className="h-4 w-4" />ប្រើប្រាស់បានងាយស្រួល និងមានទំនុកចិត្ត</div>
      </div>
      {/* Faded in only once the ban probe has answered, so a banned visitor
          never sees the buttons flash in before they are pulled. */}
      <div className={`mt-5 flex flex-wrap items-center gap-2 transition-opacity duration-300 ${checked ? "opacity-100" : "opacity-0"}`}>
        <a href={googleUrl} className="inline-flex h-10 items-center gap-2 rounded-xl zbtn zbtn--primary"><span className="zs-chat__point" aria-hidden="true"><AnimatedEmoji emoji="👉" size={20} /></span>ចូលគណនី</a>
        <a href={loginUrl} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-3 text-xs font-bold text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"><Mail className="h-3.5 w-3.5" />Connect with Email</a>
      </div>
    </>
  );
}

function MemberDashboard({ name, isAdmin, onLogout, logoutPending, onboarding, orders, ordersLoading, transactions, transactionsLoading }: { name: string; isAdmin: boolean; onLogout: () => Promise<void>; logoutPending: boolean; onboarding: ReactNode; orders: AccountOrder[]; ordersLoading: boolean; transactions: AccountTransaction[]; transactionsLoading: boolean }) {
  return <><p className="mt-3 text-xs leading-6 text-slate-600 sm:text-sm sm:leading-7">មើលប្រវត្តិការទិញ ស្ថានភាពពិត និងប្រតិបត្តិការទូទាត់របស់អ្នកនៅកន្លែងតែមួយ។</p><div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/90 bg-white/65 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><UserRound className="h-5 w-5" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-900"><VerifiedName name={name} size={20} /></p><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-xs text-slate-500">ZURS Member</span>{isAdmin ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800"><Crown className="h-3 w-3" />ZURS Admin</span> : null}</div></div></div><div className="flex w-full flex-nowrap gap-1.5 sm:w-auto"><Link href="/order-status" className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border zbtn zbtn--secondary zbtn--sm px-2 text-xs font-bold text-indigo-800 sm:flex-none sm:px-3"><Ticket className="h-3.5 w-3.5 shrink-0" />Ticket</Link><button type="button" disabled={logoutPending} onClick={() => void onLogout()} className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none sm:px-3"><LogOut className="h-3.5 w-3.5 shrink-0" />ចាកចេញ</button></div>{isAdmin ? <Link href="/admin" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border zbtn zbtn--secondary zbtn--sm px-3 text-xs font-bold text-amber-800 sm:ml-auto"><Crown className="h-3.5 w-3" />ផ្ទាំង Admin</Link> : null}</div>{onboarding}<div className="account-history-grid mt-5 grid min-w-0 gap-4 lg:grid-cols-2"><HistoryPanel icon={<ShoppingBag className="h-4 w-4" />} title="ប្រវត្តិការទិញ" caption="Top-up និង log ស្ថានភាពពិត" loading={ordersLoading} empty="មិនទាន់មានការទិញនៅឡើយទេ។">{orders.map((order) => <HistoryRow key={order.id} title={order.orderType === "smm" ? "សេវាឌីជីថលពីមុន" : order.productName} subtitle={`${order.orderNumber} · ${order.orderType === "smm" ? "Digital service" : "Top-up"}`} amount={formatAmount(order.subtotal, order.currency)} status={order.status} date={order.createdAt} trackingCode={order.trackingCode} events={order.events} delivery={order.delivery} cdk={order.cdk} orderId={order.id} waitingDigital={order.status === "paid" && !order.delivery && !order.cdk && order.productName.includes("•")} onSupport={() => requestSupportChat({ orderRef: order.orderNumber })} />)}</HistoryPanel><HistoryPanel icon={<ReceiptText className="h-4 w-4" />} title="ប្រវត្តិប្រតិបត្តិការ" caption="ស្ថានភាពការទូទាត់ដែលពាក់ព័ន្ធនឹងការបញ្ជាទិញ" loading={transactionsLoading} empty="មិនទាន់មានប្រតិបត្តិការទូទាត់នៅឡើយទេ។">{transactions.map((transaction) => <HistoryRow key={transaction.id} title={transaction.productName} subtitle={transaction.orderNumber} amount={formatAmount(transaction.amount, transaction.currency)} status={transaction.status} date={transaction.createdAt} />)}</HistoryPanel></div></>;
}

function OnboardingCard({ name, onNameChange, pending, error, onSave, onSkip }: { name: string; onNameChange: (next: string) => void; pending: boolean; error?: string; onSave: () => void; onSkip: () => void }) {
  return <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-indigo-700"><UserRound className="h-5 w-5" /></div><div><p className="text-sm font-bold text-slate-900">បង្កើតឈ្មោះ ZURS Member</p><p className="mt-0.5 text-xs text-slate-500">បំពេញឈ្មោះបានគ្រប់ពេល ដោយមិនរារាំងប្រវត្តិ ឬការចាកចេញពីគណនីរបស់អ្នកទេ។</p></div></div><label className="mt-4 block"><span className="mb-1.5 block text-xs font-bold text-slate-700">ឈ្មោះរបស់អ្នក</span><div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-indigo-400"><input value={name} onChange={(event) => onNameChange(event.target.value)} maxLength={120} placeholder="ឧ. Makara" className="h-10 min-w-0 flex-1 px-3 text-sm outline-none" /><span className="flex items-center border-l border-slate-200 bg-slate-50 px-3 text-[10px] font-bold text-indigo-700">ZURS Member</span></div></label>{error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}<div className="mt-4 grid gap-2 sm:grid-cols-2"><button disabled={pending} onClick={onSave} className="flex h-10 items-center justify-center gap-2 rounded-xl zbtn zbtn--primary disabled:opacity-60">{pending ? <OutlineLoader size={16} color="#ffffff" /> : null}រក្សាទុកឈ្មោះ</button><button disabled={pending} onClick={onSkip} className="zbtn zbtn--ghost zbtn--sm disabled:opacity-60">រំលង និងបង្កើតលេខ</button></div></div>;
}

function HistoryPanel({ icon, title, caption, loading, empty, children }: { icon: ReactNode; title: string; caption: string; loading: boolean; empty: string; children: ReactNode[] }) { const count = children.length; return <details className="account-history-panel group min-w-0 overflow-hidden rounded-2xl border border-white/90 bg-white/65"><summary className="account-history-summary flex min-w-0 cursor-pointer list-none items-center gap-2 overflow-hidden p-4 text-slate-900 marker:content-none"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-700">{icon}</span><div className="min-w-0 flex-1 overflow-hidden"><h2 className="truncate text-sm font-bold">{title}</h2><p className="mt-0.5 truncate text-[11px] text-slate-500">{caption}</p></div>{!loading && count ? <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{count}</span> : null}<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180" /></summary><div className="min-w-0 border-t border-white/90 px-4 pb-4 pt-3"><div className="min-w-0 space-y-2">{loading ? <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500"><OutlineLoader size={20} color="#64748b" />កំពុងទាញយកប្រវត្តិ…</div> : count ? children : <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs leading-5 text-slate-500">{empty}</div>}</div></div></details>; }
function HistoryRow({ title, subtitle, amount, status, date, trackingCode, events, delivery, cdk, orderId, waitingDigital, onSupport }: { title: string; subtitle: string; amount: string; status: string; date: Date | string; trackingCode?: string; events?: AccountOrderEvent[]; delivery?: PartnerDelivery | null; cdk?: PublicCdkStatus | null; orderId?: string; waitingDigital?: boolean; onSupport?: () => void }) {
  const utils = trpc.useUtils();
  const visibleEvents = events?.length ? events : trackingCode ? [{ id: `current-${trackingCode}`, messageKh: statusLogMessage(status), status, createdAt: date }] : [];
  return <article className="min-w-0 overflow-hidden rounded-xl border border-slate-100 bg-white/80 p-3"><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0 flex-1 overflow-hidden"><p className="truncate text-xs font-bold text-slate-800">{khmerDiamondCopy(title)}</p><p className="mt-1 truncate text-[11px] text-slate-500">{subtitle}</p></div><p className="max-w-[42%] shrink-0 break-words text-right text-xs font-bold text-slate-900">{amount}</p></div><div className="mt-2 flex min-w-0 items-center justify-between gap-2"><div className="flex min-w-0 items-center gap-2"><StatusBadge status={status} />{onSupport ? <button type="button" onClick={onSupport} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700 transition-colors hover:bg-indigo-100"><MessageCircle className="h-3 w-3" />ជំនួយ</button> : null}</div><time className="min-w-0 truncate text-right text-[10px] text-slate-400">{new Date(date).toLocaleDateString("km-KH")}</time></div>{delivery ? <DeliveryVault delivery={delivery} productName={khmerDiamondCopy(title)} /> : cdk && orderId ? <CdkUpgradeCard orderId={orderId} status={status} cdk={cdk} productName={khmerDiamondCopy(title)} onUpdated={() => void utils.orders.mine.invalidate()} /> : waitingDigital ? <WaitingDelivery productName={khmerDiamondCopy(title)} /> : null}{trackingCode ? <details className="mt-3 min-w-0 overflow-hidden rounded-lg bg-slate-50 p-2.5"><summary className="cursor-pointer truncate text-[11px] font-bold text-indigo-700">មើល log ស្ថានភាពពិត</summary><p className="mt-2 truncate font-mono text-[10px] text-slate-500">Purchase ID: {trackingCode}</p><ol className="mt-2 space-y-2 overflow-hidden border-l border-indigo-100 pl-3">{visibleEvents.map((event) => <li key={event.id} className="min-w-0 text-[11px] leading-5 text-slate-600"><p className="break-words">{event.messageKh}</p><time className="block truncate text-[10px] text-slate-400">{new Date(event.createdAt).toLocaleString("km-KH")}</time></li>)}</ol></details> : null}</article>;
}
function statusLogMessage(status: string) { return ({ pending: "ការបញ្ជាទិញត្រូវបានបង្កើត និងកំពុងរង់ចាំការទូទាត់។", awaiting_payment: "បានបង្កើតសំណើទូទាត់។", paid: "បានទទួលការទូទាត់។ ប្រព័ន្ធកំពុងដំណើរការសេវារបស់អ្នក។", delivered: "សេវាកម្មត្រូវបានបញ្ចប់ដោយជោគជ័យ។", failed: "ការបញ្ជាទិញមិនអាចដំណើរការបានទេ។", expired: "សំណើទូទាត់ផុតកំណត់។", refunded: "ការបញ្ជាទិញត្រូវបានសងប្រាក់វិញ។" } as Record<string, string>)[status] ?? status; }
function StatusBadge({ status }: { status: string }) { const success = ["paid", "delivered"].includes(status); const danger = ["failed", "refunded", "expired"].includes(status); const labels: Record<string, string> = { pending: "កំពុងរង់ចាំ", awaiting_payment: "រង់ចាំទូទាត់", paid: "បានទូទាត់", delivered: "បានបញ្ចប់", failed: "បរាជ័យ", expired: "ផុតកំណត់", refunded: "សងប្រាក់វិញ" }; return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${success ? "bg-emerald-50 text-emerald-700" : danger ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}>{labels[status] ?? status}</span>; }
function formatAmount(value: string | number, currency: string) { const parsed = Number(value); return `${currency === "USD" ? "$" : ""}${Number.isFinite(parsed) ? parsed.toFixed(2) : value}${currency !== "USD" ? ` ${currency}` : ""}`; }
