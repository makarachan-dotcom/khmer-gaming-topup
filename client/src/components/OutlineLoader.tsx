import { LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const outlineLoaderUrl = "https://khmergame-girzfgts.manus.space/manus-storage/zurs-outline-loader_3529c2fb.json";
type LottieInstance = { destroy: () => void };
type LottieRenderer = { loadAnimation: (config: { container: HTMLElement; renderer: "svg"; loop: boolean; autoplay: boolean; animationData: unknown }) => LottieInstance };

function toRgba(color: string): [number, number, number, number] | null {
  const value = color.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [Number.parseInt(value.slice(0, 2), 16) / 255, Number.parseInt(value.slice(2, 4), 16) / 255, Number.parseInt(value.slice(4, 6), 16) / 255, 1];
}

function recolorOutline(animation: unknown, color: string) {
  const rgba = toRgba(color);
  if (!rgba || !animation || typeof animation !== "object") return animation;
  const next = structuredClone(animation) as { layers?: Array<{ shapes?: Array<{ it?: Array<{ ty?: string; c?: { a?: number; k?: number[] } }> }> }> };
  next.layers?.forEach((layer) => layer.shapes?.forEach((shape) => shape.it?.forEach((item) => {
    if (item.ty === "st" && item.c?.a === 0) item.c.k = rgba;
  })));
  return next;
}

export function OutlineLoader({ size = 28, color = "#4f46e5", className = "" }: { size?: number; color?: string; className?: string }) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || reducedMotion) return;
    let active = true;
    let instance: LottieInstance | undefined;
    setVisible(false);
    void Promise.all([import("lottie-web"), fetch(outlineLoaderUrl).then((response) => {
      if (!response.ok) throw new Error("Unable to load outline animation");
      return response.json();
    })]).then(([module, animation]) => {
      if (!active) return;
      const renderer = ((module as unknown as { default?: LottieRenderer }).default ?? module) as unknown as LottieRenderer;
      instance = renderer.loadAnimation({ container, renderer: "svg", loop: true, autoplay: true, animationData: recolorOutline(animation, color) });
      setVisible(true);
    }).catch(() => { if (active) setVisible(false); });
    return () => { active = false; instance?.destroy(); };
  }, [color, reducedMotion]);

  if (reducedMotion) return <LoaderCircle aria-hidden="true" className={`${className} animate-spin`} style={{ width: size, height: size, color }} />;
  return <span aria-hidden="true" className={`outline-loader relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}><LoaderCircle className={`absolute inset-0 h-full w-full animate-spin transition-opacity ${visible ? "opacity-20" : "opacity-100"}`} style={{ color }} /><span ref={containerRef} className={`relative z-10 block h-full w-full transition-opacity ${visible ? "opacity-100" : "opacity-0"}`} /></span>;
}
