# ZURS STORE Motion Asset Direction

LottieFlow provides lightweight downloadable Lottie icon animations, including ecommerce, social media, success, and menu categories. Lordicon provides exportable animated icons and an optional web component, but it requires selecting assets under the appropriate license.

The LottieFlow download endpoint presented a Cloudflare verification in the automated browser session, so no third-party animation file was copied into the project. The storefront will therefore use a restrained, dependency-free motion system for now: existing iconography receives transform-and-opacity micro-interactions only, all nonessential animation is disabled under `prefers-reduced-motion`, and no unlicensed remote animation is embedded.

When a specific LottieFlow or Lordicon asset is downloaded by the owner under its license, it should be stored in `/home/ubuntu/webdev-static-assets/`, uploaded through the project asset workflow, and added as a small page-specific accent rather than a looping decoration on every card.
