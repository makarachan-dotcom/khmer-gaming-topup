# Animation Asset Research — 2026-08-21

LottieFlow presents downloadable Lottie JSON icon animations and indicates that a free account is required for download. Its publicly shown categories include attention, CTA, ecommerce, loading, social, and success.

Lordicon presents a web-component option via `@lordicon/element`, with exports such as Lottie, SVG, GIF, and WebP. It exposes controls for color, stroke, speed, size, and animation states. License terms must be checked for any selected asset before production use.

For the ZURS STORE production website, the integration will prefer a small self-hosted or project-approved asset set with lazy loading, visible but restrained placement, and `prefers-reduced-motion` support. No premium asset will be embedded or copied without a confirmed license.

The supplied `uneanimations.com` domain did not resolve in the verification environment. The canonical `useanimations.com` library is reachable and presents free Lottie/SVG micro-animations, including notification, menu, navigation, settings, search, loading, checkmark, and activity icons. It links to licensing terms and the maintained React animation library, making it the preferred immediately usable source for visible ZURS STORE icon motion while LottieFlow requires an account download and Lordicon licensing remains asset-specific.

The live Vercel homepage now renders UseAnimations glyphs in the hero quality mark, the three primary service cards, and the header status area. The footer includes the required UseAnimations attribution link. Animated glyphs use static Lucide fallbacks when a visitor enables reduced motion.
