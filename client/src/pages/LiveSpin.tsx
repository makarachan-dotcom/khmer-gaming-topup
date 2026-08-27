import StorefrontLayout from "@/components/StorefrontLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import Ably from "ably";
import { Crown, Eye, Gift, LockKeyhole, Sparkles, Ticket, Trophy, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";

type LiveSpinEvent = {
  id: string;
  status: "draft" | "announced" | "locked" | "waiting" | "live" | "winner_revealed" | "prize_countdown" | "prize_revealed" | "ended" | "skipped";
  isTest: boolean;
  scheduledAt: Date | string;
  announcementStartsAt: Date | string | null;
  entryCutoffAt: Date | string;
  lobbyStartsAt: Date | string | null;
  liveStartedAt: Date | string | null;
  winnerRevealedAt: Date | string | null;
  prizeCountdownStartedAt: Date | string | null;
  prizeRevealedAt: Date | string | null;
  nameStripSeconds: number;
  adMediaUrl: string | null;
  adDurationSeconds: number;
  minParticipantCount: number;
  spinEnabled: boolean;
  winnerCount: number;
  consolationGiftCount: number;
  settingsSnapshotHash: string | null;
  winnerSpoilerSeconds: number;
  prizeCountdownSeconds: number;
  fairnessCommitmentHash: string | null;
  participantSnapshotHash: string | null;
  revealedFairnessSeed: string | null;
};

type LiveSpinState = {
  serverNow: Date | string;
  event: LiveSpinEvent | null;
  participantCount: number;
  entryCount: number;
  thresholdReached: boolean;
  winner: { alias: string } | null;
  prize: { nameKh: string; valueLabel: string; mediaUrl: string | null } | null;
  winners: { rank: number; alias: string; prize: { nameKh: string; valueLabel: string; mediaUrl: string | null } | null }[];
  consolation: { rank: number; alias: string; gift: { nameKh: string; valueLabel: string; mediaUrl: string | null } | null }[];
};

function toTime(value: Date | string | null | undefined) {
  const parsed = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function useServerClock(serverNow: Date | string | undefined) {
  const [offset, setOffset] = useState(0);
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const time = toTime(serverNow);
    if (Number.isFinite(time)) setOffset(time - Date.now());
  }, [serverNow]);
  useEffect(() => {
    const timer = window.setInterval(() => setTick(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  return tick + offset;
}

function useCountdown(target: Date | string | null | undefined, serverNow: number) {
  const targetTime = toTime(target);
  const remaining = Number.isFinite(targetTime) ? Math.max(0, Math.ceil((targetTime - serverNow) / 1000)) : 0;
  return {
    remaining,
    minutes: String(Math.floor(remaining / 60)).padStart(2, "0"),
    seconds: String(remaining % 60).padStart(2, "0"),
  };
}

function plusSeconds(value: Date | string | null | undefined, seconds: number) {
  const time = toTime(value);
  return Number.isFinite(time) ? new Date(time + seconds * 1000) : null;
}

const liveSpinSounds = {
  intro: "/live-spin-audio/sound1-intro.mp3",
  countdown: "/live-spin-audio/sound2-countdown.aac",
  heartbeat: "/live-spin-audio/sound3-heartbeat.aac",
  result: "/live-spin-audio/sound4-result.aac",
  outro: "/live-spin-audio/sound5-outro.mp3",
} as const;

type LiveSpinSound = keyof typeof liveSpinSounds;

function useLiveSpinAudio({ event, muted, finalCountdown, stripRemaining }: { event: LiveSpinEvent; muted: boolean; finalCountdown: boolean; stripRemaining: number }) {
  const players = useRef<Partial<Record<LiveSpinSound, HTMLAudioElement>>>({});
  const lastCue = useRef<string | null>(null);
  useEffect(() => {
    (Object.entries(liveSpinSounds) as [LiveSpinSound, string][]).forEach(([name, source]) => {
      const player = new Audio(source);
      player.preload = "auto";
      player.load();
      players.current[name] = player;
    });
    return () => Object.values(players.current).forEach((player) => { player?.pause(); player && (player.src = ""); });
  }, [event.id]);
  useEffect(() => {
    const all = Object.values(players.current);
    if (muted) { all.forEach((player) => player?.pause()); return; }
    const cue: LiveSpinSound | null = event.status === "live" ? "heartbeat" : event.status === "winner_revealed" ? "result" : event.status === "ended" ? "outro" : finalCountdown ? "countdown" : ["announced", "locked", "waiting"].includes(event.status) ? "intro" : null;
    all.forEach((player) => { if (player && player !== players.current[cue ?? "intro"]) player.pause(); });
    if (!cue) return;
    const player = players.current[cue];
    if (!player) return;
    player.loop = cue === "intro" || cue === "heartbeat";
    player.volume = cue === "heartbeat" ? 0.42 : cue === "outro" ? 0.5 : 0.72;
    if (cue === "heartbeat") player.playbackRate = stripRemaining <= 2 ? 1.5 : stripRemaining <= 4 ? 1.25 : 1;
    const key = `${event.id}:${event.status}:${cue}`;
    if (lastCue.current !== key || (cue === "heartbeat" && player.paused)) { lastCue.current = key; player.currentTime = cue === "heartbeat" || cue === "intro" ? 0 : player.currentTime; void player.play().catch(() => undefined); }
  }, [event.id, event.status, finalCountdown, muted, stripRemaining]);
}

function LiveSpinRealtime({ eventId, enabled, onState }: { eventId: string; enabled: boolean; onState: () => void }) {
  const auth = trpc.liveSpin.realtimeAuth.useQuery({ eventId }, { enabled, staleTime: 45 * 60_000, refetchInterval: 45 * 60_000, retry: false });
  useEffect(() => {
    if (!enabled || !auth.data?.enabled || !auth.data.tokenRequest || !auth.data.channelName) return;
    const realtime = new Ably.Realtime({ authCallback: async () => auth.data!.tokenRequest! });
    const channel = realtime.channels.get(auth.data.channelName);
    const listener = () => onState();
    void channel.subscribe("state", listener);
    return () => { channel.unsubscribe("state", listener); realtime.close(); };
  }, [auth.data?.channelName, auth.data?.enabled, auth.data?.tokenRequest, enabled, onState]);
  return null;
}

export default function LiveSpin() {
  const state = trpc.liveSpin.state.useQuery(undefined, { refetchInterval: 12_000, refetchOnWindowFocus: true });
  const event = state.data?.event;
  const refetch = useCallback(() => { void state.refetch(); }, [state]);
  return <StorefrontLayout><LiveSpinRealtime eventId={event?.id ?? "waiting"} enabled={Boolean(event)} onState={refetch} /><main className="container pb-6 pt-[calc(env(safe-area-inset-top)+1.5rem)] sm:py-10"><section className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-cyan-200/30 bg-slate-950 px-4 py-6 text-white shadow-2xl shadow-cyan-950/25 sm:px-8 sm:py-10"><div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" /><div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-amber-300/15 blur-3xl" /><div className="relative"><header className="flex flex-wrap items-start justify-between gap-4"><div><div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.16em] text-cyan-100"><Sparkles className="h-3.5 w-3.5" />ZURS WEEKLY LIVE SPIN</div><h1 className="mt-4 max-w-xl break-words font-display text-2xl font-bold leading-tight tracking-tight sm:text-5xl">Live Spin សង្ឃឹមថា</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">កម្មវិធីរង្វាន់សម្រាប់អតិថិជន ZURS។ សំបុត្ររបស់អ្នកត្រូវបានបញ្ជាក់ដោយ server និងលទ្ធផលមាន fairness proof អាចផ្ទៀងផ្ទាត់បាន។</p></div><Link href="/account" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-bold text-white transition hover:bg-white/15"><Ticket className="h-4 w-4 text-amber-300" />មើល Tickets របស់ខ្ញុំ</Link></header>{state.isLoading ? <LoadingCard /> : !event ? <UpcomingCard /> : <LiveSpinStage state={state.data!} />}</div></section><section className="mx-auto mt-5 grid max-w-5xl gap-3 md:grid-cols-3"><InfoCard icon={<Ticket className="h-4 w-4" />} title="7 orders = 1 ticket" body="ការទិញដែលបានបង់ប្រាក់រួច និងមានតម្លៃយ៉ាងហោច $1 ចំនួន 7 ដងក្នុងសប្តាហ៍ដូចគ្នា នឹងទទួលបាន 1 ticket។" /><InfoCard icon={<LockKeyhole className="h-4 w-4" />} title="Roll-over ដោយស្វ័យប្រវត្តិ" body="ប្រសិនបើមិនទាន់ដល់ 100 អ្នកចូលរួម សប្តាហ៍នោះត្រូវ skip ហើយ tickets នៅសល់ទៅ event បន្ទាប់។" /><InfoCard icon={<Crown className="h-4 w-4" />} title="18+ customer loyalty reward" body="សម្រាប់អតិថិជនអាយុ 18 ឆ្នាំឡើង និងស្ថិតក្រោម Giveaway Terms របស់ ZURS។" /></section></main></StorefrontLayout>;
}

function LiveSpinConnectionConsent({ event }: { event: LiveSpinEvent }) {
  const { user } = useAuth();
  const [consented, setConsented] = useState(false);
  const begin = trpc.liveSpin.beginConnection.useMutation({ onSuccess: () => setConsented(true) });
  const heartbeat = trpc.liveSpin.heartbeatConnection.useMutation();
  useEffect(() => { if (!consented) return; const timer = window.setInterval(() => heartbeat.mutate({ eventId: event.id }), 15_000); return () => window.clearInterval(timer); }, [consented, event.id]);
  if (event.isTest || event.status === "ended") return null;
  if (!user) return <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-xs leading-5 text-slate-300">ចូលគណនីដើម្បីមានសិទ្ធិទទួលកាដូលើកទឹកចិត្តតាមរយៈពេលតភ្ជាប់។</div>;
  if (consented) return <p className="mt-4 text-[11px] text-emerald-200">បានយល់ព្រមកត់ត្រា connection timestamps សម្រាប់ Live Spin នេះ។</p>;
  return <div className="mt-4 rounded-xl border border-cyan-200/20 bg-cyan-200/10 p-3 text-xs leading-5 text-cyan-50"><p>ដើម្បីចូលរួម Live Spin យើងកត់ត្រារយៈពេលចូលរួមរបស់អ្នកក្នុងគណនី (connection time) ប៉ុណ្ណោះ មិនមែនការមើលអេក្រង់ផ្ទាល់ទេ។ សូមអាន <Link href="/terms" className="font-bold underline">Terms</Link>។</p><button type="button" disabled={begin.isPending} onClick={() => begin.mutate({ eventId: event.id })} className="mt-2 h-8 rounded-lg bg-cyan-300 px-3 text-[11px] font-bold text-slate-950 disabled:opacity-50">យល់ព្រម និងចូលរួម</button></div>;
}

function LiveSpinStage({ state }: { state: LiveSpinState }) {
  const event = state.event!;
  const serverNow = useServerClock(state.serverNow);
  const waiting = useCountdown(event.scheduledAt, serverNow);
  const nameStrip = useCountdown(plusSeconds(event.liveStartedAt, event.nameStripSeconds), serverNow);
  const spoiler = useCountdown(plusSeconds(event.winnerRevealedAt, event.winnerSpoilerSeconds), serverNow);
  const prizeCountdown = useCountdown(plusSeconds(event.prizeCountdownStartedAt, event.prizeCountdownSeconds), serverNow);
  const [muted, setMuted] = useState(true);
  const finalCountdown = event.status === "waiting" && waiting.remaining > 0 && waiting.remaining <= 10;
  useLiveSpinAudio({ event, muted, finalCountdown, stripRemaining: nameStrip.remaining });
  const statusTitle: Record<string, string> = { announced: "កំពុងរៀបចំ Live Spin", locked: "បញ្ជីអ្នកចូលរួមត្រូវបាន lock", waiting: "Waiting Lobby", live: "Live Spin កំពុងដំណើរការ", winner_revealed: "អ្នកឈ្នះត្រូវបានជ្រើស", prize_countdown: "រង្វាន់ជិតបង្ហាញ", prize_revealed: "រង្វាន់ត្រូវបានបង្ហាញ", ended: "Live Spin បានបញ្ចប់" };
  const inLiveWindow = ["waiting", "live", "winner_revealed", "prize_countdown", "prize_revealed"].includes(event.status);
  return <div className="mt-7">{event.isTest ? <div className="fixed left-1/2 top-[max(4.25rem,calc(env(safe-area-inset-top)+3.75rem))] z-40 w-[min(calc(100vw-2rem),30rem)] -translate-x-1/2 rounded-full border border-amber-200/60 bg-amber-300 px-4 py-2 text-center text-[10px] font-extrabold tracking-[0.12em] text-slate-950 shadow-lg shadow-amber-950/30">LIVE SPIN TEST · TEST ONLY · VIEW-ONLY</div> : null}<div className="grid grid-cols-2 gap-2 sm:gap-3"><div className="col-span-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3"><p className="text-[10px] font-bold tracking-[0.14em] text-cyan-200">{inLiveWindow ? "LIVE STATUS" : "UPCOMING"}</p><h2 className="mt-1 break-words font-display text-xl font-bold leading-snug sm:text-2xl">{statusTitle[event.status] ?? "Live Spin"}</h2></div><div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-300">PARTICIPANTS</p><p className="mt-1 font-display text-lg font-bold text-amber-200">{state.participantCount} <span className="text-xs text-slate-300">/ {event.minParticipantCount}</span></p></div><div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-300">ចំនួនអ្នកឈ្នះ</p><p className="mt-1 font-display text-lg font-bold text-amber-200">{event.winnerCount}</p></div><button type="button" onClick={() => setMuted((value) => !value)} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.08] p-3 text-left transition hover:bg-white/[0.14]" aria-label={muted ? "បើកសំឡេង Live Spin" : "បិទសំឡេង Live Spin"}><span className="text-[10px] font-bold tracking-[0.12em] text-slate-300">SOUND</span><span className="mt-1 flex items-center gap-2 text-xs font-bold text-white">{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4 text-amber-200" />}{muted ? "បិទ" : "បើក"}</span></button><div className="rounded-2xl border border-white/10 bg-white/[0.08] p-3"><p className="text-[10px] font-bold tracking-[0.12em] text-slate-300">TIME</p><p className="mt-1 font-display text-lg font-bold tabular-nums text-white">{waiting.minutes}:{waiting.seconds}</p></div></div>{event.status === "waiting" ? <AdGate url={event.adMediaUrl} duration={event.adDurationSeconds} muted={muted} onToggleMute={() => setMuted((value) => !value)} countdown={waiting} serverNow={serverNow} /> : null}{event.status === "live" ? <NameStrip entryCount={state.entryCount} countdown={nameStrip} /> : null}{event.status === "winner_revealed" ? <WinnerReveal winners={state.winners} countdown={spoiler} /> : null}{event.status === "prize_countdown" ? <PrizeCountdown winners={state.winners} countdown={prizeCountdown} /> : null}{event.status === "prize_revealed" || event.status === "ended" ? <PrizeReveal winners={state.winners} consolation={state.consolation} ended={event.status === "ended"} /> : null}{["announced", "locked"].includes(event.status) ? <WaitingLobby countdown={waiting} state={state} /> : null}<LiveSpinConnectionConsent event={event} /><div className="mt-5 rounded-2xl border border-cyan-200/20 bg-cyan-200/10 p-3 text-xs leading-5 text-cyan-50">{event.spinEnabled ? <>សប្តាហ៍នេះ៖ <strong>អ្នកឈ្នះ {event.winnerCount} នាក់ + កាដូលើកទឹកចិត្ត {event.consolationGiftCount} នាក់</strong> • ត្រូវការ <strong>{event.minParticipantCount}</strong> អ្នកកាន់ ticket។</> : <strong>Live Spin ត្រូវបានផ្អាក ជាបណ្តោះអាសន្ន។ Tickets ដែលមានសិទ្ធិនឹង roll over ទៅ event បន្ទាប់។</strong>}</div><div className="mt-5 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-cyan-100"><LockKeyhole className="h-4 w-4" /><p className="text-xs font-bold">Fairness commitment</p></div><p className="mt-2 break-all font-mono text-[10px] leading-5 text-slate-400">{event.fairnessCommitmentHash ?? "Commitment will be published before Live Spin."}</p><p className="mt-2 text-[11px] leading-5 text-slate-300">Server បង្កើត seed ដោយសុវត្ថិភាព, lock participant snapshot មុន spin ហើយបង្ហាញ seed បន្ទាប់ពី prize reveal។</p></div><div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-amber-200"><Trophy className="h-4 w-4" /><p className="text-xs font-bold">Sunday · 3:00 PM</p></div><p className="mt-2 text-[11px] leading-5 text-slate-300">ម៉ោងកម្ពុជា (Asia/Phnom_Penh)។ ការរាប់ថយក្រោយប្រើ server time ដែលបាន sync ជាមួយ device របស់អ្នក។</p></div></div></div>;
}

function AdGate({ url, duration, muted, onToggleMute, countdown, serverNow }: { url: string | null; duration: number; muted: boolean; onToggleMute: () => void; countdown: ReturnType<typeof useCountdown>; serverNow: number }) {
  const [adStartedAt, setAdStartedAt] = useState<number | null>(null);
  useEffect(() => { setAdStartedAt(null); }, [url]);
  const requiredEndsAt = adStartedAt ? adStartedAt + Math.max(0, duration) * 1_000 : null;
  const adRemaining = requiredEndsAt ? Math.max(0, Math.ceil((requiredEndsAt - serverNow) / 1_000)) : Math.max(0, duration);
  const finalTenSeconds = countdown.remaining > 0 && countdown.remaining <= 10;
  return <div className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl"><div className="relative aspect-[9/12] max-h-[520px] w-full overflow-hidden bg-gradient-to-br from-cyan-900 via-slate-950 to-amber-950 sm:aspect-[16/9]"><div className="absolute inset-0 grid place-items-center p-6 text-center"><div><Gift className="mx-auto h-10 w-10 text-amber-200" /><h3 className="mt-4 font-display text-2xl font-bold">Giveaway is about to begin</h3><p className="mt-2 text-sm text-slate-300">សូមរង់ចាំ countdown និងស្តាប់ការណែនាំ។</p></div></div>{url ? <video src={url} muted={muted} autoPlay playsInline controls={false} onPlay={() => setAdStartedAt((value) => value ?? serverNow)} className="absolute inset-0 h-full w-full object-cover" /> : null}<div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/85 to-transparent p-4 sm:p-6"><div><p className="text-[10px] font-bold tracking-[0.16em] text-cyan-100">{finalTenSeconds ? "LIVE STARTS NOW" : "LIVE STARTS IN"}</p><p className="mt-1 font-display text-3xl font-bold tabular-nums">{countdown.minutes}:{countdown.seconds}</p>{url && duration > 0 ? <p className="mt-1 text-[10px] text-slate-300">Advertisement: {String(adRemaining).padStart(2, "0")}s</p> : null}</div><button type="button" onClick={onToggleMute} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur transition hover:bg-white/25" aria-label={muted ? "បើកសំឡេង" : "បិទសំឡេង"}>{muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}</button></div></div></div>;
}

function WaitingLobby({ countdown, state }: { countdown: ReturnType<typeof useCountdown>; state: LiveSpinState }) { return <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] p-5 sm:p-8"><div className="grid gap-6 md:grid-cols-[1.1fr_0.9fr] md:items-center"><div><div className="inline-flex items-center gap-2 rounded-full bg-cyan-300/10 px-3 py-1.5 text-xs font-bold text-cyan-100"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_#67e8f9]" />LOBBY OPEN</div><h3 className="mt-4 font-display text-3xl font-bold">រង់ចាំ Live Spin</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-300">អ្នកចូលរួម និង tickets ត្រូវបានបញ្ជាក់ដោយ server។ នៅពេលបញ្ជី lock មិនអាចបន្ថែម ឬកែ entry បានទេ។</p><div className="mt-5 flex items-center gap-3"><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[10px] font-bold tracking-wider text-slate-400">TIME LEFT</p><p className="mt-1 font-display text-3xl font-bold tabular-nums text-amber-200">{countdown.minutes}:{countdown.seconds}</p></div><div className="rounded-2xl bg-white/10 px-4 py-3"><p className="text-[10px] font-bold tracking-wider text-slate-400">ELIGIBLE</p><p className="mt-1 text-xl font-bold">{state.participantCount}</p></div></div></div><div className="relative mx-auto grid aspect-square w-full max-w-64 place-items-center rounded-full border-[12px] border-cyan-200/20 bg-slate-900 shadow-[0_0_90px_rgba(34,211,238,0.18)]"><div className="absolute inset-3 rounded-full border border-dashed border-amber-200/40" /><div className="text-center"><Eye className="mx-auto h-7 w-7 text-cyan-200" /><p className="mt-2 text-sm font-bold">Fair lobby</p><p className="mt-1 text-[11px] text-slate-400">Snapshot before spin</p></div></div></div></div>; }

function NameStrip({ entryCount, countdown }: { entryCount: number; countdown: ReturnType<typeof useCountdown> }) { const aliases = ["ZRS-••A7", "ZRS-••D2", "ZRS-••F9", "ZRS-••K4", "ZRS-••Q8"]; return <div className="mt-6 overflow-hidden rounded-3xl border border-cyan-200/30 bg-gradient-to-br from-cyan-950 via-slate-950 to-slate-900 p-6 text-center shadow-[0_0_70px_rgba(34,211,238,0.16)]"><p className="text-xs font-bold tracking-[0.18em] text-cyan-100">SELECTING WINNER · SERVER-SIDE</p><div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/35 py-6"><div className="animate-pulse space-y-2 font-display text-3xl font-bold tracking-[0.12em] text-white sm:text-5xl">{aliases.map((alias) => <p key={alias} className="opacity-60">{alias}</p>)}</div></div><p className="mt-5 text-xs leading-5 text-slate-300">កំពុងជ្រើសពី {entryCount} entries ដែលបាន lock។ Browser មិនអាចកំណត់អ្នកឈ្នះបានទេ។</p><p className="mt-2 font-display text-2xl font-bold tabular-nums text-amber-200">{countdown.seconds}</p></div>; }

function WinnerReveal({ winners, countdown }: { winners: LiveSpinState["winners"]; countdown: ReturnType<typeof useCountdown> }) { return <div className="mt-6 rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-300/15 via-slate-950 to-slate-950 p-7 text-center shadow-[0_0_70px_rgba(251,191,36,0.15)]"><Trophy className="mx-auto h-9 w-9 text-amber-200" /><p className="mt-4 text-xs font-bold tracking-[0.18em] text-amber-100">WINNERS REVEALED TOGETHER</p><div className="mt-4 grid gap-2 sm:grid-cols-3">{winners.map((winner) => <div key={winner.rank} className="rounded-xl bg-white/10 px-3 py-3"><p className="text-[10px] font-bold text-amber-100">លេខ {winner.rank}</p><p className="mt-1 font-display text-2xl font-bold tracking-[0.08em] text-white">{winner.alias}</p></div>)}</div><p className="mt-4 text-sm text-slate-300">Spoiler pause មុនបង្ហាញរង្វាន់…</p><p className="mt-2 font-display text-4xl font-bold tabular-nums text-amber-200">{countdown.seconds}</p></div>; }

function PrizeCountdown({ winners, countdown }: { winners: LiveSpinState["winners"]; countdown: ReturnType<typeof useCountdown> }) { return <div className="mt-6 rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-300/15 via-slate-950 to-cyan-950 p-7 text-center"><Gift className="mx-auto h-10 w-10 text-amber-200" /><p className="mt-4 text-xs font-bold tracking-[0.18em] text-amber-100">PRIZES REVEAL IN · {winners.length} WINNERS</p><p className="mt-2 font-display text-6xl font-bold tabular-nums text-white">{countdown.seconds}</p></div>; }

function PrizeReveal({ winners, consolation, ended }: { winners: LiveSpinState["winners"]; consolation: LiveSpinState["consolation"]; ended: boolean }) { return <div className="mt-6 rounded-3xl border border-amber-200/30 bg-gradient-to-br from-amber-300/20 via-slate-950 to-cyan-950 p-7 text-center"><Gift className="mx-auto h-10 w-10 text-amber-200" /><p className="mt-4 text-xs font-bold tracking-[0.18em] text-amber-100">{ended ? "LIVE SPIN ENDED" : "PRIZES REVEALED"}</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{winners.map((winner) => <div key={winner.rank} className="rounded-2xl border border-white/10 bg-white/10 p-3"><p className="text-[10px] font-bold text-amber-100">លេខ {winner.rank} · {winner.alias}</p><p className="mt-2 text-sm font-bold text-white">{winner.prize?.nameKh ?? "រង្វាន់កំពុងរៀបចំ"}</p><p className="mt-1 text-xs text-amber-200">{winner.prize?.valueLabel}</p></div>)}</div>{ended ? <div className="mt-5 rounded-2xl bg-white/10 p-4"><p className="font-display text-xl font-bold text-amber-100">Top {consolation.length} អ្នកតភ្ជាប់យូរជាងគេ</p><p className="mt-1 text-[11px] text-slate-300">គិតតាមរយៈពេលតភ្ជាប់ជាមួយ Live (connection time), មិនមែនការមើលអេក្រង់ផ្ទាល់ទេ។</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{consolation.map((item) => <div key={item.rank} className="rounded-xl bg-slate-950/45 px-3 py-2 text-left text-xs text-white"><strong>#{item.rank} · {item.alias}</strong><span className="ml-2 text-amber-200">{item.gift?.nameKh ?? "កាដូលើកទឹកចិត្ត"}</span></div>)}</div></div> : null}<div className="mt-5 rounded-2xl border border-amber-200/20 bg-amber-200/10 p-4"><p className="font-display text-base font-bold text-amber-100">អបអរសាទរអ្នកឈ្នះទាំងអស់</p><p className="mt-1 text-sm text-slate-300">លទ្ធផលត្រូវបានកត់ត្រា និងអាចផ្ទៀងផ្ទាត់ fairness proof បាន។</p></div></div>; }

function UpcomingCard() { return <div className="mt-7 rounded-3xl border border-white/10 bg-white/[0.07] p-8 text-center"><CalendarMark /><h2 className="mt-4 font-display text-2xl font-bold">Live Spin ថ្មីកំពុងរៀបចំ</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-300">សូមចូលគណនី និងបំពេញការទិញដែលមានសិទ្ធិ ដើម្បីតាមដាន ticket របស់អ្នក។ Event ថ្មីនឹងត្រូវប្រកាសនៅទីនេះ។</p><Link href="/account" className="mt-5 inline-flex h-10 items-center rounded-xl bg-cyan-300 px-4 text-xs font-bold text-slate-950">ទៅគណនីរបស់ខ្ញុំ</Link></div>; }
function LoadingCard() { return <div className="mt-7 h-80 animate-pulse rounded-3xl bg-white/10 motion-reduce:animate-none" />; }
function CalendarMark() { return <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300/15 text-cyan-200"><Sparkles className="h-6 w-6" /></div>; }
function InfoCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) { return <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-50 text-indigo-700">{icon}</div><h2 className="mt-3 text-sm font-bold text-slate-900">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p></article>; }
