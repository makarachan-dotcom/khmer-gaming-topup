import { useLayoutEffect, useRef, useState } from "react";

type OverflowMarqueeProps = {
  text: string;
  className?: string;
  trackClassName?: string;
};

export function OverflowMarquee({ text, className = "", trackClassName = "" }: OverflowMarqueeProps) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const viewport = viewportRef.current;
      const label = textRef.current;
      if (!viewport || !label) return;
      setOverflows(label.scrollWidth > viewport.clientWidth + 1);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    if (viewportRef.current && observer) observer.observe(viewportRef.current);
    return () => observer?.disconnect();
  }, [text]);

  return (
    <span ref={viewportRef} className={`overflow-marquee ${className}`} title={text}>
      <span className={`overflow-marquee__track ${overflows ? "overflow-marquee__track--active" : ""} ${trackClassName}`}>
        <span ref={textRef}>{text}</span>
        {overflows ? <span aria-hidden="true">{text}</span> : null}
      </span>
    </span>
  );
}
