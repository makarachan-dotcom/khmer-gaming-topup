import type { AnimationItem } from "lottie-web";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";

const backArrowAssetUrl = "/manus-storage/lottieflow-back-arrow_74481687.json";

export function AnimatedBackButton({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  const [, navigate] = useLocation();
  const hostRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const timerRef = useRef<number | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
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
    if (!host || reduceMotion || navigator.userAgent.toLowerCase().includes("jsdom")) return;
    const controller = new AbortController();
    let disposed = false;
    host.replaceChildren();
    void Promise.all([
      fetch(backArrowAssetUrl, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Back animation is unavailable");
        return response.json();
      }),
      import("lottie-web"),
    ]).then(([payload, module]) => {
      if (disposed || !hostRef.current) return;
      const animation = module.default.loadAnimation({ container: hostRef.current, renderer: "svg", loop: true, autoplay: false, animationData: payload, rendererSettings: { preserveAspectRatio: "xMidYMid meet" } });
      animationRef.current = animation;
      animation.goToAndStop(0, true);
      if (isLeaving) animation.play();
    }).catch(() => { /* The accessible ArrowLeft fallback remains visible. */ });
    return () => {
      disposed = true;
      controller.abort();
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [reduceMotion]);

  useEffect(() => {
    if (!isLeaving) return;
    animationRef.current?.play();
    if (reduceMotion) {
      navigate(href);
      return;
    }
    timerRef.current = window.setTimeout(() => navigate(href), 360);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [href, isLeaving, navigate, reduceMotion]);

  return <button type="button" onClick={() => !isLeaving && setIsLeaving(true)} aria-busy={isLeaving} className={`animated-back-button inline-flex items-center gap-2 ${isLeaving ? "animated-back-button--leaving" : ""} ${className}`}>
    <span aria-hidden="true" className="relative grid h-4 w-4 place-items-center">
      <ArrowLeft className={`h-4 w-4 transition-opacity duration-150 ${isLeaving && !reduceMotion ? "opacity-0" : "opacity-100"}`} />
      {!reduceMotion ? <span ref={hostRef} className={`absolute inset-0 ${isLeaving ? "opacity-100" : "pointer-events-none opacity-0"}`} /> : null}
    </span>
    <span>{children}</span>
  </button>;
}
