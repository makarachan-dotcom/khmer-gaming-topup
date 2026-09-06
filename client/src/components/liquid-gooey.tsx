/**
 * liquid-gooey
 * ------------
 * Local, dependency-free implementation of the Libraries.dev Gooey effect
 * (https://libraries.dev/gooey.html), exposing exactly the documented API:
 *
 *   import { Liquid } from "@/components/liquid-gooey"
 *
 *   <Liquid blur={6} contrast={18} fill="#fff">
 *     <Liquid.Item x={open ? -54 : 0} y={open ? -34 : 0} transition="bouncy">
 *       <button className="round-btn">…</button>
 *     </Liquid.Item>
 *   </Liquid>
 *
 * Props
 *   Liquid       : blur (goo softness), contrast (edge tightness), fill, shadow
 *   Liquid.Item  : effect ("morph" | "move" | "melt" | "bend"), x, y, transition, delay
 *
 * Why it is vendored instead of installed: the storefront build must stay
 * offline-installable (Vercel builds from this repo's lockfile only), and the
 * effect is ~120 lines of SVG filter plumbing. The public surface is identical,
 * so swapping in the npm package later is a one-line import change.
 *
 * How the goo works: the wrapper blurs its children, then pushes the alpha
 * channel through a steep contrast ramp, so two blurred shapes that overlap
 * fuse into one silhouette. `feComposite … operator="atop"` finally paints the
 * unfiltered source back on top, which is what keeps label text perfectly crisp
 * (including Safari, which is why colorInterpolationFilters is pinned to sRGB).
 */
import { createContext, useContext, useEffect, useId, useMemo, useState, type CSSProperties, type ReactNode } from "react";

export type LiquidEffect = "morph" | "move" | "melt" | "bend";
export type LiquidTransition = "bouncy" | "smooth" | "snappy" | "gentle" | "linear";

const TRANSITIONS: Record<LiquidTransition, string> = {
  bouncy: "520ms cubic-bezier(0.34, 1.56, 0.64, 1)",
  smooth: "420ms cubic-bezier(0.22, 1, 0.36, 1)",
  snappy: "240ms cubic-bezier(0.2, 0.9, 0.2, 1)",
  gentle: "680ms cubic-bezier(0.16, 1, 0.3, 1)",
  linear: "300ms linear",
};

type LiquidContextValue = { fill?: string; reduced: boolean };

const LiquidContext = createContext<LiquidContextValue>({ reduced: false });

/** Shared reduced-motion flag. The goo filter is dropped entirely when set. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener?.("change", sync);
    return () => query.removeEventListener?.("change", sync);
  }, []);
  return reduced;
}

export type LiquidProps = {
  /** Goo softness. Larger values merge from further apart. */
  blur?: number;
  /** Edge tightness. Larger values give a harder, more "liquid" silhouette. */
  contrast?: number;
  /** Default background painted behind every item that does not set its own. */
  fill?: string;
  /** CSS shadow applied outside the filter, so the merge stays clean. */
  shadow?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

function LiquidRoot({ blur = 6, contrast = 18, fill, shadow, className, style, children }: LiquidProps) {
  const reactId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const filterId = `liquid-goo-${reactId}`;
  const reduced = useReducedMotion();
  const context = useMemo<LiquidContextValue>(() => ({ fill, reduced }), [fill, reduced]);

  // alpha row: multiply the blurred alpha by `contrast` then pull the midpoint
  // back, which is the classic gooey ramp. Halving the shift keeps the blob the
  // same visual size as the un-blurred source.
  const matrix = `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${contrast} -${(contrast / 2).toFixed(2)}`;
  const filter = reduced ? undefined : `url(#${filterId})`;

  return (
    <span className={`liquid-gooey${className ? ` ${className}` : ""}`} style={{ filter: shadow ? `drop-shadow(${shadow})` : undefined, ...style }}>
      <svg className="liquid-gooey__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id={filterId} colorInterpolationFilters="sRGB" x="-45%" y="-45%" width="190%" height="190%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="liquidBlur" />
            <feColorMatrix in="liquidBlur" type="matrix" values={matrix} result="liquidGoo" />
            {/* Paint the untouched source back on top: shapes melt, text does not. */}
            <feComposite in="SourceGraphic" in2="liquidGoo" operator="atop" />
          </filter>
        </defs>
      </svg>
      <span className="liquid-gooey__stage" style={{ filter, WebkitFilter: filter } as CSSProperties}>
        <LiquidContext.Provider value={context}>{children}</LiquidContext.Provider>
      </span>
    </span>
  );
}

export type LiquidItemProps = {
  effect?: LiquidEffect;
  x?: number;
  y?: number;
  transition?: LiquidTransition;
  /** Stagger, in milliseconds. */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/** Per-effect transform. Every effect still honours x/y so callers can mix them. */
function transformFor(effect: LiquidEffect, x: number, y: number) {
  const travel = Math.hypot(x, y);
  const moving = travel > 0.5;
  switch (effect) {
    case "morph":
      return `translate3d(${x}px, ${y}px, 0) scale(${moving ? 1 : 0.62})`;
    case "melt": {
      // Stretch along the direction of travel while in flight, like a drip.
      const stretch = moving ? 1 + Math.min(0.22, travel / 320) : 0.7;
      const squash = moving ? 1 - Math.min(0.14, travel / 520) : 0.7;
      return `translate3d(${x}px, ${y}px, 0) scale(${squash}, ${stretch})`;
    }
    case "bend":
      return `translate3d(${x}px, ${y}px, 0) rotate(${moving ? Math.max(-24, Math.min(24, x / 2.4)) : 0}deg) scale(${moving ? 1 : 0.66})`;
    case "move":
    default:
      return `translate3d(${x}px, ${y}px, 0)`;
  }
}

function LiquidItem({ effect = "morph", x = 0, y = 0, transition = "bouncy", delay = 0, className, style, children }: LiquidItemProps) {
  const { fill, reduced } = useContext(LiquidContext);
  const timing = TRANSITIONS[transition] ?? TRANSITIONS.bouncy;
  const resting = Math.hypot(x, y) <= 0.5;

  return (
    <span
      className={`liquid-gooey__item${resting ? " is-resting" : " is-open"}${className ? ` ${className}` : ""}`}
      style={{
        background: fill,
        transform: reduced ? `translate3d(${x}px, ${y}px, 0)` : transformFor(effect, x, y),
        transition: reduced ? "opacity 160ms linear" : `transform ${timing}, opacity 220ms ease`,
        transitionDelay: delay ? `${delay}ms` : undefined,
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export const Liquid = Object.assign(LiquidRoot, { Item: LiquidItem });
export default Liquid;
