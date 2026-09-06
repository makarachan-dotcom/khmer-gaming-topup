import { CSSProperties, ElementType, ReactNode, useEffect, useRef, useState } from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Render as a different element, e.g. "section" | "article" | "li". Default "div". */
  as?: ElementType;
  /** Stagger index — each step adds 75ms delay (see .zp-reveal in zurs-premium.css). */
  index?: number;
  /** IntersectionObserver threshold. Default 0.01 so first-screen content never stays blank. */
  threshold?: number;
};

/**
 * Scroll-reveal wrapper. The first item (index 0) starts visible so a slow
 * IntersectionObserver — or a tall first section — can never leave the shop
 * or home hero at opacity 0. Later items fade in when they enter view.
 */
export function Reveal({ children, className = "", as: Tag = "div", index = 0, threshold = 0.01 }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(index === 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setInView(true);
      return;
    }
    if (index === 0) {
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
      { threshold, rootMargin: "64px 0px 64px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, index]);

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
