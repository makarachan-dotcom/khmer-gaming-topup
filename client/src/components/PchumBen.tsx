import { useEffect, useState } from "react";

/**
 * Pchum Ben festival window 2026: Oct 10-12.
 * Banner + theme show from Oct 5 through end of Oct 12, then auto-hide.
 */
export const PCHUM_BEN_END = new Date("2026-10-13T00:00:00+07:00").getTime();

export function isPchumBenActive(): boolean {
  return Date.now() < PCHUM_BEN_END;
}

/** Applies/removes the festival theme class on <html>. Auto-cleans after Oct 12. */
export function usePchumBenTheme() {
  const [active, setActive] = useState(isPchumBenActive);
  useEffect(() => {
    const root = document.documentElement;
    if (isPchumBenActive()) {
      root.classList.add("pchum-ben");
      setActive(true);
    } else {
      root.classList.remove("pchum-ben");
      setActive(false);
    }
    return () => root.classList.remove("pchum-ben");
  }, []);
  return active;
}

/**
 * Khmer-style Pchum Ben banner. Auto-hides after the festival ends.
 * Traditional warm palette: candlelight gold on deep temple dusk.
 */
export function PchumBenBanner() {
  const [visible, setVisible] = useState(isPchumBenActive);
  useEffect(() => {
    if (!isPchumBenActive()) setVisible(false);
  }, []);
  if (!visible) return null;

  return (
    <section className="pchum-banner container pt-4 sm:pt-6" aria-label="ពិធីភ្ជុំបិណ្ឌ">
      <div className="pchum-banner__frame relative isolate overflow-hidden rounded-2xl">
        {/* Temple dusk gradient */}
        <div className="pchum-banner__bg" aria-hidden="true" />
        {/* Floating light particles (candles/incense) */}
        <div className="pchum-banner__particles" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="pchum-banner__particle" style={{ "--p-i": i } as React.CSSProperties} />
          ))}
        </div>
        {/* Lotus motif */}
        <svg className="pchum-banner__lotus" viewBox="0 0 100 60" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
            <path d="M50 55 C50 35 42 25 50 8 C58 25 50 35 50 55" />
            <path d="M50 55 C40 45 30 42 22 30 C35 32 45 40 50 55" />
            <path d="M50 55 C60 45 70 42 78 30 C65 32 55 40 50 55" />
            <path d="M20 55 Q50 48 80 55" />
          </g>
        </svg>
        <div className="pchum-banner__content relative z-10">
          <p className="pchum-banner__kicker">ពិធីបុណ្យប្រពៃណីខ្មែរ • ១០–១២ តុលា ២០២៦</p>
          <h2 className="pchum-banner__title">សួស្ដី​ពិធី​ភ្ជុំ​បិណ្ឌ 🙏</h2>
          <p className="pchum-banner__sub">
            បញ្ចុះតម្លៃ <strong>10%</strong> គ្រប់កញ្ចប់ — ចំណេញជានិច្ចសម្រាប់អតិថិជនជាទីស្រឡាញ់
          </p>
        </div>
      </div>
    </section>
  );
}
