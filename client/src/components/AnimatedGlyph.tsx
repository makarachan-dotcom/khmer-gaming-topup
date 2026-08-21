import UseAnimations from "react-useanimations";
import activity from "react-useanimations/lib/activity";
import arrowRightCircle from "react-useanimations/lib/arrowRightCircle";
import checkmark from "react-useanimations/lib/checkmark";
import notification from "react-useanimations/lib/notification";
import { Activity, BellRing, CheckCircle2, CircleArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

export type AnimatedGlyphName = "activity" | "next" | "notify" | "success";

const glyphs = {
  activity: { animation: activity, Fallback: Activity, loop: true },
  next: { animation: arrowRightCircle, Fallback: CircleArrowRight, loop: false },
  notify: { animation: notification, Fallback: BellRing, loop: true },
  success: { animation: checkmark, Fallback: CheckCircle2, loop: false },
} as const;

export function AnimatedGlyph({ name, size = 28, color = "#4f46e5", className = "" }: { name: AnimatedGlyphName; size?: number; color?: string; className?: string }) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const glyph = glyphs[name];
  if (reduceMotion) return <glyph.Fallback aria-hidden="true" className={className} style={{ width: size, height: size, color }} />;
  return <span aria-hidden="true" className={`animated-glyph ${className}`} style={{ width: size, height: size }}><UseAnimations animation={glyph.animation} size={size} strokeColor={color} loop={glyph.loop} autoplay speed={1.1} /></span>;
}
