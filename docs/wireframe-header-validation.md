# Wireframe Header Validation

The top header contains the requested `fx-contour` SVG markup with the word `OUTLINE`. Its CSS uses the supplied `--ink`, `--ink-2`, and `--ink-3` tokens; `stroke-dasharray: 34 66`; a 3.2-second linear `stroke-dashoffset` animation; and a `prefers-reduced-motion` override that disables the animation.

Desktop visual validation at 1280px confirmed that the animated wireframe label is visible in the header without covering navigation or account controls. Mobile validation at 375px confirmed that the responsive wrapper hides the decorative label before it can crowd the compact header; the logo, account controls, banner, and bottom navigation remain visible without horizontal overflow.
