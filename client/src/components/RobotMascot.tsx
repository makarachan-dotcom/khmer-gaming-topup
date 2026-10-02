import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * ZURS robot mascot — fixed top-right.
 * Idle float; every few seconds slides back and spins around.
 * Click it for a spin.
 */
export function RobotMascot() {
  const [spinning, setSpinning] = useState(false);
  const timer = useRef<number | null>(null);

  const doTrick = useCallback(() => {
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 1200);
  }, []);

  useEffect(() => {
    const loop = () => {
      doTrick();
      timer.current = window.setTimeout(loop, 6000 + Math.random() * 4000);
    };
    timer.current = window.setTimeout(loop, 3500);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [doTrick]);

  return (
    <button
      type="button"
      onClick={doTrick}
      aria-label="Robot"
      className={cn(
        "robot-mascot fixed right-3 top-16 z-[260] grid h-14 w-14 place-items-center",
        spinning && "robot-mascot--trick"
      )}
    >
      <svg viewBox="0 0 64 64" className="robot-mascot__body h-12 w-12" aria-hidden="true">
        {/* antenna */}
        <line x1="32" y1="10" x2="32" y2="4" stroke="#c99712" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="32" cy="3.5" r="2.5" fill="#f0cd6e" />
        {/* head */}
        <rect x="16" y="10" width="32" height="22" rx="7" fill="#1e293b" stroke="#c99712" strokeWidth="2" />
        {/* eyes */}
        <circle cx="25" cy="20" r="3.5" fill="#46d8ff" className="robot-eye" />
        <circle cx="39" cy="20" r="3.5" fill="#46d8ff" className="robot-eye" />
        <circle cx="25" cy="20" r="1.4" fill="#fff" />
        <circle cx="39" cy="20" r="1.4" fill="#fff" />
        {/* mouth */}
        <rect x="26" y="26" width="12" height="2.5" rx="1.25" fill="#c99712" />
        {/* body */}
        <rect x="20" y="34" width="24" height="18" rx="6" fill="#1e293b" stroke="#c99712" strokeWidth="2" />
        <circle cx="32" cy="43" r="4" fill="#0f172a" stroke="#46d8ff" strokeWidth="1.5" />
        <circle cx="32" cy="43" r="1.8" fill="#46d8ff" className="robot-core" />
        {/* arms */}
        <rect x="12" y="36" width="6" height="12" rx="3" fill="#334155" stroke="#c99712" strokeWidth="1.5" />
        <rect x="46" y="36" width="6" height="12" rx="3" fill="#334155" stroke="#c99712" strokeWidth="1.5" />
        {/* legs */}
        <rect x="24" y="52" width="6" height="8" rx="3" fill="#334155" stroke="#c99712" strokeWidth="1.5" />
        <rect x="34" y="52" width="6" height="8" rx="3" fill="#334155" stroke="#c99712" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
