/**
 * Animated Khmer sampeah (សំពះ) figure. A hand-drawn inline SVG of a person
 * in traditional Khmer dress pressing both palms together and bowing.
 * All motion is CSS-driven (see .sampeah-figure rules): the torso and head
 * bow forward, the joined hands rise slightly, and the eyes blink while the
 * figure greets. No external assets, so it renders instantly and offline.
 */
export function SampeahFigure() {
  return (
    <svg className="sampeah-figure" viewBox="0 0 200 220" role="img" aria-label="មនុស្សសំពះ" fill="none">
      {/* Soft ground shadow */}
      <ellipse className="sampeah-figure__shadow" cx="100" cy="206" rx="52" ry="9" fill="#c8a24a" opacity="0.28" />

      {/* Lower body: golden sampot */}
      <path d="M64 150 Q60 196 70 202 L130 202 Q140 196 136 150 Q100 162 64 150 Z" fill="#b9832c" />
      <path d="M64 150 Q60 196 70 202 L130 202 Q140 196 136 150 Q100 162 64 150 Z" fill="url(#sampotShine)" opacity="0.5" />
      <path d="M96 158 L104 158 L102 200 L98 200 Z" fill="#8a5f1c" opacity="0.65" />

      {/* Bowing group: torso + arms + head bow together from the waist */}
      <g className="sampeah-figure__bow">
        {/* Torso: white shirt with golden collar */}
        <path d="M66 152 Q62 104 84 92 L116 92 Q138 104 134 152 Q100 164 66 152 Z" fill="#fdfaf3" />
        <path d="M66 152 Q62 104 84 92 L116 92 Q138 104 134 152 Q100 164 66 152 Z" fill="url(#shirtShade)" opacity="0.45" />
        {/* Golden sash across the chest */}
        <path d="M84 93 Q104 118 96 154 L106 154 Q116 116 116 93 Z" fill="#d9a83e" opacity="0.9" />
        {/* Collar */}
        <path d="M86 92 Q100 102 114 92 L110 88 L90 88 Z" fill="#c8912e" />

        {/* Upper arms folded toward the chest */}
        <path d="M70 104 Q58 122 72 140 Q80 146 88 138 L92 124 Z" fill="#fdfaf3" />
        <path d="M130 104 Q142 122 128 140 Q120 146 112 138 L108 124 Z" fill="#fdfaf3" />
        <path d="M70 104 Q58 122 72 140 Q80 146 88 138 L92 124 Z" fill="url(#shirtShade)" opacity="0.35" />
        <path d="M130 104 Q142 122 128 140 Q120 146 112 138 L108 124 Z" fill="url(#shirtShade)" opacity="0.35" />

        {/* Joined sampeah hands: pressed palms rising gently */}
        <g className="sampeah-figure__hands">
          <path d="M97 96 Q92 112 93 130 Q96 138 100 138 Q104 138 107 130 Q108 112 103 96 Q100 90 97 96 Z" fill="#f0c49a" />
          <path d="M100 94 L100 136" stroke="#d9a273" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M95 104 Q100 107 105 104" stroke="#d9a273" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        </g>

        {/* Head group: bows a little deeper than the torso */}
        <g className="sampeah-figure__head">
          {/* Neck */}
          <rect x="93" y="76" width="14" height="14" rx="6" fill="#eeb98d" />
          {/* Face */}
          <circle cx="100" cy="56" r="26" fill="#f4c9a0" />
          {/* Ears */}
          <circle cx="75" cy="58" r="5" fill="#eeb98d" />
          <circle cx="125" cy="58" r="5" fill="#eeb98d" />
          {/* Hair */}
          <path d="M74 52 Q74 28 100 28 Q126 28 126 52 Q126 44 118 40 Q112 48 100 46 Q88 48 82 40 Q74 44 74 52 Z" fill="#241a12" />
          <path d="M74 52 Q76 60 79 62 Q76 52 80 44 Q75 46 74 52 Z" fill="#241a12" />
          <path d="M126 52 Q124 60 121 62 Q124 52 120 44 Q125 46 126 52 Z" fill="#241a12" />
          {/* Blinking eyes */}
          <g className="sampeah-figure__eyes">
            <ellipse cx="90" cy="56" rx="3.1" ry="4" fill="#241a12" />
            <ellipse cx="110" cy="56" rx="3.1" ry="4" fill="#241a12" />
            <circle cx="91" cy="54.5" r="1" fill="#ffffff" />
            <circle cx="111" cy="54.5" r="1" fill="#ffffff" />
          </g>
          {/* Eyebrows */}
          <path d="M85 48 Q90 45 95 47" stroke="#241a12" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M105 47 Q110 45 115 48" stroke="#241a12" strokeWidth="1.8" strokeLinecap="round" />
          {/* Gentle smile */}
          <path d="M92 68 Q100 74 108 68" stroke="#b06f45" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          {/* Blush */}
          <circle cx="83" cy="64" r="4" fill="#f2a184" opacity="0.5" />
          <circle cx="117" cy="64" r="4" fill="#f2a184" opacity="0.5" />
        </g>
      </g>

      {/* Sparkles around the figure */}
      <g className="sampeah-figure__sparkles" fill="#e3b34c">
        <path className="sampeah-sparkle" d="M38 70 L40.5 76 L46 78 L40.5 80 L38 86 L35.5 80 L30 78 L35.5 76 Z" />
        <path className="sampeah-sparkle sampeah-sparkle--late" d="M160 54 L162 59 L167 61 L162 63 L160 68 L158 63 L153 61 L158 59 Z" />
        <path className="sampeah-sparkle sampeah-sparkle--later" d="M152 130 L153.6 134 L158 135.6 L153.6 137 L152 141 L150.4 137 L146 135.6 L150.4 134 Z" />
      </g>

      <defs>
        <linearGradient id="sampotShine" x1="64" y1="150" x2="136" y2="202" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e8bc5c" />
          <stop offset="1" stopColor="#a06a1e" />
        </linearGradient>
        <linearGradient id="shirtShade" x1="66" y1="92" x2="134" y2="160" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4d9c2" />
        </linearGradient>
      </defs>
    </svg>
  );
}
