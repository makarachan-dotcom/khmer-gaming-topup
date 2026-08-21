import activity from "react-useanimations/lib/activity";
import arrowRightCircle from "react-useanimations/lib/arrowRightCircle";
import checkmark from "react-useanimations/lib/checkmark";
import home from "react-useanimations/lib/home";
import notification from "react-useanimations/lib/notification";
import { Activity, BellRing, CheckCircle2, CircleArrowRight, House } from "lucide-react";
import { type ComponentType, useEffect, useState } from "react";

export type AnimatedGlyphName = "activity" | "home" | "next" | "notify" | "success";

const glyphs = {
  activity: { animation: activity, Fallback: Activity, loop: true },
  home: { animation: home, Fallback: House, loop: false },
  next: { animation: arrowRightCircle, Fallback: CircleArrowRight, loop: false },
  notify: { animation: notification, Fallback: BellRing, loop: true },
  success: { animation: checkmark, Fallback: CheckCircle2, loop: false },
} as const;

export function AnimatedGlyph({ name, size = 28, color = "#4f46e5", className = "" }: { name: AnimatedGlyphName; size?: number; color?: string; className?: string }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [Renderer, setRenderer] = useState<ComponentType<{ animation: unknown; size: number; strokeColor: string; loop: boolean; autoplay: boolean; speed: number }> | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    let mounted = true;
    if (!media.matches) void import("react-useanimations").then((module) => { if (mounted) setRenderer(() => module.default as ComponentType<{ animation: unknown; size: number; strokeColor: string; loop: boolean; autoplay: boolean; speed: number }>); });
    return () => { mounted = false; media.removeEventListener("change", update); };
  }, []);

  const glyph = glyphs[name];
  if (reduceMotion || !Renderer) return <glyph.Fallback aria-hidden="true" className={className} style={{ width: size, height: size, color }} />;
  return <span aria-hidden="true" className={`animated-glyph ${className}`} style={{ width: size, height: size }}><Renderer animation={glyph.animation} size={size} strokeColor={color} loop={glyph.loop} autoplay speed={1.1} /></span>;
}
