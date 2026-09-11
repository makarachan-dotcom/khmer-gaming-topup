import { useId } from "react";

/**
 * Friendly Khmer figure who laughs and waves. Same gold/cream language as
 * SampeahFigure, so it can stand next to the Lottie cluster without looking
 * like a different mascot. The right arm, body sway, blink and sparkles all
 * share the 4.8s beat used by `.zs-chat__orbit`.
 */
export function WavingPerson() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg className="wave-person" viewBox="0 0 140 180" role="img" aria-label="មនុស្សលើកដៃស្វាគមន៍" fill="none">
      <ellipse className="wave-person__shadow" cx="62" cy="170" rx="36" ry="6.5" fill="#c8a24a" opacity="0.3" />

      <path d="M38 120 Q34 158 44 166 L80 166 Q90 158 86 120 Q62 132 38 120 Z" fill="#b9832c" />
      <path d="M38 120 Q34 158 44 166 L80 166 Q90 158 86 120 Q62 132 38 120 Z" fill={`url(#${uid}-sampot)`} opacity="0.5" />
      <path d="M58 128 L66 128 L64 164 L60 164 Z" fill="#8a5f1c" opacity="0.65" />

      <g className="wave-person__body">
        <path d="M36 122 Q32 78 54 68 L78 68 Q100 78 96 122 Q66 134 36 122 Z" fill="#fdfaf3" />
        <path d="M36 122 Q32 78 54 68 L78 68 Q100 78 96 122 Q66 134 36 122 Z" fill={`url(#${uid}-shirt)`} opacity="0.4" />
        <path d="M54 70 Q66 96 60 124 L72 124 Q80 90 78 70 Z" fill="#d9a83e" opacity="0.88" />
        <path d="M56 68 Q66 76 78 68 L74 64 L60 64 Z" fill="#c8912e" />

        <path d="M42 84 Q28 104 38 120 Q46 124 54 112 L56 96 Z" fill="#fdfaf3" />
        <path d="M42 84 Q28 104 38 120 Q46 124 54 112 L56 96 Z" fill={`url(#${uid}-shirt)`} opacity="0.28" />

        <g className="wave-person__arm">
          <path d="M86 78 Q110 68 118 46 Q122 38 114 36 Q102 52 90 64 Z" fill="#fdfaf3" />
          <g className="wave-person__hand">
            <ellipse cx="118" cy="34" rx="9.5" ry="8.2" fill="#f0c49a" />
            <path d="M113 28 Q115 18 120 18" stroke="#f0c49a" strokeWidth="4.2" strokeLinecap="round" />
            <path d="M119 27 Q126 18 129 21" stroke="#f0c49a" strokeWidth="3.6" strokeLinecap="round" />
            <path d="M122 30 Q130 24 132 28" stroke="#eeb98d" strokeWidth="3" strokeLinecap="round" />
          </g>
        </g>

        <rect x="57" y="58" width="12" height="12" rx="5" fill="#eeb98d" />
        <g className="wave-person__head">
          <circle cx="63" cy="42" r="22" fill="#f4c9a0" />
          <circle cx="42" cy="44" r="4.2" fill="#eeb98d" />
          <circle cx="84" cy="44" r="4.2" fill="#eeb98d" />
          <path d="M42 40 Q42 20 63 20 Q84 20 84 40 Q84 32 78 30 Q72 38 63 36 Q54 38 48 30 Q42 32 42 40 Z" fill="#241a12" />
          <path d="M42 40 Q44 50 48 52 Q44 40 48 32 Q43 34 42 40 Z" fill="#241a12" />
          <path d="M84 40 Q82 50 78 52 Q82 40 78 32 Q83 34 84 40 Z" fill="#241a12" />
          <path d="M48 36 Q54 32 60 35" stroke="#241a12" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M67 35 Q73 32 79 36" stroke="#241a12" strokeWidth="1.7" strokeLinecap="round" />
          <g className="wave-person__eyes">
            <ellipse cx="55" cy="44" rx="2.5" ry="3.2" fill="#241a12" />
            <ellipse cx="72" cy="44" rx="2.5" ry="3.2" fill="#241a12" />
            <circle cx="56" cy="42.8" r="0.8" fill="#fff" />
            <circle cx="73" cy="42.8" r="0.8" fill="#fff" />
          </g>
          <circle cx="48" cy="50" r="3.4" fill="#f2a184" opacity="0.55" />
          <circle cx="78" cy="50" r="3.4" fill="#f2a184" opacity="0.55" />
          <path d="M56 54 Q63 62 71 54" stroke="#b06f45" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </g>
      </g>

      <g className="wave-person__sparkles" fill="#e3b34c">
        <path className="wave-person__sparkle" d="M18 48 L20 54 L26 56 L20 58 L18 64 L16 58 L10 56 L16 54 Z" />
        <path className="wave-person__sparkle wave-person__sparkle--late" d="M118 78 L119.6 82 L124 83.6 L119.6 85 L118 89 L116.4 85 L112 83.6 L116.4 82 Z" />
        <path className="wave-person__sparkle wave-person__sparkle--later" d="M104 22 L105.4 25.4 L109 26.8 L105.4 28.2 L104 31.6 L102.6 28.2 L99 26.8 L102.6 25.4 Z" />
      </g>

      <defs>
        <linearGradient id={`${uid}-sampot`} x1="38" y1="120" x2="86" y2="166">
          <stop stopColor="#f3d27a" />
          <stop offset="1" stopColor="#8a5f1c" />
        </linearGradient>
        <linearGradient id={`${uid}-shirt`} x1="36" y1="68" x2="96" y2="122">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4d9c2" />
        </linearGradient>
      </defs>
    </svg>
  );
}
