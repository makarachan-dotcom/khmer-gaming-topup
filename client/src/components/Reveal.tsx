import * as React from "react";
import { CSSProperties, ElementType, ReactNode, useEffect, useRef, useState } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Render as a different element, e.g. "section" | "article" | "li". Default "div". */
  as?: ElementType;
  /** Stagger index — each step adds 75ms delay (see .zp-reveal in zurs-premium.css). */
  index?: number;
  /** IntersectionObserver threshold. Default 0.15. */
  threshold?: number;
};

/**
 * Scroll-reveal wrapper. Fades/slides children in the first time they enter
 * the viewport. Zero dependencies; motion styles live in styles/zurs-premium.css
 * (`.zp-reveal` / `.zp-reveal--in`) and automatically respect
 * prefers-reduced-motion.
 *
 * Usage:
 *   <Reveal as="section">...</Reveal>
 *   <Reveal index={2}>...</Reveal>   // staggers after index 0 and 1
 */
export function Reveal({ children, className = "", as: Tag = "div", index = 0, threshold = 0.15 }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setInView(true);
            observer.disconnect();
          }
        }
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return (
    <Tag
      ref={ref}
      style={{ "--zp-i": index } as CSSProperties}
      className={`zp-reveal${inView ? " zp-reveal--in" : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </Tag>
  );
}

export default Reveal;
