import { useEffect, useState, type CSSProperties } from "react";

/**
 * ភ្ជុំបិណ្ឌ ២០២៦ — festival UI
 * Active: 2026-10-05 00:00 +07 → 2026-10-13 00:00 +07
 * Class auto-clears; no user-facing expiry copy.
 */

export const PCHUM_BEN_START = new Date("2026-10-05T00:00:00+07:00").getTime();
export const PCHUM_BEN_END = new Date("2026-10-13T00:00:00+07:00").getTime();

export function isPchumBenActive(now: number = Date.now()): boolean {
  return now >= PCHUM_BEN_START && now < PCHUM_BEN_END;
}

function msUntilPchumBenEnd(now: number = Date.now()): number {
  return Math.max(0, PCHUM_BEN_END - now);
}

export function usePchumBenTheme() {
  const [active, setActive] = useState(() => isPchumBenActive());

  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const on = isPchumBenActive();
      root.classList.toggle("pchum-ben", on);
      setActive(on);
      return on;
    };

    sync();

    const remaining = msUntilPchumBenEnd();
    let timer: number | undefined;
    if (remaining > 0 && remaining < 2_147_000_000) {
      timer = window.setTimeout(() => {
        root.classList.remove("pchum-ben");
        setActive(false);
      }, remaining);
    }

    const poll = window.setInterval(() => {
      if (!sync() && timer != null) {
        window.clearTimeout(timer);
        timer = undefined;
      }
    }, 60_000);

    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.clearInterval(poll);
      if (!isPchumBenActive()) root.classList.remove("pchum-ben");
    };
  }, []);

  return active;
}

/** Soft ambient lights — null outside festival (does not own theme class). */
export function PchumBenAtmosphere() {
  const [active, setActive] = useState(() => isPchumBenActive());
  useEffect(() => {
    setActive(isPchumBenActive());
    const remaining = msUntilPchumBenEnd();
    let timer: number | undefined;
    if (remaining > 0 && remaining < 2_147_000_000) {
      timer = window.setTimeout(() => setActive(false), remaining);
    }
    const poll = window.setInterval(() => setActive(isPchumBenActive()), 60_000);
    return () => {
      if (timer != null) window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, []);
  if (!active) return null;
  return (
    <div className="pchum-atmosphere" aria-hidden="true">
      <span className="pchum-atmosphere__glow pchum-atmosphere__glow--a" />
      <span className="pchum-atmosphere__glow pchum-atmosphere__glow--b" />
      <span className="pchum-atmosphere__glow pchum-atmosphere__glow--c" />
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className="pchum-atmosphere__spark"
          style={
            {
              "--s-i": i,
              "--s-x": `${6 + ((i * 17) % 88)}%`,
              "--s-d": `${4.5 + (i % 7) * 0.85}s`,
              "--s-delay": `${(i * 0.38) % 6}s`,
              "--s-size": `${2 + (i % 4)}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function PchumBenBanner() {
  const [visible, setVisible] = useState(() => {
    if (!isPchumBenActive()) return false;
    try {
      return sessionStorage.getItem("zurs-pchum-banner-hide") !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!isPchumBenActive()) {
      setVisible(false);
      return;
    }
    const remaining = msUntilPchumBenEnd();
    if (remaining <= 0) {
      setVisible(false);
      return;
    }
    const t = window.setTimeout(() => setVisible(false), Math.min(remaining, 2_147_000_000));
    return () => window.clearTimeout(t);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    try {
      sessionStorage.setItem("zurs-pchum-banner-hide", "1");
    } catch {
      /* private mode */
    }
  };

  return (
    <section className="pchum-banner container pt-4 sm:pt-6" aria-label="ពិធីភ្ជុំបិណ្ឌ">
      <div className="pchum-banner__frame relative isolate overflow-hidden rounded-2xl">
        <div className="pchum-banner__bg" aria-hidden="true" />
        <div className="pchum-banner__shine" aria-hidden="true" />
        <div className="pchum-banner__ring" aria-hidden="true" />
        <div className="pchum-banner__ornament pchum-banner__ornament--l" aria-hidden="true" />
        <div className="pchum-banner__ornament pchum-banner__ornament--r" aria-hidden="true" />
        <div className="pchum-banner__particles" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <span key={i} className="pchum-banner__particle" style={{ "--p-i": i } as CSSProperties} />
          ))}
        </div>
        <svg className="pchum-banner__lotus" viewBox="0 0 100 60" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.55">
            <path d="M50 55 C50 35 42 25 50 8 C58 25 50 35 50 55" />
            <path d="M50 55 C40 45 30 42 22 30 C35 32 45 40 50 55" />
            <path d="M50 55 C60 45 70 42 78 30 C65 32 55 40 50 55" />
            <path d="M20 55 Q50 48 80 55" />
          </g>
        </svg>

        <button type="button" className="pchum-banner__close" onClick={dismiss} aria-label="បិទ">
          ×
        </button>

        <div className="pchum-banner__content relative z-10">
          <span className="pchum-banner__badge">−10%</span>
          <p className="pchum-banner__kicker">ពិធីបុណ្យប្រពៃណីខ្មែរ · ១០–១២ តុលា ២០២៦</p>
          <h2 className="pchum-banner__title zp-khmer-display">សួស្តី​ពិធី​ភ្ជុំ​បិណ្ឌ</h2>
          <p className="pchum-banner__sub">
            បញ្ចុះតម្លៃ <strong>10%</strong> គ្រុប់កញ្ចប់ — សម្រាប់អតិហិជនជាទីស្រឱាញ់
          </p>
        </div>
      </div>
    </section>
  );
}

export function PchumBenChip({ className = "" }: { className?: string }) {
  if (!isPchumBenActive()) return null;
  return (
    <span className={`pchum-chip ${className}`.trim()} title="ភ្ជុំបិណ្ឌ · −10%">
      −10% · ភ្ជុំបិណ្ឌ
    </span>
  );
}
