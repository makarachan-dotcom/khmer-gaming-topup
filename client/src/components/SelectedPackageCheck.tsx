import type { AnimationItem } from "lottie-web";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const checkboxAssetUrl = "/manus-storage/lottieflow-checkbox-08_3f50ebb9.json";

export function SelectedPackageCheck({ size = 28, className = "" }: { size?: number; className?: string }) {
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
    if (!host || reduceMotion || navigator.userAgent.toLowerCase().includes("jsdom")) return;
    const controller = new AbortController();
    let disposed = false;
    host.replaceChildren();
    void Promise.all([
      fetch(checkboxAssetUrl, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error("Selected package animation is unavailable");
        return response.json();
      }),
      import("lottie-web"),
    ]).then(([payload, module]) => {
      if (disposed || !hostRef.current) return;
      animationRef.current = module.default.loadAnimation({ container: hostRef.current, renderer: "svg", loop: false, autoplay: true, animationData: payload, rendererSettings: { preserveAspectRatio: "xMidYMid meet" } });
    }).catch(() => { /* The visible static check remains available if the asset cannot load. */ });
    return () => {
      disposed = true;
      controller.abort();
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [reduceMotion]);

  return <span className={`selected-package-check relative inline-grid place-items-center ${className}`} style={{ width: size, height: size }} aria-hidden="true"><Check className="relative z-10 h-[68%] w-[68%] text-slate-950" strokeWidth={2.6} /><span ref={hostRef} className="selected-package-check-animation absolute inset-0" /></span>;
}
