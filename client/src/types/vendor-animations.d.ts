/**
 * Ambient types for the two Libraries.dev animation packages.
 *
 * Both ship as ESM with (at the time of writing) no bundled .d.ts, so these
 * declarations keep `pnpm check` green. If a future release of either package
 * ships its own types, DELETE the matching block below — an ambient
 * `declare module` shadows the package's real types and would hide drift.
 *
 * Sources: https://libraries.dev/gooey.html and https://libraries.dev/orbs.html
 */

declare module "thinking-orbs" {
  import type * as React from "react";

  /**
   * The npm README documents six states; the GitHub docs list nine. Only the
   * first four are present in every published build, so application code
   * should stick to those (see SupportOrb.tsx).
   */
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
    /** 64 = chat-avatar scale, 20 = inline-text scale. Each is tuned separately. */
    size?: number;
    /** Multiplies the animation clock. Defaults to 1. */
    speed?: number;
    dark?: boolean;
    paused?: boolean;
    className?: string;
  };

  export const ThinkingOrb: (props: ThinkingOrbProps) => React.ReactElement | null;
}

declare module "liquid-gooey" {
  import type * as React from "react";

  export type LiquidItemEffect = "morph" | "move" | "melt" | "bend";

  export type LiquidProps = {
    /** Goo softness. */
    blur?: number;
    /** Edge tightness. */
    contrast?: number;
    fill?: string;
    shadow?: string | boolean;
    className?: string;
    children?: React.ReactNode;
  };

  export type LiquidItemProps = {
    effect?: LiquidItemEffect;
    x?: number;
    y?: number;
    transition?: string;
    delay?: number;
    className?: string;
    children?: React.ReactNode;
  };

  export const Liquid: ((props: LiquidProps) => React.ReactElement | null) & {
    Item: (props: LiquidItemProps) => React.ReactElement | null;
  };
}
