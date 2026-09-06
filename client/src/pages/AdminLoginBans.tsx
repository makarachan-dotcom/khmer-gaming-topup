import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Loader2, MonitorSmartphone, RefreshCw, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

/**
 * Operator view of the active 24 hour lockouts.
 *
 * This page exists because the ban is deliberately blunt: it refuses the whole
 * API for an address, and Cambodian mobile carriers put many real customers
 * behind one shared address. A human therefore needs to be able to see exactly
 * who is locked out, on what phone, and release them in one click.
 *
 * It talks to `/api/admin/*`, which `ipBanGuard` exempts from enforcement on
 * purpose — otherwise an admin caught in a cascade could never reach the page
 * that lets them undo it. The endpoints check the admin role themselves.
 */

type Ban = {
  id: string;
  scope: "ip" | "device" | "identity";
  reason: string;
  strikes: number;
  blockedAt: string;
  expiresAt: string;
  retryAfterSeconds: number;
  label: string;
  ip: string | null;
  device: string | null;
  email: string | null;
};

const scopeLabel: Record<Ban["scope"], string> = {
  ip: "IP address",
  device: "Device",
  identity: "Email",
};

const reasonLabel: Record<string, string> = {
  failed_attempts: "ផ្តល់លេខកូដខុសច្រើនដង",
  linked_to_blocked_ip: "ភ្ជាប់នឹង IP ដែលត្រូវបានផ្អាក",
  linked_to_blocked_device: "ភ្ជាប់នឹងឧបករណ៍ដែលត្រូវបានផ្អាក",
  linked_to_blocked_identity: "ភ្ជាប់នឹងអ៊ីមែលដែលត្រូវបានផ្អាក",
};

function countdown(seconds: number) {
  if (seconds <= 0) return "ផុតកំណត់";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours} ម៉ោង ${minutes} នាទី`;
  return `${minutes} នាទី`;
}

export default function AdminLoginBans() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50 p-5">
        <div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center">
          <ShieldAlert className="mx-auto h-8 w-8 text-rose-600" />
          <h1 className="mt-3 text-lg font-bold text-slate-950">Admin access only</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">ទំព័រគ្រប់គ្រងការផ្អាកគណនី មានតែ Admin ប៉ុណ្ណោះ។</p>
        </div>
      </div>
    );
  }
  return (
    <DashboardLayout>
      <LoginBansWorkspace />
    </DashboardLayout>
  );
}

function LoginBansWorkspace() {
  const [bans, setBans] = useState<Ban[]>([]);
  const [durable, setDurable] = useState(true);
  const [busy, setBusy] = useState(true);
  const [lifting, setLifting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch("/api/admin/login-bans", { credentials: "include" });
      if (!response.ok) throw new Error("load_failed");
      const data = (await response.json()) as { durable: boolean; bans: Ban[] };
      setBans(data.bans ?? []);
      setDurable(data.durable);
      setMessage(null);
    } catch {
      setMessage("មិនអាចទាញបញ្ជីការផ្អាកបានទេ។ សូមព្យាយាមម្ដងទៀត។");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lift = async (id: string) => {
    setLifting(id);
    try {
      const response = await fetch("/api/admin/login-bans/lift", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("lift_failed");
      const data = (await response.json()) as { bans: Ban[]; durable: boolean };
      setBans(data.bans ?? []);
      setDurable(data.durable);
      setMessage("បានដោះការផ្អាករួចរាល់។");
    } catch {
      setMessage("មិនអាចដោះការផ្អាកបានទេ។ សូមព្យាយាមម្ដងទៀត។");
    } finally {
      setLifting(null);
    }
  };

  return (
    <main className="mx-auto max-w-4xl pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.14em] text-indigo-700">LOGIN SECURITY</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">ការផ្អាកការចូល</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            បញ្ជី IP និងឧបករណ៍ដែលកំពុងត្រូវបានផ្អាក ២៤ ម៉ោង។ អ្នកអាចដោះការផ្អាកវិញភ្លាមៗបាន។
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-[0.97] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          ផ្ទុកទិន្នន័យ
        </button>
      </header>

      {/* The guard falls back to per-instance memory when Redis is not
          configured. An operator has to know that, because in that mode a ban
          is not shared between serverless instances. */}
      {!durable ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="text-xs font-bold text-amber-950">Redis មិនទាន់កំណត់</p>
            <p className="mt-1 text-[11px] leading-5 text-amber-900">
              ការផ្អាកកំពុងដំណើរក្នុងអង្គចងចាំនីមួយៗប៉ុណ្ណោះ។ សូមកំណត់ UPSTASH_REDIS_REST_URL និង UPSTASH_REDIS_REST_TOKEN ដើម្បីឱ្យការផ្អាកមានស្ថិរភាព។
            </p>
          </div>
        </div>
      ) : null}

      {message ? <p className="mt-4 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">{message}</p> : null}

      <section className="mt-5 space-y-3">
        {busy && bans.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-5 text-xs text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> កំពុងផ្ទុក…
          </div>
        ) : null}

        {!busy && bans.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <p className="text-sm font-bold text-emerald-950">មិនមានការផ្អាកដំណើរការទេ</p>
            </div>
            <p className="mt-1 text-xs text-emerald-900">គ្មាន IP ឬឧបករណ៍ណាមួយកំពុងត្រូវបានផ្អាកនៅពេលនេះទេ។</p>
          </div>
        ) : null}

        {bans.map((ban) => (
          <article key={ban.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-1 text-[10px] font-bold text-rose-800">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {scopeLabel[ban.scope]}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                    {reasonLabel[ban.reason] ?? ban.reason}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">{ban.strikes} ដ硏ង</span>
                </div>

                {/* The three facts an operator actually needs: who, on what, and
                    for how much longer. */}
                <dl className="mt-3 grid gap-1.5 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 font-bold text-slate-500">IP address</dt>
                    <dd className="min-w-0 break-all font-mono text-slate-900">{ban.ip ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 font-bold text-slate-500">ទូរស័ព្ទ / Device</dt>
                    <dd className="flex min-w-0 items-center gap-1.5 text-slate-900">
                      <MonitorSmartphone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="truncate">{ban.device ?? "Unknown device"}</span>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 font-bold text-slate-500">អ៊ីមែល</dt>
                    <dd className="min-w-0 break-all text-slate-900">{ban.email ?? "—"}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 font-bold text-slate-500">នៅសល់</dt>
                    <dd className="font-bold text-rose-700">{countdown(ban.retryAfterSeconds)}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-28 shrink-0 font-bold text-slate-500">ផុតកំណត់</dt>
                    <dd className="text-slate-600">{new Date(ban.expiresAt).toLocaleString()}</dd>
                  </div>
                </dl>
              </div>

              <button
                type="button"
                onClick={() => void lift(ban.id)}
                disabled={lifting === ban.id}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-bold text-white transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lifting === ban.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
                ដោះបែន
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
