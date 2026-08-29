import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { completeAppwriteEmailOtp, requestAppwriteEmailOtp } from "@/lib/appwriteAuth";
import { useAuth } from "@/_core/hooks/useAuth";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function safeReturnPath() {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  return candidate?.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/login") ? candidate : "/account";
}

export default function AppwriteLogin() {
  const { user, loading, refresh } = useAuth();
  const returnTo = useMemo(safeReturnPath, []);
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) window.location.replace(returnTo);
  }, [loading, returnTo, user]);

  const sendCode = async () => {
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) return setError("សូមបញ្ចូលអ៊ីមែលឲ្យត្រឹមត្រូវ។");
    setBusy(true);
    try {
      const token = await requestAppwriteEmailOtp(normalized);
      setUserId(token.userId);
      setSecret("");
    } catch {
      setError("មិនអាចផ្ញើលេខកូដបានទេ។ សូមពិនិត្យអ៊ីមែល ឬព្យាយាមម្ដងទៀត។");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async () => {
    if (!userId || !secret.trim()) return setError("សូមបញ្ចូលលេខកូដពីអ៊ីមែល។");
    setError(null);
    setBusy(true);
    try {
      await completeAppwriteEmailOtp({ userId, secret });
      await refresh();
      window.location.replace(returnTo);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "លេខកូដមិនត្រឹមត្រូវ ឬផុតកំណត់។");
    } finally {
      setBusy(false);
    }
  };

  return <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-100">
    <section className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/85 p-7 shadow-2xl shadow-black/30">
      <button type="button" onClick={() => window.history.back()} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-300 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> ត្រឡប់ក្រោយ</button>
      <div className="mb-7 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300"><MailCheck className="h-6 w-6" /></div>
      <h1 className="text-2xl font-black tracking-tight">ចូលគណនី ZURS</h1>
      <p className="mt-2 text-sm leading-6 text-slate-300">ប្រើលេខកូដមួយដងពីអ៊ីមែលរបស់អ្នក។ Admin access នឹងត្រូវបានផ្ទៀងផ្ទាត់តាមអ៊ីមែលដែលបានអនុញ្ញាត។</p>
      {!userId ? <div className="mt-7 space-y-4">
        <label className="block text-sm font-semibold">អ៊ីមែល</label>
        <Input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" className="h-12 border-white/10 bg-slate-950/60" />
        <Button type="button" onClick={sendCode} disabled={busy} className="h-12 w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">{busy ? "កំពុងផ្ញើលេខកូដ…" : "ផ្ញើលេខកូដទៅអ៊ីមែល"}</Button>
      </div> : <div className="mt-7 space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-100"><KeyRound className="h-5 w-5 shrink-0" /> លេខកូដត្រូវបានផ្ញើទៅ <strong className="truncate">{email}</strong></div>
        <label className="block text-sm font-semibold">លេខកូដពីអ៊ីមែល</label>
        <Input value={secret} onChange={(event) => setSecret(event.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="បញ្ចូលលេខកូដ" className="h-12 border-white/10 bg-slate-950/60" />
        <Button type="button" onClick={verifyCode} disabled={busy} className="h-12 w-full bg-amber-400 font-bold text-slate-950 hover:bg-amber-300">{busy ? "កំពុងបញ្ជាក់…" : "បញ្ជាក់ និងចូលគណនី"}</Button>
        <button type="button" onClick={() => setUserId(null)} disabled={busy} className="w-full text-sm text-slate-300 underline-offset-4 hover:text-white hover:underline">ប្រើអ៊ីមែលផ្សេង</button>
      </div>}
      {error ? <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p> : null}
    </section>
  </main>;
}
