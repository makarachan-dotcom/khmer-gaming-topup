import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useState } from "react";

/**
 * ZURS login mascot — តុក្កតា​តាមមើល​កូដ.
 *
 * Same little robot as `HeaderMascot`, grown up and given a face that reacts to
 * what is happening in the sign-in form:
 *
 * | state     | behaviour                                                    |
 * | --------- | ------------------------------------------------------------ |
 * | `idle`    | floats, blinks, looks around the card                        |
 * | `peeking` | leans in and looks DOWN at the code boxes, tracking the digit |
 * | `wrong`   | snaps up to look the visitor in the face, worried            |
 * | `banned`  | half-closed eyes and sticks its tongue out, teasing          |
 * | `success` | happy arc eyes and a hop                                     |
 *
 * Everything is transform/opacity only so it composites on the GPU, and the
 * whole thing freezes into a still, readable face under
 * `prefers-reduced-motion`.
 */

export type MascotState = "idle" | "peeking" | "wrong" | "banned" | "success";

type Props = {
  state: MascotState;
  /** Which OTP box is active (0-based) so the eyes can follow the typing. */
  focusIndex?: number;
  /** How many boxes are filled, used for the antenna progress glow. */
  filled?: number;
  total?: number;
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const SPRING = { type: "spring" as const, stiffness: 320, damping: 22, mass: 0.7 };

/**
 * Pupil offset in SVG units. Peeking maps the active digit to a horizontal
 * sweep so the eyes visibly travel along the code as it is typed; `wrong`
 * deliberately returns to dead-centre and slightly up, which is what reads as
 * "it is looking at *you*" rather than at the form.
 */
function pupilTarget(state: MascotState, focusIndex: number, total: number) {
  if (state === "peeking") {
    const spread = total > 1 ? focusIndex / (total - 1) : 0.5;
    return { x: -5 + spread * 10, y: 4.2 };
  }
  if (state === "wrong") return { x: 0, y: -1.6 };
  if (state === "banned") return { x: 0, y: 1 };
  if (state === "success") return { x: 0, y: -0.5 };
  return { x: 0, y: 0 };
}

export function ZursLoginMascot({ state, focusIndex = 0, filled = 0, total = 6 }: Props) {
  const reduce = useReducedMotion() ?? false;
  const [blink, setBlink] = useState(false);
  const pupils = pupilTarget(state, focusIndex, total);
  const eyesOpen = state !== "banned" && state !== "success";
  const uid = useId().replace(/:/g, "");
  const shellId = `zlShell-${uid}`;
  const clipId = `zlMouthClip-${uid}`;

  // Irregular blinking. A fixed CSS interval reads as mechanical; a random gap
  // between 2.4s and 6s is what makes the face feel alive.
  useEffect(() => {
    if (reduce || !eyesOpen) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setBlink(true);
        window.setTimeout(() => setBlink(false), 130);
        schedule();
      }, 2_400 + Math.random() * 3_600);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [reduce, eyesOpen]);

  const bodyAnimate =
    state === "wrong"
      ? { y: -4, rotate: 0, scale: 1.02 }
      : state === "banned"
        ? { y: 0, rotate: -7, scale: 1 }
        : state === "success"
          ? { y: -8, rotate: 0, scale: 1.05 }
          : state === "peeking"
            ? { y: 5, rotate: 0, scale: 1.04 }
            : { y: [0, -5, 0], rotate: 0, scale: 1 };

  const bodyTransition =
    state === "idle"
      ? { duration: 5.2, repeat: Infinity, ease: "easeInOut" as const }
      : SPRING;

  return (
    <div className={`zl-mascot zl-mascot--${state}`} aria-hidden="true">
      {/* Ambient halo. Colour is the only thing that changes per state, so the
          emotional read works even before the face is parsed. */}
      <span className="zl-mascot__halo" />

      {/* Framer owns transform on this wrapper. The SVG used to also run a CSS
          `zl-float` animation — two transforms on one node is what painted the
          stacked ghost robots on mobile /login. */}
      <motion.div
        className="zl-mascot__bob"
        initial={false}
        animate={reduce ? undefined : bodyAnimate}
        transition={reduce ? undefined : bodyTransition}
      >
        <svg viewBox="0 0 120 120" className="zl-mascot__svg">
        <defs>
          <linearGradient id={shellId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#252a3f" />
            <stop offset="100%" stopColor="#171a29" />
          </linearGradient>
          <clipPath id={clipId}>
            <rect x="40" y="70" width="40" height="26" rx="12" />
          </clipPath>
        </defs>

        {/* antenna */}
        <line x1="60" y1="14" x2="60" y2="26" stroke="#5b6480" strokeWidth="3" strokeLinecap="round" />
        <motion.circle
          cx="60"
          cy="11"
          r="5"
          className="zl-mascot__bulb"
          animate={reduce ? undefined : { scale: state === "peeking" ? [1, 1.22, 1] : [1, 1.1, 1] }}
          transition={{ duration: state === "peeking" ? 0.9 : 2.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* head shell */}
        <rect x="20" y="26" width="80" height="70" rx="26" fill={`url(#${shellId})`} className="zl-mascot__shell" />
        {/* face screen */}
        <rect x="29" y="38" width="62" height="46" rx="20" className="zl-mascot__screen" />

        {/* ears */}
        <rect x="14" y="52" width="7" height="18" rx="3.5" className="zl-mascot__ear" />
        <rect x="99" y="52" width="7" height="18" rx="3.5" className="zl-mascot__ear" />

        {/* eyebrows — only drawn when worried, which is most of the expression */}
        <motion.g
          className="zl-mascot__brows"
          initial={false}
          animate={{ opacity: state === "wrong" ? 1 : 0, y: state === "wrong" ? 0 : 3 }}
          transition={{ duration: 0.24, ease: EASE }}
        >
          <path d="M40 48 L52 44" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M80 48 L68 44" strokeWidth="3.4" strokeLinecap="round" />
        </motion.g>

        {/* eyes */}
        {eyesOpen ? (
          <motion.g
            initial={false}
            animate={{ scaleY: blink ? 0.1 : state === "peeking" ? 0.82 : state === "wrong" ? 1.12 : 1 }}
            transition={{ duration: blink ? 0.09 : 0.26, ease: EASE }}
            style={{ transformOrigin: "60px 60px" }}
          >
            <motion.g
              initial={false}
              animate={{ x: pupils.x, y: pupils.y }}
              transition={state === "wrong" ? SPRING : { duration: 0.34, ease: EASE }}
            >
              <circle cx="48" cy="60" r="8" className="zl-mascot__eye" />
              <circle cx="72" cy="60" r="8" className="zl-mascot__eye" />
              <circle cx="50.6" cy="57.4" r="2.6" fill="#ffffff" opacity="0.9" />
              <circle cx="74.6" cy="57.4" r="2.6" fill="#ffffff" opacity="0.9" />
            </motion.g>
          </motion.g>
        ) : state === "success" ? (
          // Happy arcs.
          <g className="zl-mascot__arcs">
            <path d="M40 62 Q48 53 56 62" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M64 62 Q72 53 80 62" strokeWidth="4" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          // Banned: flat, unimpressed dashes.
          <g className="zl-mascot__arcs">
            <path d="M40 60 L56 60" strokeWidth="4" strokeLinecap="round" />
            <path d="M64 60 L80 60" strokeWidth="4" strokeLinecap="round" />
          </g>
        )}

        {/* mouth + tongue */}
        <g clipPath={`url(#${clipId})`}>
          <motion.path
            className="zl-mascot__mouth"
            initial={false}
            animate={{
              d:
                state === "wrong"
                  ? "M52 76 Q60 71 68 76"
                  : state === "success"
                    ? "M50 74 Q60 84 70 74"
                    : state === "banned"
                      ? "M50 75 Q60 79 70 75"
                      : "M52 75 Q60 80 68 75",
            }}
            transition={{ duration: 0.3, ease: EASE }}
            strokeWidth="3.4"
            strokeLinecap="round"
            fill="none"
          />
          {/* លៀនអណ្ដាត — only when banned. Scales out of the mouth and
              wags, which is the whole point: it is teasing the attacker. */}
          <motion.path
            className="zl-mascot__tongue"
            d="M53 76 Q60 76 67 76 Q67 92 60 92 Q53 92 53 76 Z"
            initial={false}
            animate={
              state === "banned"
                ? { scaleY: 1, opacity: 1, rotate: reduce ? 0 : [0, -7, 7, 0] }
                : { scaleY: 0, opacity: 0, rotate: 0 }
            }
            transition={
              state === "banned"
                ? { scaleY: { ...SPRING, delay: 0.12 }, opacity: { duration: 0.18, delay: 0.12 }, rotate: { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 0.4 } }
                : { duration: 0.18, ease: EASE }
            }
            style={{ transformOrigin: "60px 76px" }}
          />
        </g>

        {/* blush */}
        <circle cx="34" cy="72" r="4.4" className="zl-mascot__blush" />
        <circle cx="86" cy="72" r="4.4" className="zl-mascot__blush" />

        {/* code-progress pips under the chin: a quiet second read of how many
            digits are in, so the mascot is informative and not just decorative */}
        <g className="zl-mascot__pips">
          {Array.from({ length: total }).map((_, index) => (
            <motion.circle
              key={index}
              cx={60 - ((total - 1) * 7) / 2 + index * 7}
              cy="104"
              r="2.4"
              initial={false}
              animate={{
                opacity: state === "peeking" ? (index < filled ? 1 : 0.22) : 0,
                scale: index < filled ? 1 : 0.7,
              }}
              transition={{ duration: 0.22, ease: EASE }}
            />
          ))}
        </g>
        </svg>
      </motion.div>
    </div>
  );
}

export default ZursLoginMascot;
