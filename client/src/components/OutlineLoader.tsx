import { LoaderCircle } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";

const outlineLoaderUrl = "/manus-storage/zurs-outline-loader_8cf4a479.json";
type AnimationRenderer = ComponentType<{ animation: unknown; size: number; strokeColor: string; loop: boolean; autoplay: boolean; speed: number }>;

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
  const [reducedMotion, setReducedMotion] = useState(false);
  const [Renderer, setRenderer] = useState<AnimationRenderer | null>(null);
  const [animation, setAnimation] = useState<unknown>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    let mounted = true;
    if (!media.matches) void Promise.all([import("react-useanimations"), fetch(outlineLoaderUrl).then((response) => {
      if (!response.ok) throw new Error("Unable to load outline animation");
      return response.json();
    })]).then(([module, data]) => {
      if (!mounted) return;
      setRenderer(() => module.default as AnimationRenderer);
      setAnimation(recolorOutline(data, color));
    }).catch(() => { if (mounted) setAnimation(null); });
    return () => { mounted = false; media.removeEventListener("change", update); };
  }, [color]);

  if (reducedMotion) return <LoaderCircle aria-hidden="true" className={`${className} animate-spin`} style={{ width: size, height: size, color }} />;
  const canRenderAnimation = Boolean(Renderer && animation);
  return <span aria-hidden="true" className={`outline-loader relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }}><LoaderCircle className={`h-full w-full animate-spin ${canRenderAnimation ? "opacity-25" : "opacity-100"}`} style={{ color }} />{canRenderAnimation && Renderer ? <span className="absolute inset-0 grid place-items-center"><Renderer animation={animation} size={size} strokeColor={color} loop autoplay speed={1.1} /></span> : null}</span>;
}
