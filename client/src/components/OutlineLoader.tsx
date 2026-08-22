import type { AnimationItem } from "lottie-web";
import { useEffect, useRef, useState } from "react";

const loadingV2AssetUrl = "/manus-storage/loading-v2-outline_78a8cd0e.json";

function rgbForColor(value: string) {
  const normalized = value.trim();
  const match = normalized.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return [79 / 255, 70 / 255, 229 / 255] as const;
  const hex = match[1].length === 3 ? match[1].split("").map((part) => `${part}${part}`).join("") : match[1];
  return [parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255] as const;
}

function recolorOutlineAsset(animation: unknown, color: string) {
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

export function OutlineLoader({ size = 28, color = "#4f46e5", className = "" }: { size?: number; color?: string; className?: string }) {
  const hostRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

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
    const controller = new AbortController();
    let disposed = false;
    host.replaceChildren();
    void Promise.all([
      fetch(loadingV2AssetUrl, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Loading animation is unavailable");
        return response.json();
      }),
      import("lottie-web"),
    ])
      .then(([payload, module]) => {
        if (disposed || !hostRef.current) return;
        const lottie = module.default;
        const animation = lottie.loadAnimation({ container: hostRef.current, renderer: "svg", loop: !reduceMotion, autoplay: !reduceMotion, animationData: recolorOutlineAsset(payload, color), rendererSettings: { preserveAspectRatio: "xMidYMid meet" } });
        animationRef.current = animation;
        if (reduceMotion) animation.goToAndStop(22, true);
      })
      .catch(() => { /* The static outline remains visible if the animation asset cannot load. */ });
    return () => {
      disposed = true;
      controller.abort();
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [color, reduceMotion]);

  return <span aria-hidden="true" className={`outline-loader outline-loader--loading-v2 inline-grid place-items-center ${className}`} style={{ width: size, height: size, color }}>
    <svg className="outline-loader-fallback" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" focusable="false"><circle cx="12" cy="12" r="8.4" strokeOpacity="0.28" /><path d="M12 3.6A8.4 8.4 0 0 1 20.4 12" strokeLinecap="round" /></svg>
    <span ref={hostRef} className="outline-loader-lottie" />
  </span>;
}
