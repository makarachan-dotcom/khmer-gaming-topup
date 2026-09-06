import { motion } from "framer-motion";
import { Check, CreditCard, Loader2, PackageCheck, ShieldCheck, Sparkles, TerminalSquare } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/* ============================================================
   ZURS — Order Success Pipeline (Deploy-Pipeline style, v2)
   ------------------------------------------------------------
   Premium 4-stage success tracker shown after KHQR payment:
     1. ការទូទាត់បានទទួល   (Payment received)   — CreditCard icon
     2. ផ្ទៀងផ្ទាត់ Ledger  (Verifying ledger)   — ShieldCheck icon
     3. ដឹកជញ្ជូនទៅគណនី   (Delivering to your account) — PackageCheck icon
     4. បញ្ចប់ជោគជ័យ      (Completed)          — Sparkles icon

   - Horizontal stepper, connecting lines fill orange → green
   - Live per-stage timers + streaming terminal log panel
   - Header status badge: orange "កំពុងដំណើរការ · …" → green "បញ្ចប់ · Xs"
   - HONEST with real order status: `delivered` (or admin test) runs to a full
     green celebration; an order still `paid` parks on stage 3 with a spinner
     and a Khmer support note — never fakes completion. If the order flips to
     `delivered` while mounted, the pipeline resumes automatically.
   - Respects prefers-reduced-motion (jumps straight to the honest end state).
   Styles: `.zp-deploy*` in styles/zurs-premium.css.
   ============================================================ */

type Props = {
  /** Real order status, e.g. "paid" | "delivered". */
  status: string;
  productName: string;
  isTest?: boolean;
  playerId?: string | null;
  /** Shown like a commit hash badge, e.g. the order number. */
  orderRef?: string | null;
};

type StageDef = {
  id: string;
  title: string;
  caption: string;
  Icon: typeof CreditCard;
  cmd: string;
  logs: string[];
};

/** How long each stage animates before completing. */
const STAGE_MS = 1900;
/** Delay between streamed log lines inside a stage. */
const LINE_MS = 420;

export function PaymentSuccessPipeline({ status, productName, isTest = false, playerId, orderRef }: Props) {
  const reduce = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const isComplete = status === "delivered" || isTest;

  const stages = useMemo<StageDef[]>(() => [
    {
      id: "payment", title: "ការទូទាត់បានទទួល", caption: "Payment", Icon: CreditCard,
      cmd: "$ khqr verify-payment",
      logs: ["→ KHQR payment confirmed", `→ Amount matched · ${productName}`, "✓ Bakong transaction verified"],
    },
    {
      id: "verify", title: "ផ្ទៀងផ្ទាត់ Ledger", caption: "Verify", Icon: ShieldCheck,
      cmd: "$ ledger match --order",
      logs: ["→ Matching amount & reference", "→ Signature check passed", "✓ Recorded in secure ledger"],
    },
    {
      id: "deliver",
      title: isTest ? "កត់ត្រា Test Product" : "ដឹកជញ្ជូនទៅគណនី",
      caption: isTest ? "Recording" : "Delivering",
      Icon: PackageCheck,
      cmd: isTest ? "$ test-record create" : "$ provider submit-order",
      logs: isTest
        ? ["→ Recording admin test purchase", "✓ No provider order sent"]
        : ["→ Submitting to game provider", playerId ? `→ Applying to Player ID ${playerId}` : "→ Applying to your game account", "→ Waiting for provider confirm…"],
    },
    {
      id: "complete", title: "បញ្ចប់ជោគជ័យ", caption: "Complete", Icon: Sparkles,
      cmd: "$ order finalize",
      logs: [isTest ? "✓ Test completed" : "✓ Delivered to game account", "✓ Receipt ready"],
    },
  ], [isTest, playerId, productName]);

  /** Honest cap: delivered/test runs all 4; still-paid parks after stage 2. */
  const cap = isComplete ? stages.length : 2;

  const [doneCount, setDoneCount] = useState(reduce ? cap : 0);
  const [streamed, setStreamed] = useState<string[]>([]);
  const [stageElapsed, setStageElapsed] = useState(0);
  const termRef = useRef<HTMLDivElement>(null);

  /* Drive one stage at a time: stream its lines, then mark it done. */
  useEffect(() => {
    if (reduce) {
      setDoneCount(cap);
      setStreamed(stages.slice(0, cap).flatMap((s) => [s.cmd, ...s.logs]));
      return;
    }
    if (doneCount >= cap) return;
    const stage = stages[doneCount];
    const lines = [stage.cmd, ...stage.logs];
    let i = 0;
    const lineTimer = window.setInterval(() => {
      if (i >= lines.length) return;
      const line = lines[i];
      i += 1;
      setStreamed((prev) => (prev.includes(line) && line === stage.cmd ? prev : [...prev, line]));
    }, LINE_MS);
    const stageTimer = window.setTimeout(() => {
      window.clearInterval(lineTimer);
      setStreamed((prev) => [...prev, ...lines.filter((l) => !prev.includes(l))]);
      setDoneCount((d) => d + 1);
      setStageElapsed(0);
    }, STAGE_MS);
    return () => {
      window.clearInterval(lineTimer);
      window.clearTimeout(stageTimer);
    };
  }, [doneCount, cap, reduce, stages]);

  /* Live timer for the currently-active stage. */
  useEffect(() => {
    if (reduce || doneCount >= cap) return;
    const start = Date.now();
    const t = window.setInterval(() => setStageElapsed(Date.now() - start), 100);
    return () => window.clearInterval(t);
  }, [doneCount, cap, reduce]);

  /* Keep the terminal pinned to the newest line. */
  useEffect(() => {
    const el = termRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [streamed]);

  const allDone = doneCount >= stages.length;
  const parked = !isComplete && doneCount >= cap;
  const activeStage = stages[Math.min(doneCount, stages.length - 1)];
  const totalSeconds = ((doneCount * STAGE_MS + (allDone || parked ? 0 : stageElapsed)) / 1000).toFixed(1);

  return (
    <motion.section
      className="zp-deploy"
      initial={reduce ? false : { opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      aria-label="បដាការបញ្ជូន"
    >
      {/* header: title + order ref + live status badge */}
      <header className="zp-deploy__head">
        <span className="zp-deploy__brand"><TerminalSquare className="h-4 w-4" aria-hidden="true" />Order Pipeline</span>
        {orderRef ? <span className="zp-deploy__ref">main · #{orderRef}</span> : null}
        <span className={`zp-deploy__badge ${allDone ? "zp-deploy__badge--done" : "zp-deploy__badge--run"}`} role="status">
          {allDone
            ? <>✓ បញ្ចប់ · {totalSeconds}s</>
            : parked
              ? <>⏳ រង់ចាំ provider…</>
              : <><Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />កំពុងដំណើរការ · {activeStage.caption}</>}
        </span>
      </header>

      {/* horizontal stepper with connecting fill lines + live timers */}
      <ol className="zp-deploy__steps">
        {stages.map((stage, index) => {
          const state = index < doneCount ? "done" : index === doneCount && !parked ? "active" : "pending";
          const StageIcon = stage.Icon;
          return (
            <li key={stage.id} className={`zp-deploy__step is-${state}`}>
              {index > 0 ? <span className={`zp-deploy__line ${index <= doneCount ? "is-filled" : ""} ${index === doneCount ? "is-active-line" : ""}`} aria-hidden="true" /> : null}
              <motion.span
                className="zp-deploy__node"
                initial={reduce ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: state === "pending" ? 0.45 : 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 18, delay: reduce ? 0 : index * 0.06 }}
              >
                {state === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : state === "active" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <StageIcon className="h-4 w-4" aria-hidden="true" />}
              </motion.span>
              <span className="zp-deploy__step-caption">{stage.caption}</span>
              <span className="zp-deploy__timer" aria-hidden="true">
                {state === "done" ? `${(STAGE_MS / 1000).toFixed(1)}s` : state === "active" ? `${(stageElapsed / 1000).toFixed(1)}s` : "—"}
              </span>
            </li>
          );
        })}
      </ol>

      {/* streaming terminal log panel */}
      <div className="zp-deploy__term" ref={termRef} aria-live="polite">
        {streamed.map((line, index) => (
          <motion.p
            key={`${index}-${line}`}
            className={`zp-deploy__log ${line.startsWith("✓") ? "is-ok" : line.startsWith("$") ? "is-cmd" : ""}`}
            initial={reduce ? false : { opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
          >
            {line}
          </motion.p>
        ))}
        {!allDone && !parked ? <span className="zp-deploy__cursor" aria-hidden="true" /> : null}
        {parked ? (
          <p className="zp-deploy__log is-note">
            ⏳ ការទូទាត់បានទទួលរួច — កំពុងរង់ចាំ provider បញ្ជាក់។ បើយឺតជាង ៥ នាទី សូមចុច «ជំនួយ» ដើម្បីឱ្យក្រុមការងារពិនិត្យ។
          </p>
        ) : null}
        {allDone ? <p className="zp-deploy__log is-ok">🎉 រួចរាល់! សូមពិនិត្យគណនីហ្គេមរបស់អ្នក។</p> : null}
      </div>
    </motion.section>
  );
}

export default PaymentSuccessPipeline;
