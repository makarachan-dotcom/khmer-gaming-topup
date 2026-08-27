import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "framer-motion";
import { Crown, Gift, Sparkles, Trophy, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";

export type LiveSpinMotionEvent = {
  id: string;
  status: "waiting" | "live" | "winner_revealed" | "prize_countdown" | "prize_revealed" | "ended";
  liveStartedAt: Date | string | null;
  winnerRevealedAt: Date | string | null;
  prizeCountdownStartedAt: Date | string | null;
  prizeRevealedAt: Date | string | null;
  nameStripSeconds: number;
  winnerSpoilerSeconds: number;
  winnerCelebrationSeconds: number;
  prizeCountdownSeconds: number;
};

type Winner = { rank: number; alias: string; prize: { nameKh: string; valueLabel: string; mediaUrl: string | null } | null };
type Consolation = { rank: number; alias: string; gift: { nameKh: string; valueLabel: string; mediaUrl: string | null } | null };
type VisualPhase = "intro" | "countdown" | "spin" | "spoiler" | "winner" | "prize" | "ending";

const INTRO_SECONDS = 58;
const COUNTDOWN_SECONDS = 10;
const SPIN_SECONDS = 28;
const DEMO_ALIASES = ["ZRS-••A7", "ZRS-••D2", "ZRS-••F9", "ZRS-••K4", "ZRS-••Q8", "ZRS-••M6", "ZRS-••R1", "ZRS-••T3"];

function at(value: Date | string | null) {
  const result = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(result) ? result : 0;
}

function phaseFromServer(event: LiveSpinMotionEvent, serverNow: number): { phase: VisualPhase; elapsed: number; number: number } {
  if (event.status === "live") {
    const elapsed = Math.max(0, (serverNow - at(event.liveStartedAt)) / 1000);
    if (elapsed < INTRO_SECONDS) return { phase: "intro", elapsed, number: 0 };
    if (elapsed < INTRO_SECONDS + COUNTDOWN_SECONDS) return { phase: "countdown", elapsed: elapsed - INTRO_SECONDS, number: Math.max(0, COUNTDOWN_SECONDS - Math.floor(elapsed - INTRO_SECONDS)) };
    return { phase: "spin", elapsed: elapsed - INTRO_SECONDS - COUNTDOWN_SECONDS, number: 0 };
  }
  if (event.status === "winner_revealed") {
    const elapsed = Math.max(0, (serverNow - at(event.winnerRevealedAt)) / 1000);
    return elapsed < event.winnerSpoilerSeconds ? { phase: "spoiler", elapsed, number: Math.ceil(event.winnerSpoilerSeconds - elapsed) } : { phase: "winner", elapsed: elapsed - event.winnerSpoilerSeconds, number: 0 };
  }
  if (event.status === "prize_countdown") {
    const elapsed = Math.max(0, (serverNow - at(event.prizeCountdownStartedAt)) / 1000);
    return { phase: "prize", elapsed, number: Math.max(0, Math.ceil(event.prizeCountdownSeconds - elapsed)) };
  }
  return { phase: "ending", elapsed: Math.max(0, (serverNow - at(event.prizeRevealedAt)) / 1000), number: 0 };
}

export function liveSpinAudioPhase(event: LiveSpinMotionEvent, serverNow: number) {
  return phaseFromServer(event, serverNow).phase;
}

export default function LiveSpinExperience({ event, serverNow, aliases, winners, consolation, muted, onToggleMute }: { event: LiveSpinMotionEvent; serverNow: number; aliases: string[]; winners: Winner[]; consolation: Consolation[]; muted: boolean; onToggleMute: () => void }) {
  const reducedMotion = useReducedMotion();
  const [skip, setSkip] = useState(false);
  const livePhase = phaseFromServer(event, serverNow);
  const phase = skip ? (event.status === "live" ? "spin" : event.status === "winner_revealed" ? "winner" : event.status === "prize_countdown" ? "prize" : "ending") : livePhase.phase;
  const visibleWinners = winners.length ? winners : [{ rank: 1, alias: "ZRS-••••", prize: null }, { rank: 2, alias: "ZRS-••••", prize: null }, { rank: 3, alias: "ZRS-••••", prize: null }];
  const participantAliases = aliases.length ? aliases : DEMO_ALIASES;
  const staticAliases = useMemo(() => participantAliases.concat(participantAliases.slice(0, Math.max(5, participantAliases.length))), [participantAliases]);

  useEffect(() => { setSkip(false); }, [event.id, event.status]);

  return <MotionConfig reducedMotion="user"><section className="live-spin-motion mt-6 overflow-hidden rounded-[1.7rem] border border-cyan-200/25 bg-slate-950 shadow-[0_24px_70px_rgba(8,47,73,0.35)]">
    <div className="relative min-h-[25rem] overflow-hidden p-4 sm:min-h-[31rem] sm:p-7">
      <motion.div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(251,191,36,0.24),transparent_34%),radial-gradient(circle_at_15%_90%,rgba(34,211,238,0.18),transparent_33%)]" animate={reducedMotion ? undefined : phase === "spin" ? { opacity: [0.55, 1, 0.62], scale: [1, 1.035, 1] } : { opacity: [0.8, 1, 0.8] }} transition={{ duration: phase === "spin" ? 0.65 : 3.2, repeat: Infinity, ease: "easeInOut" }} />
      <Particles active={phase === "winner" || phase === "ending"} />
      <div className="relative z-10 flex items-center justify-between gap-1.5"><div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-100/20 bg-slate-950/55 px-2.5 py-1.5 text-[10px] font-extrabold tracking-[0.1em] text-cyan-100"><span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_15px_#67e8f9]" />LIVE</div><div className="flex shrink-0 items-center gap-1.5"><button type="button" onClick={onToggleMute} className="min-h-9 rounded-full border border-white/15 bg-white/10 px-2 py-1.5 text-[10px] font-bold text-white transition hover:bg-white/20">{muted ? "បើកសំឡេង" : "បិទសំឡេង"}</button><button type="button" onClick={() => setSkip(true)} className="min-h-9 rounded-full border border-white/15 bg-white/10 px-2 py-1.5 text-[10px] font-bold text-slate-100 transition hover:bg-white/20">រំលង</button></div></div>
      <AnimatePresence mode="wait">
        {phase === "intro" ? <NameArrival key="intro" aliases={participantAliases} elapsed={livePhase.elapsed} /> : null}
        {phase === "countdown" ? <Countdown key={`countdown-${livePhase.number}`} number={skip ? 0 : livePhase.number} /> : null}
        {phase === "spin" ? <SlotSpin key="spin" aliases={staticAliases} elapsed={livePhase.elapsed} total={Math.max(SPIN_SECONDS, event.nameStripSeconds - INTRO_SECONDS - COUNTDOWN_SECONDS)} /> : null}
        {phase === "spoiler" ? <SpoilerPause key="spoiler" count={livePhase.number} /> : null}
        {phase === "winner" ? <WinnerCelebration key="winner" winners={visibleWinners} /> : null}
        {phase === "prize" ? <PrizeWheel key="prize" winners={visibleWinners} count={skip ? 0 : livePhase.number} /> : null}
        {phase === "ending" ? <EndingCeremony key="ending" winners={visibleWinners} consolation={consolation} /> : null}
      </AnimatePresence>
    </div>
  </section></MotionConfig>;
}

function NameArrival({ aliases, elapsed }: { aliases: string[]; elapsed: number }) {
  return <motion.div className="mx-auto mt-8 max-w-md text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }}><p className="text-xs font-extrabold tracking-[0.2em] text-cyan-100">PARTICIPANTS ARRIVING</p><h3 className="mt-3 font-display text-3xl font-bold text-white sm:text-5xl">សូមត្រៀមខ្លួន</h3><div className="mt-6 space-y-2 overflow-hidden rounded-2xl border border-amber-200/20 bg-black/25 p-3">{aliases.map((alias, index) => <motion.div key={alias} className="rounded-xl border border-amber-200/20 bg-amber-200/10 px-4 py-2 font-display text-lg font-bold tracking-[0.12em] text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.14)]" initial={{ opacity: 0, x: index % 2 ? 90 : -90, scale: 0.82 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ type: "spring", stiffness: 280, damping: 18, delay: Math.max(0, index * 0.36 - elapsed) }}>{alias}</motion.div>)}</div><p className="mt-5 text-xs text-slate-300">បញ្ជីនេះបង្ហាញតែ alias សុវត្ថិភាព។ កំពុងរៀបចំការចាប់រង្វាន់ដោយ server…</p></motion.div>;
}

function Countdown({ number }: { number: number }) {
  return <motion.div className="grid min-h-[19rem] place-items-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.3 }}><div><p className="mb-3 text-xs font-extrabold tracking-[0.22em] text-amber-100">LIVE STARTS NOW</p><motion.p key={number} className="font-display text-[9rem] font-black leading-none text-amber-200 drop-shadow-[0_0_32px_rgba(251,191,36,0.72)] sm:text-[13rem]" initial={{ opacity: 0, scale: 0.45, rotate: -8 }} animate={{ opacity: [0.5, 1, 1], scale: [0.65, 1.16, 1], rotate: [4, -2, 0] }} transition={{ duration: 0.72, ease: "easeOut" }}>{number}</motion.p><p className="mt-4 text-sm font-bold text-white">Live Spin ចាប់ផ្តើមក្នុងពេលឆាប់ៗនេះ</p></div></motion.div>;
}

function SlotSpin({ aliases, elapsed, total }: { aliases: string[]; elapsed: number; total: number }) {
  const progress = Math.min(1, elapsed / Math.max(1, total));
  const y = -((progress < 0.7 ? progress * 26 : 18.2 + (progress - 0.7) * 5.8) * 58);
  const duration = Math.max(0.18, 0.62 - progress * 0.43);
  return <motion.div className="mx-auto mt-9 max-w-md text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><p className="text-xs font-extrabold tracking-[0.2em] text-cyan-100">SERVER-SIDE SPIN</p><h3 className="mt-3 font-display text-3xl font-bold text-white sm:text-5xl">កំពុងបង្វិល…</h3><div className="relative mt-7 h-44 overflow-hidden rounded-[1.4rem] border border-amber-200/35 bg-black/45 shadow-[inset_0_0_45px_rgba(0,0,0,0.72),0_0_35px_rgba(251,191,36,0.15)]"><div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-14 -translate-y-1/2 border-y border-amber-200/80 bg-amber-200/10 shadow-[0_0_30px_rgba(251,191,36,0.25)]" /><motion.div className="pt-10" animate={{ y }} transition={{ duration, ease: progress > 0.75 ? [0.08, 0.85, 0.35, 1] : "linear" }}>{aliases.map((alias, index) => <p key={`${alias}-${index}`} className="h-[58px] font-display text-3xl font-bold tracking-[0.12em] text-white/80 sm:text-4xl">{alias}</p>)}</motion.div></div><motion.p className="mt-5 text-xs font-bold text-amber-100" animate={{ opacity: [0.65, 1, 0.65], scale: [0.99, 1.02, 0.99] }} transition={{ duration, repeat: Infinity }}>Heartbeat កំពុងបង្កើនល្បឿន…</motion.p></motion.div>;
}

function SpoilerPause({ count }: { count: number }) {
  return <motion.div className="grid min-h-[20rem] place-items-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div><motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.72, repeat: Infinity }}><WandSparkles className="mx-auto h-14 w-14 text-amber-200" /></motion.div><p className="mt-6 text-xs font-extrabold tracking-[0.2em] text-amber-100">THE RESULT IS LOCKED</p><h3 className="mt-3 font-display text-4xl font-bold text-white">លទ្ធផលជិតបង្ហាញ</h3><p className="mt-6 font-display text-7xl font-black tabular-nums text-amber-200">{count}</p></div></motion.div>;
}

function WinnerCelebration({ winners }: { winners: Winner[] }) {
  return <motion.div className="mx-auto mt-8 max-w-4xl text-center" initial={{ opacity: 0, scale: 0.82 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -16 }}><motion.div animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.14, 1] }} transition={{ duration: 0.9 }}><Trophy className="mx-auto h-12 w-12 text-amber-200 drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]" /></motion.div><p className="mt-4 text-xs font-extrabold tracking-[0.2em] text-amber-100">WINNERS REVEALED</p><h3 className="mt-2 font-display text-4xl font-black text-white sm:text-6xl">អ្នកឈ្នះទាំង {winners.length}!</h3><div className="mt-7 grid grid-cols-3 gap-2 sm:gap-3">{winners.map((winner) => <motion.article key={winner.rank} className="rounded-2xl border border-amber-100/35 bg-gradient-to-br from-amber-200/25 to-white/10 p-2.5 shadow-[0_0_28px_rgba(251,191,36,0.18)] sm:p-4" initial={{ opacity: 0, y: 42, scale: 0.65 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 16 }}><Crown className="mx-auto h-5 w-5 text-amber-200 sm:h-7 sm:w-7" /><p className="mt-2 text-[8px] font-bold text-amber-100 sm:text-[10px]">WINNER #{winner.rank}</p><p className="mt-1 font-display text-base font-black tracking-[0.04em] text-white sm:text-2xl sm:tracking-[0.08em]">{winner.alias}</p></motion.article>)}</div></motion.div>;
}

function PrizeWheel({ winners, count }: { winners: Winner[]; count: number }) {
  return <motion.div className="mx-auto mt-8 max-w-3xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Gift className="mx-auto h-11 w-11 text-amber-200" /><p className="mt-4 text-xs font-extrabold tracking-[0.2em] text-amber-100">PRIZE SPIN</p><h3 className="mt-2 font-display text-3xl font-bold text-white">កំពុងបន្តទៅបង្វិលរង្វាន់…</h3><motion.div className="mx-auto mt-7 grid h-36 w-36 place-items-center rounded-full border-[10px] border-amber-200/80 bg-[conic-gradient(#fbbf24_0deg_45deg,#164e63_45deg_90deg,#fde68a_90deg_135deg,#0f172a_135deg_180deg,#f59e0b_180deg_225deg,#155e75_225deg_270deg,#fde68a_270deg_315deg,#1e293b_315deg)] shadow-[0_0_38px_rgba(251,191,36,0.42)]" animate={{ rotate: [0, 680, 1420] }} transition={{ duration: 4.5, ease: [0.08, 0.76, 0.25, 1] }}><span className="grid h-16 w-16 place-items-center rounded-full bg-slate-950 font-display text-4xl font-black text-amber-200">{count}</span></motion.div><div className="mt-6 grid gap-2 sm:grid-cols-3">{winners.map((winner) => <motion.div key={winner.rank} className="rounded-xl border border-white/15 bg-white/10 p-3" initial={{ rotateY: 88, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ delay: 2.7 + winner.rank * 0.2 }}><p className="text-[10px] font-bold text-amber-100">#{winner.rank} · {winner.alias}</p><p className="mt-1 text-sm font-bold text-white">{winner.prize?.nameKh ?? "រង្វាន់កំពុងបើក"}</p></motion.div>)}</div></motion.div>;
}

function EndingCeremony({ winners, consolation }: { winners: Winner[]; consolation: Consolation[] }) {
  const consolationLabelCount = Math.max(10, consolation.length);
  return <motion.div className="mx-auto mt-5 max-w-3xl text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><motion.img src="https://khmergame-girzfgts.manus.space/manus-storage/khmer-sampeah_c98896ca.png" alt="ការគោរពសំពះ" className="mx-auto h-44 w-auto object-contain drop-shadow-[0_0_30px_rgba(251,191,36,0.38)] sm:h-52" initial={{ opacity: 0, y: 26, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 140, damping: 18 }} /><motion.p className="mt-2 text-xs font-extrabold tracking-[0.18em] text-amber-100" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>THANK YOU FOR JOINING</motion.p><motion.h3 className="mt-2 font-display text-3xl font-black text-white sm:text-5xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>អរគុណសម្រាប់ការចូលរួម</motion.h3><motion.p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>ជូនពរអ្នកឈ្នះទាំងអស់ និងអរគុណសម្រាប់ការគាំទ្រ ZURS។</motion.p><div className="mt-6 grid gap-3 text-left sm:grid-cols-2"><motion.div className="rounded-2xl border border-amber-100/20 bg-white/10 p-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}><p className="text-xs font-bold text-amber-100">អ្នកឈ្នះ</p>{winners.map((winner) => <p key={winner.rank} className="mt-2 text-sm font-bold text-white">#{winner.rank} · {winner.alias}</p>)}</motion.div><motion.div className="rounded-2xl border border-cyan-100/20 bg-white/10 p-4" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1 }} transition={{ delay: 1.15 }}><p className="text-xs font-bold text-cyan-100">Top {consolationLabelCount} អ្នកតភ្ជាប់យូរជាងគេ</p><p className="mt-2 text-xs leading-5 text-slate-300">គិតតាមរយៈពេលតភ្ជាប់ជាមួយ Live មិនមែនការមើលអេក្រង់ផ្ទាល់ទេ។</p>{consolation.slice(0, 4).map((item) => <p key={item.rank} className="mt-2 text-sm font-bold text-white">#{item.rank} · {item.alias}</p>)}</motion.div></div><Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-amber-300 px-5 text-sm font-extrabold text-slate-950 transition hover:bg-amber-200">ត្រឡប់ទៅទំព័រដើម</Link></motion.div>;
}

function Particles({ active }: { active: boolean }) {
  const particles = useMemo(() => Array.from({ length: 20 }, (_, index) => ({ id: index, left: `${(index * 37) % 98}%`, delay: (index % 6) * 0.13 })), []);
  return <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">{active ? particles.map((particle) => <motion.i key={particle.id} className="absolute top-[-1rem] h-1.5 w-1.5 rounded-full bg-amber-200" style={{ left: particle.left }} initial={{ opacity: 0, y: -8, rotate: 0 }} animate={{ opacity: [0, 1, 1, 0], y: [0, 280, 520, 660], rotate: [0, 180, 450] }} transition={{ duration: 3.4 + (particle.id % 3) * 0.35, delay: particle.delay, repeat: Infinity, ease: "linear" }} />) : null}</div>;
}
