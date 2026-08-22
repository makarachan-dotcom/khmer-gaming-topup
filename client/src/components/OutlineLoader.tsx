import lottie, { type AnimationItem } from "lottie-web";
import { useEffect, useRef, useState } from "react";

/**
 * Same-origin copy of the owner's Loading V2 JSON. The previous CDN request had
 * no browser CORS permission, so it could succeed in server tooling while the
 * animation stayed invisible in customers' browsers.
 */
const loadingV2AssetUrl = "/loading-v2.json";
let loadingV2Payload: Promise<unknown> | null = null;

type LoadingV2Props = { size?: number; color?: string; className?: string };

function loadLoadingV2Payload() {
  if (!loadingV2Payload) {
    loadingV2Payload = fetch(loadingV2AssetUrl, { cache: "force-cache" }).then((response) => {
      if (!response.ok) throw new Error("Loading V2 animation is unavailable");
      return response.json();
    });
  }
  return loadingV2Payload;
}

function rgbForColor(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return [15 / 255, 23 / 255, 42 / 255] as const;
  const hex = match[1].length === 3 ? match[1].split("").map((part) => `${part}${part}`).join("") : match[1];
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255] as const;
}

function recolorLoadingV2(animation: unknown, color: string) {
  const cloned = JSON.parse(JSON.stringify(animation)) as Record<string, unknown>;
  const rgb = rgbForColor(color);
  const visit = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const value = node as Record<string, unknown>;
    if (value.ty === "fl" && value.c && typeof value.c === "object") {
      const fill = value.c as Record<string, unknown>;
      if (Array.isArray(fill.k)) fill.k = [...rgb, 1];
    }
    Object.values(value).forEach(visit);
  };
  visit(cloned);
  return cloned;
}

/** A non-spinning first-frame mark prevents an invisible gap while Loading V2 initializes. */
function LoadingV2Placeholder() {
  return <span className="loading-v2__placeholder" aria-hidden="true"><i /><i /><i /></span>;
}

export function LoadingV2({ size = 28, color = "#0f172a", className = "" }: LoadingV2Props) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [animationReady, setAnimationReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || navigator.userAgent.toLowerCase().includes("jsdom")) return;
    let disposed = false;
    setAnimationReady(false);
    host.replaceChildren();

    void loadLoadingV2Payload()
      .then((payload) => {
        if (disposed || !hostRef.current) return;
        const animation = lottie.loadAnimation({
          container: hostRef.current,
          renderer: "svg",
          loop: !reduceMotion,
          autoplay: !reduceMotion,
          animationData: recolorLoadingV2(payload, color),
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        });
        animationRef.current = animation;
        if (reduceMotion) animation.goToAndStop(22, true);
        setAnimationReady(true);
      })
      .catch(() => {
        // Keep the transparent Loading V2 first-frame mark visible if the local asset is unavailable.
        setAnimationReady(false);
      });

    return () => {
      disposed = true;
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [color, reduceMotion]);

  return <span aria-hidden="true" className={`loading-v2 inline-grid place-items-center ${animationReady ? "loading-v2--ready" : ""} ${className}`} style={{ width: size, height: size, color }}><LoadingV2Placeholder /><span ref={hostRef} className="loading-v2__animation" /></span>;
}

/** @deprecated Use LoadingV2 for new code. Kept temporarily to migrate existing loading states safely. */
export const OutlineLoader = LoadingV2;
