import { useAuth } from "@/_core/hooks/useAuth";
import { completeAppwriteEmailOtp, getAppwriteAccount, requestAppwriteEmailOtp, updateAppwriteAccountName } from "@/lib/appwriteAuth";
import {
  LoginBlockedError,
  LoginRateLimitedError,
  checkLoginGuard,
  closeVerifyAttempt,
  formatCountdownKh,
  guardCodeRequest,
  openVerifyAttempt,
  type LoginGuardState,
} from "@/lib/loginGuard";
import ZursLoginMascot, { type MascotState } from "@/components/ZursLoginMascot";
import { loginErrorKh, loginMascotState } from "@/lib/loginUi";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Lock, Mail, ShieldAlert, ShieldCheck, User } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent, KeyboardEvent as ReactKeyboardEvent } from "react";

const OTP_LENGTH = 6;
const BLOCK_SECONDS = 24 * 60 * 60;

type Phase = "email" | "otp" | "name" | "verifying" | "success" | "blocked";

function safeReturnPath() {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  return candidate?.startsWith("/") && !candidate.startsWith("//") && !candidate.startsWith("/login") ? candidate : "/account";
}

/*
 * Motion language for this screen.
 *
 * Everything shares one easing curve and one short duration, and only opacity
 * and transform are animated. The previous version also animated `filter:
 * blur()` on each step change, which is what made the transitions feel heavy on
 * mid-range Android — blur cannot be composited on the GPU the way transforms
 * can. Removing it is most of the "smoother" the redesign asked for; the rest
 * is simply moving less far (10px instead of 16px) and settling faster.
 */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const step = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
};

const stepTransition = { duration: 0.42, ease: EASE };

export default function AppwriteLogin() {
  const { user, loading, refresh } = useAuth();
  const returnTo = useMemo(safeReturnPath, []);
  const reduce = useReducedMotion();

  const [phase, setPhase] = useState<Phase>("email");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [name, setName] = useState("");
  const [watching, setWatching] = useState(false);

  // Lockout state. `lockLeft` is a live countdown so the visitor can see the
  // 24 hours actually draining instead of reloading to find out.
  const [lockLeft, setLockLeft] = useState(0);
  const [lockTotal, setLockTotal] = useState(BLOCK_SECONDS);
  const [lockMessage, setLockMessage] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const redirectTimer = useRef<number | null>(null);
  const code = digits.join("");

  const applyLock = useCallback((state: Pick<LoginGuardState, "retryAfter" | "message">) => {
    const seconds = Math.max(1, state.retryAfter || BLOCK_SECONDS);
    setLockLeft(seconds);
    setLockTotal(Math.max(seconds, BLOCK_SECONDS));
    setLockMessage(state.message);
    setAttemptsLeft(0);
    setError(null);
    setBusy(false);
    setPhase("blocked");
  }, []);

  useEffect(() => {
    if (!loading && user) window.location.replace(returnTo);
  }, [loading, returnTo, user]);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty("--zl-keyboard", `${covered}px`);
    };
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);
    sync();
    return () => {
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
      document.documentElement.style.removeProperty("--zl-keyboard");
    };
  }, []);

  // Ask the server about this address/device before rendering the form, so a
  // visitor who is already locked out never gets to type an email at all.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const state = await checkLoginGuard("request");
        if (!cancelled && state.blocked) applyLock(state);
      } catch (reason) {
        if (!cancelled && reason instanceof LoginBlockedError) applyLock(reason.state);
        // Any other failure stays silent: the guard re-runs on every action, and
        // a probe that could not reach the server must not block a real customer.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyLock]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  // Lockout countdown. On reaching zero it re-checks rather than assuming: the
  // server owns the clock, and the block may have been extended meanwhile.
  useEffect(() => {
    if (phase !== "blocked") return;
    if (lockLeft <= 0) {
      void (async () => {
        try {
          const state = await checkLoginGuard("request");
          if (state.blocked) {
            setLockLeft(Math.max(1, state.retryAfter));
            return;
          }
          setPhase("email");
          setLockMessage(null);
          setAttemptsLeft(null);
        } catch (reason) {
          if (reason instanceof LoginBlockedError) setLockLeft(Math.max(1, reason.state.retryAfter));
        }
      })();
      return;
    }
    const timer = window.setTimeout(() => setLockLeft((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [lockLeft, phase]);

  useEffect(() => {
    if (phase === "otp") inputsRef.current[0]?.focus();
  }, [phase]);

  useEffect(
    () => () => {
      if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
    },
    [],
  );

  const goHome = () => {
    redirectTimer.current = window.setTimeout(() => window.location.replace(returnTo), 1400);
  };

  const sendCode = async () => {
    setError(null);
    const normalized = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) {
      setError("សូមបញ្ចូលអ៊ីមែលឲ្យត្រឹមត្រូវ។");
      return;
    }
    setBusy(true);
    try {
      // Server-side gate first. Nothing is sent if this address, this device or
      // this mailbox is locked — which also means a locked actor cannot use the
      // login form to send mail to somebody else.
      const guard = await guardCodeRequest(normalized);
      setAttemptsLeft(guard.remainingAttempts < guard.threshold ? guard.remainingAttempts : null);

      const token = await requestAppwriteEmailOtp(normalized);
      setUserId(token.userId);
      setDigits(Array(OTP_LENGTH).fill(""));
      setPhase("otp");
      setResendIn(45);
    } catch (reason) {
      if (reason instanceof LoginBlockedError) {
        applyLock(reason.state);
        return;
      }
      if (reason instanceof LoginRateLimitedError) {
        setError(`ស្នើកូដញិកញាប់ពេក។ សូមរង់ចាំ ${formatCountdownKh(reason.retryAfter)} រួចព្យាយាមម្ដងទៀត។`);
        return;
      }
      setError(loginErrorKh(reason, "send"));
    } finally {
      setBusy(false);
    }
  };

  /*
   * Verification is pre-charged.
   *
   * Appwrite checks the code in the browser, so our server never sees a wrong
   * one. `openVerifyAttempt` therefore spends the strike up front and returns a
   * claim; `closeVerifyAttempt(..., "success")` refunds it only when the code
   * was right. Closing the tab mid-attempt costs a strike, which is the correct
   * direction to fail in — the alternative is an attacker who simply never
   * reports a failure.
   */
  const verify = async (value: string) => {
    if (!userId || value.length < OTP_LENGTH) {
      setError("សូមបញ្ចូលលេខកូដ ៦ ខ្ទង់ពីអ៊ីមែល។");
      return;
    }
    const normalized = email.trim().toLowerCase();
    setError(null);
    setBusy(true);
    setPhase("verifying");

    let claimId: string | null = null;
    try {
      const opened = await openVerifyAttempt(normalized);
      claimId = opened.claimId;
      setAttemptsLeft(opened.state.remainingAttempts);

      const session = await completeAppwriteEmailOtp({ userId, secret: value });
      await closeVerifyAttempt(claimId, "success", normalized);
      setAttemptsLeft(null);

      await refresh();

      // The name step belongs to first-time registration only.
      //
      // The server is the ONLY authority here: it answers `needsName` from what
      // is actually stored in our own users table, and echoes `savedName` back
      // for everyone who already has one. Requiring BOTH conditions means a
      // returning member can never be re-prompted, so a saved name can never be
      // overwritten on a later sign-in. Only a brand-new registration sees this
      // step. The old Appwrite-profile fallback was removed: members who set
      // their name here have no name on the Appwrite account, so that fallback
      // was exactly what re-asked returning users for their name.
      const needsName = session.needsName === true && !session.savedName?.trim();
      if (needsName) {
        setPhase("name");
      } else {
        if (session.savedName) setName(session.savedName);
        setPhase("success");
        goHome();
      }
    } catch (reason) {
      if (reason instanceof LoginBlockedError) {
        applyLock(reason.state);
        return;
      }
      if (reason instanceof LoginRateLimitedError) {
        setPhase("otp");
        setDigits(Array(OTP_LENGTH).fill(""));
        setError(`ព្យាយាមញាប់ពេក។ សូមរង់ចាំ ${formatCountdownKh(reason.retryAfter)}។`);
        return;
      }

      const settled = await closeVerifyAttempt(claimId, "failure", normalized);
      if (settled?.blocked) {
        applyLock(settled);
        return;
      }
      setPhase("otp");
      if (settled) setAttemptsLeft(settled.remainingAttempts);
      setError(loginErrorKh(reason, "verify"));
      setDigits(Array(OTP_LENGTH).fill(""));
      window.setTimeout(() => inputsRef.current[0]?.focus(), 30);
    } finally {
      setBusy(false);
    }
  };

  const saveName = async () => {
    const normalized = name.trim();
    if (normalized.length < 2) {
      setError("សូមបញ្ចូលឈ្មោះយ៉ាងតិច ២ តួអក្សរ។");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateAppwriteAccountName(normalized);
    } catch (reason) {
      console.error("[Appwrite] updateName failed:", reason);
    } finally {
      setBusy(false);
      setPhase("success");
      goHome();
    }
  };

  const setDigit = (index: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    // Mobile keyboards sometimes deliver the whole code into one box — spread it.
    if (clean.length > 1) {
      const next = Array(OTP_LENGTH).fill("");
      for (let i = 0; i < Math.min(clean.length, OTP_LENGTH); i += 1) next[i] = clean[i];
      setDigits(next);
      inputsRef.current[Math.min(clean.length, OTP_LENGTH) - 1]?.focus();
      return;
    }
    const char = clean.slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const onKeyDown = (index: number, event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowLeft" && index > 0) inputsRef.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) inputsRef.current[index + 1]?.focus();
  };

  const onPaste = (event: ReactClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
    if (!text) return;
    event.preventDefault();
    const next = Array(OTP_LENGTH).fill("");
    for (let i = 0; i < text.length; i += 1) next[i] = text[i];
    setDigits(next);
    inputsRef.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
  };

  // Auto-submit as soon as all six boxes are filled.
  useEffect(() => {
    if (phase === "otp" && code.length === OTP_LENGTH && !busy) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const filledCount = digits.filter(Boolean).length;
  const mascotFocus = Math.min(filledCount, OTP_LENGTH - 1);
  const lockProgress = lockTotal > 0 ? Math.min(100, Math.max(0, ((lockTotal - lockLeft) / lockTotal) * 100)) : 0;

  /*
   * What the mascot is doing, derived from the same state the form already
   * tracks so it can never disagree with the screen.
   *
   *   peeking — leans over and looks down at the boxes while a code is typed
   *   wrong   — straightens up and looks at you after a bad code
   *   banned  — sticks its tongue out for the duration of the lockout
   *
   * `error` is checked before typing so a wrong code wins over the digits
   * still sitting in the boxes.
   */
  const mascotState: MascotState = loginMascotState({
    phase,
    error,
    busy,
    watching,
    hasInput: phase === "name" ? name.trim().length > 0 : email.trim().length > 0,
  });

  const backAction = () => {
    if (phase === "otp") {
      setPhase("email");
      setError(null);
      return;
    }
    if (phase === "name") {
      setPhase("otp");
      return;
    }
    window.history.back();
  };

  return (
    <main className="zl-shell">
      {/* Ambient background: hairline grid, one slow aurora, one floor glow. */}
      <div className="zl-bg" aria-hidden="true">
        <div className="zl-bg__grid" />
        <div className="zl-bg__aurora" />
        <div className="zl-bg__floor" />
      </div>

      <motion.section
        className={`zl-card ${error ? "is-error" : ""} ${phase === "success" ? "is-success" : ""} ${phase === "blocked" ? "is-locked" : ""}`}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="zl-topbar">
          {phase !== "success" && phase !== "verifying" && phase !== "blocked" ? (
            <button type="button" onClick={backAction} className="zl-back">
              <ArrowLeft className="h-4 w-4" /> ត្រឡប់ក្រោយ
            </button>
          ) : (
            <span />
          )}
          <span className="zl-brand">
            ZURS<span>.me</span>
          </span>
        </div>

        <div className="zl-hero">
          <ZursLoginMascot state={mascotState} focusIndex={mascotFocus} filled={filledCount} total={OTP_LENGTH} />
          {phase !== "blocked" ? (
            <div className="zl-steps" aria-hidden="true">
              {(["email", "otp", "name"] as const).map((item, index) => {
                const order: Phase[] = ["email", "otp", "verifying", "name", "success"];
                const active = order.indexOf(phase) >= order.indexOf(item);
                return <span key={item} className={`zl-steps__dot ${active ? "is-active" : ""}`} style={{ ["--d" as string]: `${index * 70}ms` }} />;
              })}
            </div>
          ) : null}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {phase === "blocked" ? (
            <motion.div key="blocked" className="zl-lock" {...(reduce ? {} : step)} transition={stepTransition}>
              <div className="zl-lock__badge">
                <ShieldAlert className="h-6 w-6" strokeWidth={2} />
              </div>
              <h1 className="zl-title">បិទបណ្តោះអាសន្ន</h1>
              <p className="zl-lock__meta">{lockMessage ?? "មានការព្យាយាមចូលខុសច្រើនពេក។ សូមព្យាយាមម្ដងទៀតក្រោយ។"}</p>
              <p className="zl-lock__time" aria-live="polite">
                {formatCountdownKh(lockLeft)}
              </p>
              <div className="zl-lock__bar" aria-hidden="true">
                <span style={{ width: `${lockProgress}%` }} />
              </div>
              <p className="zl-lock__note">
                ការផ្លាស់ប្ដូរឧបករណ៍ ចេញចូលគណនីថ្មី ឬប្ដូរអ៊ីនធឺណិត មិនផ្លាស់ប្ដូររយៈពេលនេះទេ។ បើអ្នកគិតថានេះជាកំហុស សូមទាក់ទង Support ព្រមទាំងម៉ោងពេល។
              </p>
            </motion.div>
          ) : phase === "email" ? (
            <motion.div key="email" {...(reduce ? {} : step)} transition={stepTransition}>
              <h1 className="zl-title">
                ចូលគណនី <span className="zl-title__accent">ZURS</span>
              </h1>
              <p className="zl-subtitle">បញ្ចូលអ៊ីមែលរបស់អ្នក — យើងផ្ញើលេខកូដ ៦ ខ្ទង់ ដែលបញ្ជាក់ដោយស្វ័យប្រវត្តិ។</p>
              <p className="zl-trust">KHQR ផ្លូវការ · គណនីមានសុវត្ថិភាព</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void sendCode();
                }}
                className="zl-form"
              >
                <label className="zl-field">
                  <span className="zl-field__label">អ៊ីមែល</span>
                  <span className="zl-field__control">
                    <Mail className="zl-field__icon" />
                    <input
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (error) setError(null);
                      }}
                      onFocus={(event) => {
                        setWatching(true);
                        event.currentTarget.scrollIntoView({ block: "center", behavior: "smooth" });
                      }}
                      onBlur={() => setWatching(false)}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      enterKeyHint="next"
                      placeholder="you@example.com"
                    />
                  </span>
                </label>
                <button type="submit" disabled={busy} className="zl-btn">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {busy ? "កំពុងផ្ញើលេខកូដ…" : "ផ្ញើលេខកូដ"}
                </button>
              </form>
            </motion.div>
          ) : phase === "otp" || phase === "verifying" ? (
            <motion.div key="otp" {...(reduce ? {} : step)} transition={stepTransition}>
              <h1 className="zl-title">បញ្ចូលលេខកូដ</h1>
              <p className="zl-subtitle">
                ផ្ញើទៅ <strong>{email}</strong> រួចហើយ។ ពិនិត្យ Spam/Junk ផងដែរ។
              </p>
              <motion.div className="zl-otp" animate={error && !reduce ? { x: [0, -6, 6, -4, 0] } : { x: 0 }} transition={{ duration: 0.36, ease: EASE }}>
                {digits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      inputsRef.current[index] = element;
                    }}
                    value={digit}
                    disabled={phase === "verifying"}
                    onChange={(event) => {
                      setDigit(index, event.target.value);
                      if (error) setError(null);
                    }}
                    onKeyDown={(event) => onKeyDown(index, event)}
                    onPaste={onPaste}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={OTP_LENGTH}
                    className={`zl-otp__box ${digit ? "is-filled" : ""} ${index === filledCount && phase === "otp" ? "is-next" : ""}`}
                    aria-label={`ខ្ទង់ទី ${index + 1}`}
                    style={{ ["--d" as string]: `${index * 40}ms` }}
                  />
                ))}
              </motion.div>
              <div className="zl-progress" aria-hidden="true">
                <span style={{ width: `${(filledCount / OTP_LENGTH) * 100}%` }} />
              </div>
              <button type="button" onClick={() => void verify(code)} disabled={busy || code.length < OTP_LENGTH} className={`zl-btn ${phase === "verifying" ? "is-busy" : ""}`}>
                {phase === "verifying" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                {phase === "verifying" ? "កំពុងបញ្ជាក់…" : "បញ្ជាក់ និងចូល"}
              </button>
              <div className="zl-foot">
                <button type="button" disabled={resendIn > 0 || busy} onClick={() => void sendCode()} className="zl-link">
                  {resendIn > 0 ? (
                    <>
                      ផ្ញើឡើងវិញក្នុង <span className="zl-link__count">{resendIn}s</span>
                    </>
                  ) : (
                    "ផ្ញើលេខកូដឡើងវិញ"
                  )}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setPhase("email");
                    setUserId(null);
                    setError(null);
                  }}
                  className="zl-link"
                >
                  ប្រើអ៊ីមែលផ្សេង
                </button>
              </div>
              {attemptsLeft !== null && attemptsLeft > 0 ? (
                <p className="zl-attempts" aria-live="polite">
                  នៅសល់ <strong>{attemptsLeft}</strong> ដងទៀត មុនពេលគណនីត្រូវបិទ ២៤ ម៉ោង
                </p>
              ) : null}
            </motion.div>
          ) : phase === "name" ? (
            <motion.div key="name" {...(reduce ? {} : step)} transition={stepTransition}>
              <h1 className="zl-title">ឈ្មោះរបស់អ្នក</h1>
              <p className="zl-subtitle">បំពេញឈ្មោះតែម្ដងគត់ — លើកក្រោយចូលដោយស្វ័យប្រវត្តិ។</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveName();
                }}
                className="zl-form"
              >
                <label className="zl-field">
                  <span className="zl-field__label">ឈ្មោះ</span>
                  <span className="zl-field__control">
                    <User className="zl-field__icon" />
                    <input
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value.slice(0, 40));
                        if (error) setError(null);
                      }}
                      autoFocus
                      onFocus={() => setWatching(true)}
                      onBlur={() => setWatching(false)}
                      minLength={2}
                      maxLength={40}
                      autoComplete="name"
                      placeholder="ឈ្មោះក្នុងហ្គេម ឬឈ្មោះពិត"
                    />
                  </span>
                </label>
                <button type="submit" disabled={busy || name.trim().length < 2} className="zl-btn">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {busy ? "កំពុងរក្សាទុក…" : "រក្សាទុក និងចូល"}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div key="success" className="zl-success" {...(reduce ? {} : step)} transition={stepTransition}>
              <div className="zl-success__ring">
                <svg viewBox="0 0 52 52" className="zl-success__check" aria-hidden="true">
                  <circle cx="26" cy="26" r="24" />
                  <path d="M15 27l7 7 15-16" />
                </svg>
              </div>
              <h1 className="zl-title">ចូលរួចរាល់</h1>
              <p className="zl-subtitle">កំពុងនាំអ្នកចូល…</p>
              <button type="button" disabled className="zl-btn is-success">
                <Check className="h-4 w-4" /> Verified
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {error ? (
            <motion.p
              role="alert"
              className="zl-error"
              initial={reduce ? false : { opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: "auto", marginTop: 16 }}
              exit={reduce ? undefined : { opacity: 0, height: 0, marginTop: 0 }}
              transition={stepTransition}
            >
              {error}
            </motion.p>
          ) : null}
        </AnimatePresence>
      </motion.section>
    </main>
  );
}
