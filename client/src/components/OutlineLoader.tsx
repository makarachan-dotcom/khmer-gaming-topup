export function OutlineLoader({ size = 28, color = "#4f46e5", className = "" }: { size?: number; color?: string; className?: string }) {
  return <span aria-hidden="true" className={`outline-loader inline-grid place-items-center ${className}`} style={{ width: size, height: size, color }}>
    <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible" fill="none">
      <path d="M10 27.5a15 15 0 0 1 27.5-7.7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M38 20.5a15 15 0 0 1-27.5 7.7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity="0.34" />
      <circle className="outline-loader-dot outline-loader-dot--one" cx="17" cy="24" r="3.1" fill="currentColor" />
      <circle className="outline-loader-dot outline-loader-dot--two" cx="24" cy="24" r="3.1" fill="currentColor" />
      <circle className="outline-loader-dot outline-loader-dot--three" cx="31" cy="24" r="3.1" fill="currentColor" />
    </svg>
  </span>;
}
