/**
 * thinking-orbs
 * -------------
 * Local, dependency-free implementation of the Libraries.dev Orb effect
 * (https://libraries.dev/orbs.html), exposing exactly the documented API:
 *
 *   import { ThinkingOrb } from "@/components/thinking-orbs"
 *   <ThinkingOrb state="searching" size={64} />
 *
 * Props
 *   state : "working" | "searching" | "solving" | "listening" | "connecting"
 *         | "weaving" | "composing" | "breathing" | "shaping"
 *   size  : 64 (chat-avatar scale) or 20 (inline-text scale) — separately tuned
 *   speed : multiplies the animation clock, default 1
 *   dark  : boolean, picks the light or dark tuning
 *   paused: boolean, freezes the animation
 *
 * Where the storefront uses each state (support chat):
 *   connecting → waiting for an admin to join the chat
 *   listening  → admin has joined, customer is waiting for the reply
 *   composing  → admin is typing a long answer (over ~6 seconds)
 *   weaving    → an attachment is uploading
 *   breathing  → idle/resting avatar
 *
 * Zero runtime dependencies: one stylesheet is injected once per document and
 * every state is plain CSS, so it keeps animating during React re-renders and
 * costs nothing on the main thread beyond compositing.
 */
import { useEffect, type CSSProperties } from "react";

export type ThinkingOrbState =
  | "working"
  | "searching"
  | "solving"
  | "listening"
  | "connecting"
  | "weaving"
  | "composing"
  | "breathing"
  | "shaping";

export type ThinkingOrbProps = {
  state?: ThinkingOrbState;
  size?: number;
  speed?: number;
  dark?: boolean;
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Accessible description. Pass null for a purely decorative orb. */
  label?: string | null;
};

const STYLE_ID = "thinking-orbs-styles";

const STYLES = `
.torb{position:relative;display:inline-block;flex:none;width:var(--orb-size);height:var(--orb-size);
  --orb-a:#38bdf8;--orb-b:#6366f1;--orb-c:#22d3ee;--orb-ink:#0f172a;--orb-veil:rgba(15,23,42,.10)}
.torb[data-dark="true"]{--orb-a:#7dd3fc;--orb-b:#a78bfa;--orb-c:#67e8f9;--orb-ink:#e2e8f0;--orb-veil:rgba(226,232,240,.16)}
.torb *{box-sizing:border-box}
.torb__layer{position:absolute;inset:0;border-radius:50%}
.torb[data-paused="true"] *{animation-play-state:paused!important}
@media (prefers-reduced-motion: reduce){.torb *{animation-duration:0s!important;animation-iteration-count:1!important}}

/* shared pieces */
.torb__core{position:absolute;left:50%;top:50%;width:38%;height:38%;margin:-19% 0 0 -19%;border-radius:50%;
  background:radial-gradient(circle at 34% 30%,#fff 0 8%,var(--orb-a) 42%,var(--orb-b) 100%);
  box-shadow:0 0 calc(var(--orb-size)*.18) color-mix(in srgb,var(--orb-a) 55%,transparent)}
.torb__halo{position:absolute;inset:6%;border-radius:50%;background:radial-gradient(circle,color-mix(in srgb,var(--orb-a) 26%,transparent) 0,transparent 70%)}
.torb__dot{position:absolute;left:50%;top:50%;width:16%;height:16%;margin:-8% 0 0 -8%;border-radius:50%;
  background:linear-gradient(140deg,var(--orb-a),var(--orb-b))}
.torb__ring{position:absolute;inset:2%;border-radius:50%;border:calc(var(--orb-size)*.055) solid transparent}

/* working — three satellites on a steady orbit */
.torb--working .torb__orbit{position:absolute;inset:0;animation:torb-spin calc(2.4s / var(--orb-speed)) linear infinite}
.torb--working .torb__orbit:nth-child(3){animation-duration:calc(3.4s / var(--orb-speed));animation-direction:reverse}
.torb--working .torb__orbit:nth-child(4){animation-duration:calc(4.2s / var(--orb-speed))}
.torb--working .torb__dot{top:6%;transform:translateY(0)}
.torb--working .torb__orbit:nth-child(3) .torb__dot{opacity:.75;width:13%;height:13%;margin:-6.5% 0 0 -6.5%}
.torb--working .torb__orbit:nth-child(4) .torb__dot{opacity:.5;width:10%;height:10%;margin:-5% 0 0 -5%}

/* searching — radar sweep with a travelling probe */
.torb--searching .torb__ring{border-color:var(--orb-veil);animation:torb-breathe calc(3s / var(--orb-speed)) ease-in-out infinite}
.torb--searching .torb__sweep{position:absolute;inset:2%;border-radius:50%;
  background:conic-gradient(from 0deg,transparent 0 62%,color-mix(in srgb,var(--orb-c) 70%,transparent) 86%,transparent 100%);
  -webkit-mask:radial-gradient(circle,transparent 40%,#000 41%);mask:radial-gradient(circle,transparent 40%,#000 41%);
  animation:torb-spin calc(1.5s / var(--orb-speed)) linear infinite}
.torb--searching .torb__probe{position:absolute;inset:0;animation:torb-spin calc(1.5s / var(--orb-speed)) linear infinite}
.torb--searching .torb__probe .torb__dot{top:8%;width:13%;height:13%;margin:-6.5% 0 0 -6.5%;box-shadow:0 0 calc(var(--orb-size)*.12) var(--orb-c)}

/* solving — two counter-rotating arcs closing on a pulsing core */
.torb--solving .torb__arc{position:absolute;inset:4%;border-radius:50%;border:calc(var(--orb-size)*.06) solid transparent;
  border-top-color:var(--orb-a);border-right-color:color-mix(in srgb,var(--orb-a) 40%,transparent);
  animation:torb-spin calc(1.1s / var(--orb-speed)) cubic-bezier(.6,.05,.3,.95) infinite}
.torb--solving .torb__arc:nth-child(2){inset:20%;border-top-color:var(--orb-b);border-right-color:transparent;border-left-color:color-mix(in srgb,var(--orb-b) 45%,transparent);animation-direction:reverse;animation-duration:calc(1.7s / var(--orb-speed))}
.torb--solving .torb__core{width:26%;height:26%;margin:-13% 0 0 -13%;animation:torb-pulse calc(1.1s / var(--orb-speed)) ease-in-out infinite}

/* listening — sonar ripples, calm and patient */
.torb--listening .torb__wave{position:absolute;inset:0;border-radius:50%;border:calc(var(--orb-size)*.045) solid color-mix(in srgb,var(--orb-a) 70%,transparent);
  opacity:0;animation:torb-ripple calc(2.6s / var(--orb-speed)) cubic-bezier(.22,1,.36,1) infinite}
.torb--listening .torb__wave:nth-child(2){animation-delay:calc(.65s / var(--orb-speed))}
.torb--listening .torb__wave:nth-child(3){animation-delay:calc(1.3s / var(--orb-speed))}
.torb--listening .torb__core{width:30%;height:30%;margin:-15% 0 0 -15%;animation:torb-breathe calc(2.6s / var(--orb-speed)) ease-in-out infinite}

/* connecting — two orbs reaching for each other and fusing */
.torb--connecting .torb__pair{position:absolute;inset:0;filter:blur(calc(var(--orb-size)*.028)) contrast(14)}
.torb--connecting .torb__blob{position:absolute;top:50%;width:34%;height:34%;margin-top:-17%;border-radius:50%;background:var(--orb-a)}
.torb--connecting .torb__blob:nth-child(1){left:2%;animation:torb-merge-left calc(1.9s / var(--orb-speed)) cubic-bezier(.45,0,.25,1) infinite}
.torb--connecting .torb__blob:nth-child(2){right:2%;background:var(--orb-b);animation:torb-merge-right calc(1.9s / var(--orb-speed)) cubic-bezier(.45,0,.25,1) infinite}
.torb--connecting .torb__spark{position:absolute;left:50%;top:50%;width:12%;height:12%;margin:-6% 0 0 -6%;border-radius:50%;background:#fff;opacity:0;
  animation:torb-spark calc(1.9s / var(--orb-speed)) ease-out infinite}

/* weaving — threads on a lissajous path */
.torb--weaving .torb__thread{position:absolute;inset:8%;border-radius:46% 54% 52% 48%/48% 46% 54% 52%;
  border:calc(var(--orb-size)*.05) solid color-mix(in srgb,var(--orb-a) 75%,transparent);
  animation:torb-weave calc(2.2s / var(--orb-speed)) linear infinite}
.torb--weaving .torb__thread:nth-child(2){inset:14%;border-color:color-mix(in srgb,var(--orb-b) 75%,transparent);animation-direction:reverse;animation-duration:calc(2.9s / var(--orb-speed))}
.torb--weaving .torb__thread:nth-child(3){inset:22%;border-color:color-mix(in srgb,var(--orb-c) 65%,transparent);animation-duration:calc(3.6s / var(--orb-speed))}

/* composing — a writing wave (used while the admin types a long reply) */
.torb--composing .torb__bars{position:absolute;left:14%;right:14%;top:50%;height:52%;transform:translateY(-50%);display:flex;align-items:center;justify-content:space-between}
.torb--composing .torb__bar{width:16%;height:34%;border-radius:999px;background:linear-gradient(180deg,var(--orb-a),var(--orb-b));
  animation:torb-write calc(1.05s / var(--orb-speed)) ease-in-out infinite}
.torb--composing .torb__bar:nth-child(2){animation-delay:calc(.13s / var(--orb-speed))}
.torb--composing .torb__bar:nth-child(3){animation-delay:calc(.26s / var(--orb-speed))}
.torb--composing .torb__bar:nth-child(4){animation-delay:calc(.39s / var(--orb-speed))}
.torb--composing .torb__halo{animation:torb-breathe calc(2.4s / var(--orb-speed)) ease-in-out infinite}

/* breathing — resting avatar */
.torb--breathing .torb__core{width:46%;height:46%;margin:-23% 0 0 -23%;animation:torb-breathe calc(3.4s / var(--orb-speed)) ease-in-out infinite}
.torb--breathing .torb__halo{animation:torb-breathe calc(3.4s / var(--orb-speed)) ease-in-out infinite reverse}

/* shaping — a blob settling into a new form */
.torb--shaping .torb__blobby{position:absolute;inset:8%;background:linear-gradient(140deg,var(--orb-a),var(--orb-b));
  animation:torb-shape calc(4s / var(--orb-speed)) ease-in-out infinite}
.torb--shaping .torb__blobby:nth-child(2){inset:22%;opacity:.55;background:linear-gradient(140deg,var(--orb-c),var(--orb-a));animation-direction:reverse;animation-duration:calc(3.1s / var(--orb-speed))}

/* inline (size 20) tuning: fewer, chunkier moving parts so it stays legible */
.torb[data-scale="inline"] .torb__ring,.torb[data-scale="inline"] .torb__arc{border-width:calc(var(--orb-size)*.1)}
.torb[data-scale="inline"] .torb__wave{border-width:calc(var(--orb-size)*.09)}
.torb[data-scale="inline"] .torb__thread{border-width:calc(var(--orb-size)*.1)}
.torb[data-scale="inline"] .torb__thread:nth-child(3),.torb[data-scale="inline"] .torb--working .torb__orbit:nth-child(4){display:none}
.torb[data-scale="inline"] .torb__dot{width:22%;height:22%;margin:-11% 0 0 -11%}
.torb[data-scale="inline"] .torb__core{box-shadow:none}
.torb[data-scale="inline"].torb--connecting .torb__pair{filter:blur(calc(var(--orb-size)*.05)) contrast(12)}

@keyframes torb-spin{to{transform:rotate(360deg)}}
@keyframes torb-pulse{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.22);opacity:1}}
@keyframes torb-breathe{0%,100%{transform:scale(.9);opacity:.75}50%{transform:scale(1.06);opacity:1}}
@keyframes torb-ripple{0%{transform:scale(.34);opacity:0}18%{opacity:.9}100%{transform:scale(1);opacity:0}}
@keyframes torb-merge-left{0%,100%{transform:translateX(0) scale(1)}50%{transform:translateX(46%) scale(1.08)}}
@keyframes torb-merge-right{0%,100%{transform:translateX(0) scale(1)}50%{transform:translateX(-46%) scale(1.08)}}
@keyframes torb-spark{0%,42%{opacity:0;transform:scale(.4)}52%{opacity:.95;transform:scale(1.5)}70%,100%{opacity:0;transform:scale(.4)}}
@keyframes torb-weave{0%{transform:rotate(0deg) scale(1)}50%{transform:rotate(180deg) scale(.9)}100%{transform:rotate(360deg) scale(1)}}
@keyframes torb-write{0%,100%{height:26%;opacity:.6}50%{height:96%;opacity:1}}
@keyframes torb-shape{0%,100%{border-radius:46% 54% 52% 48%/48% 46% 54% 52%;transform:rotate(0deg)}
  33%{border-radius:62% 38% 34% 66%/58% 62% 38% 42%;transform:rotate(120deg)}
  66%{border-radius:34% 66% 62% 38%/42% 38% 62% 58%;transform:rotate(240deg)}}
`;

function ensureStyles() {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const element = document.createElement("style");
  element.id = STYLE_ID;
  element.textContent = STYLES;
  document.head.appendChild(element);
}

function layers(state: ThinkingOrbState) {
  switch (state) {
    case "working":
      return (
        <>
          <span className="torb__halo" />
          <span className="torb__orbit"><span className="torb__dot" /></span>
          <span className="torb__orbit"><span className="torb__dot" /></span>
          <span className="torb__orbit"><span className="torb__dot" /></span>
          <span className="torb__core" />
        </>
      );
    case "searching":
      return (
        <>
          <span className="torb__ring" />
          <span className="torb__sweep" />
          <span className="torb__probe"><span className="torb__dot" /></span>
          <span className="torb__core" />
        </>
      );
    case "solving":
      return (
        <>
          <span className="torb__arc" />
          <span className="torb__arc" />
          <span className="torb__core" />
        </>
      );
    case "listening":
      return (
        <>
          <span className="torb__wave" />
          <span className="torb__wave" />
          <span className="torb__wave" />
          <span className="torb__core" />
        </>
      );
    case "connecting":
      return (
        <>
          <span className="torb__halo" />
          <span className="torb__pair">
            <span className="torb__blob" />
            <span className="torb__blob" />
          </span>
          <span className="torb__spark" />
        </>
      );
    case "weaving":
      return (
        <>
          <span className="torb__thread" />
          <span className="torb__thread" />
          <span className="torb__thread" />
          <span className="torb__core" />
        </>
      );
    case "composing":
      return (
        <>
          <span className="torb__halo" />
          <span className="torb__bars">
            <span className="torb__bar" />
            <span className="torb__bar" />
            <span className="torb__bar" />
            <span className="torb__bar" />
          </span>
        </>
      );
    case "shaping":
      return (
        <>
          <span className="torb__blobby" />
          <span className="torb__blobby" />
        </>
      );
    case "breathing":
    default:
      return (
        <>
          <span className="torb__halo" />
          <span className="torb__core" />
        </>
      );
  }
}

export function ThinkingOrb({ state = "working", size = 64, speed = 1, dark = false, paused = false, className, style, label }: ThinkingOrbProps) {
  useEffect(ensureStyles, []);
  // The stylesheet is also injected synchronously on first render so the orb is
  // never shown unstyled for a frame.
  ensureStyles();

  const clamped = Math.max(0.05, Math.min(6, speed || 1));
  return (
    <span
      className={`torb torb--${state}${className ? ` ${className}` : ""}`}
      data-state={state}
      data-dark={dark ? "true" : "false"}
      data-paused={paused ? "true" : "false"}
      data-scale={size <= 28 ? "inline" : "avatar"}
      style={{ ["--orb-size" as string]: `${size}px`, ["--orb-speed" as string]: clamped, ...style } as CSSProperties}
      role={label ? "img" : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
    >
      {layers(state)}
    </span>
  );
}

export default ThinkingOrb;
