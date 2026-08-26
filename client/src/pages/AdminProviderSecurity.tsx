import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, KeyRound, LockKeyhole, ShieldAlert } from "lucide-react";

const ownerEmail = "chanmakara672@gmail.com";

export default function AdminProviderSecurity() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.email?.trim().toLowerCase() !== ownerEmail) return <div className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center"><ShieldAlert className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 text-lg font-bold text-slate-950">Owner access only</h1><p className="mt-2 text-sm leading-6 text-slate-600">Provider credential settings are visible only to the ZURS owner.</p></div></div>;
  return <DashboardLayout><ProviderSecurityWorkspace /></DashboardLayout>;
}

function ProviderSecurityWorkspace() {
  const status = trpc.admin.providerCredentialStatus.useQuery();
  const configured = (value: "configured" | "missing" | undefined) => value === "configured";
  const rows = [
    { label: "FazerCards catalog", state: status.data?.fazercards.state, note: "Game catalog and package provider" },
    { label: "Bakong merchant", state: status.data?.bakong.state, note: "Merchant readiness only; Payment Control stays separate" },
  ];
  return <main className="mx-auto max-w-3xl pb-10"><header><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">OWNER SECURITY</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">Provider credentials</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">ទំព័រនេះបង្ហាញតែស្ថានភាព configuration។ Secret value, prefix, URL និង merchant details មិនត្រូវបានផ្ញើទៅ browser ទេ។</p></header><section className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="bg-slate-950 p-6 text-white"><div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10"><LockKeyhole className="h-5 w-5" /></span><div><p className="text-sm font-extrabold">Secure rotation boundary</p><p className="mt-1 text-xs leading-5 text-slate-300">Token replacement is performed only through protected deployment secret storage, then a new deployment loads it. This website never accepts, stores, or displays provider tokens.</p></div></div></div><div className="space-y-3 p-6">{rows.map((item) => <div key={item.label} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4"><div className="flex min-w-0 items-center gap-3"><KeyRound className="h-5 w-5 shrink-0 text-indigo-600" /><div><p className="text-xs font-bold text-slate-900">{item.label}</p><p className="mt-0.5 text-[11px] text-slate-500">{item.note}</p></div></div><span className={configured(item.state) ? "inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800" : "inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold text-amber-800"}>{configured(item.state) ? <CheckCircle2 className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}{configured(item.state) ? "CONFIGURED" : "MISSING"}</span></div>)}</div></section><section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><h2 className="text-sm font-bold text-amber-950">របៀបប្តូរ token ដោយសុវត្ថិភាព</h2><p className="mt-2 text-xs leading-5 text-amber-900">ប្រើ secure project environment settings ដើម្បីប្តូរ credential, បន្ទាប់មក publish deployment ថ្មី។ មិនត្រូវបញ្ចូល token ក្នុង artwork, content records, URL, browser form ឬ support ticket ទេ។ Payment Control មិនត្រូវបានបើកដោយទំព័រនេះទេ។</p></section></main>;
}
