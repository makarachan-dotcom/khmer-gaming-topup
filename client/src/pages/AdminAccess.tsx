import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Check, Crown, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingV2 } from "@/components/OutlineLoader";

const ownerEmail = "chanmakara672@gmail.com";
const permissionOptions = [
  { key: "dashboard", label: "ផ្ទាំងសង្ខេប", description: "មើលទិន្នន័យសង្ខេបហាង" },
  { key: "orders", label: "ការកម្មង់", description: "មើល និងគ្រប់គ្រងស្ថានភាព order" },
  { key: "catalog", label: "កាតាឡុក និងតម្លៃ", description: "គ្រប់គ្រង package, catalog និង margin" },
  { key: "media", label: "រូបភាព និងមាតិកា", description: "កែ Banner, Game image និង Package artwork" },
  { key: "support", label: "Support", description: "គ្រប់គ្រង ticket និង Contact Admin" },
  { key: "marketplace", label: "Marketplace", description: "ពិនិត្យ listing, verification និង fraud reports" },
  { key: "payments", label: "Payment history", description: "មើល payment transactions តែប៉ុណ្ណោះ" },
  { key: "operations", label: "ប្រតិបត្តិការ", description: "មើលស្ថានភាព operation និង payment history ដោយគ្មាន Payment Control" },
] as const;
type PermissionKey = (typeof permissionOptions)[number]["key"];

export default function AdminAccess() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-slate-50" />;
  if (user?.email?.toLowerCase() !== ownerEmail) return <div className="grid min-h-screen place-items-center bg-slate-50 p-5"><div className="max-w-md rounded-2xl border border-rose-100 bg-white p-6 text-center"><AlertTriangle className="mx-auto h-8 w-8 text-rose-600" /><h1 className="mt-3 text-lg font-bold text-slate-950">Owner access only</h1><p className="mt-2 text-sm leading-6 text-slate-600">មានតែម្ចាស់ ZURS STORE ប៉ុណ្ណោះដែលអាចផ្លាស់ប្ដូរសិទ្ធិអ្នកគ្រប់គ្រងបាន។</p></div></div>;
  return <DashboardLayout><div className="motion-reveal"><AccessWorkspace /></div></DashboardLayout>;
}

function AccessWorkspace() {
  const users = trpc.admin.users.useQuery();
  const audits = trpc.admin.roleAudits.useQuery();
  const utils = trpc.useUtils();
  const [targetUserId, setTargetUserId] = useState<number | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [nextRole, setNextRole] = useState<"user" | "admin">("admin");
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const selected = users.data?.find((member) => member.id === targetUserId);
  const savedPermissions = trpc.admin.userPermissions.useQuery({ targetUserId: targetUserId ?? 1 }, { enabled: Boolean(targetUserId && selected?.role === "admin") });
  const changeRole = trpc.admin.setUserRole.useMutation();
  const savePermissions = trpc.admin.setUserPermissions.useMutation();
  const busy = changeRole.isPending || savePermissions.isPending;

  useEffect(() => {
    if (selected?.role === "admin" && savedPermissions.data) setPermissions(savedPermissions.data as PermissionKey[]);
  }, [savedPermissions.data, selected?.role, targetUserId]);

  const selectMember = (member: NonNullable<typeof users.data>[number]) => {
    setTargetUserId(member.id);
    setConfirmationEmail("");
    setReason("");
    setError(null);
    setPermissions([]);
    // Existing delegated Admins should open directly in permission-edit mode.
    // The Owner can explicitly choose removal from the role selector if needed.
    setNextRole("admin");
  };

  const togglePermission = (permission: PermissionKey) => {
    setPermissions((current) => current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission]);
  };

  const submit = async () => {
    if (!selected) return;
    try {
      setError(null);
      if (selected.role === "admin" && nextRole === "user") await savePermissions.mutateAsync({ targetUserId: selected.id, permissions: [] });
      if (selected.role !== nextRole) await changeRole.mutateAsync({ targetUserId: selected.id, nextRole, confirmationEmail, reason });
      if (nextRole === "admin") await savePermissions.mutateAsync({ targetUserId: selected.id, permissions });
      setTargetUserId(null);
      setConfirmationEmail("");
      setReason("");
      setPermissions([]);
      await Promise.all([utils.admin.users.invalidate(), utils.admin.roleAudits.invalidate(), utils.admin.userPermissions.invalidate()]);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "មិនអាចរក្សាទុកសិទ្ធិ Admin បានទេ");
    }
  };

  const hasExactEmail = confirmationEmail.trim().toLowerCase() === selected?.email?.toLowerCase();
  const canSubmit = Boolean(selected && hasExactEmail && reason.trim().length >= 10 && !busy && (nextRole === "user" || permissions.length > 0));

  return <main className="mx-auto max-w-6xl pb-10"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-bold tracking-[0.14em] text-indigo-700">OWNER SECURITY</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-950">គ្រប់គ្រងសិទ្ធិ Admin</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">មានតែ Owner អាចផ្ដល់ ឬដក Admin role បាន។ Admin ដែលបានផ្ដល់សិទ្ធិទទួលបានតែផ្នែកដែល Owner ជ្រើស ហើយមិនអាចចូល Payment Control, Provider Security ឬគ្រប់គ្រងសិទ្ធិអ្នកដទៃបានទេ។</p></div><a href="/admin" className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700">ត្រឡប់ទៅ Admin</a></header>
    <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">អ្នកប្រើប្រាស់</h2><p className="mt-1 text-xs leading-5 text-slate-500">ជ្រើសគណនីមួយ ដើម្បីផ្ដល់/ដក role និងកំណត់ផ្នែកដែលអាចចូលបាន។ Owner account មិនអាចដកសិទ្ធិបានទេ។</p></div>{users.isLoading ? <div className="grid min-h-40 place-items-center"><LoadingV2 size={20} color="#4f46e5" className="motion-icon h-5 w-5 text-indigo-600" /></div> : <div className="divide-y divide-slate-100">{users.data?.map((member) => <button type="button" key={member.id} onClick={() => selectMember(member)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-slate-50"><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><UserCog className="motion-icon h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-900">{member.displayName ?? member.name ?? member.email ?? "ZURS Member"}</span><span className="mt-1 block truncate text-[11px] text-slate-500">{member.email ?? "No email"}</span></span><span className={member.role === "admin" ? "inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800" : "rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600"}>{member.role === "admin" ? <><Crown className="motion-icon h-3 w-3" />Admin</> : "Member"}</span></button>)}</div>}</div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><ShieldCheck className="h-4 w-4" /></span><div><h2 className="text-sm font-bold text-slate-900">បញ្ជាក់ការផ្លាស់ប្ដូរ</h2><p className="mt-0.5 text-[11px] text-slate-500">Role និង permissions ត្រូវបានរក្សាទុកដោយ Owner។</p></div></div>{selected ? <div className="mt-5 space-y-3"><div className="rounded-xl bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-800">{selected.email ?? "No email"}</p><p className="mt-1 text-slate-500">សិទ្ធិបច្ចុប្បន្ន៖ {selected.role}</p></div><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">សិទ្ធិថ្មី</span><select value={nextRole} onChange={(event) => setNextRole(event.target.value as "user" | "admin")} className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"><option value="admin">ផ្ដល់សិទ្ធិ Admin</option><option value="user">ដកសិទ្ធិ Admin</option></select></label>{nextRole === "admin" ? <fieldset className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3"><legend className="px-1 text-xs font-bold text-slate-800">ផ្នែកដែលអនុញ្ញាត</legend><p className="mb-2 text-[11px] leading-5 text-slate-600">ជ្រើសយ៉ាងហោចណាស់មួយ។ Owner control, role access និង provider credentials ត្រូវបានចាក់សោសម្រាប់ Owner ជានិច្ច។</p><div className="space-y-2">{permissionOptions.map((permission) => <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded-lg bg-white p-2.5 text-xs"><input type="checkbox" checked={permissions.includes(permission.key)} onChange={() => togglePermission(permission.key)} className="mt-0.5" /><span><b className="text-slate-800">{permission.label}</b><span className="ml-1 text-slate-500">— {permission.description}</span></span></label>)}</div></fieldset> : null}<label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">បញ្ជាក់អ៊ីមែលគណនី</span><input value={confirmationEmail} onChange={(event) => setConfirmationEmail(event.target.value)} placeholder={selected.email ?? "user@example.com"} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs outline-none focus:border-indigo-500" /></label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">មូលហេតុសម្រាប់ audit</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="ឧ. ផ្ដល់សិទ្ធិសម្រាប់គ្រប់គ្រង order និង catalog" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs outline-none focus:border-indigo-500" /></label>{error ? <p className="text-xs text-rose-600">{error}</p> : null}<button type="button" onClick={() => void submit()} disabled={!canSubmit} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-bold text-white disabled:opacity-40">{busy ? <LoadingV2 size={16} color="#ffffff" className="h-4 w-4" /> : <Check className="h-4 w-4" />}{nextRole === "admin" ? "រក្សាទុក Admin និងសិទ្ធិ" : "បញ្ជាក់ដកសិទ្ធិ Admin"}</button>{nextRole === "admin" ? <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">បន្ទាប់ពីរក្សាទុក សូមឲ្យ Admin នោះ sign out រួច sign in ម្តងទៀត ដើម្បី refresh session និងឃើញ menu ដែល Owner បានអនុញ្ញាត។</p> : null}</div> : <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-xs leading-5 text-slate-500">ជ្រើសគណនីពីបញ្ជីខាងឆ្វេងជាមុនសិន។</div>}</div></section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold text-slate-900">ប្រវត្តិការផ្លាស់ប្ដូរសិទ្ធិ</h2></div>{audits.isLoading ? <div className="p-5"><LoadingV2 size={16} color="#4f46e5" className="h-4 w-4 text-indigo-600" /></div> : audits.data?.length ? <div className="divide-y divide-slate-100">{audits.data.map(({ audit, actor }) => <div key={audit.id} className="p-4 text-xs"><p className="font-bold text-slate-800">{actor?.email ?? "Owner"} · {audit.previousRole} → {audit.nextRole}</p><p className="mt-1 text-slate-500">{audit.reason} · {new Date(audit.createdAt).toLocaleString("km-KH")}</p></div>)}</div> : <div className="p-5 text-xs text-slate-500">មិនទាន់មានការផ្លាស់ប្ដូរសិទ្ធិ។</div>}</section>
  </main>;
}
