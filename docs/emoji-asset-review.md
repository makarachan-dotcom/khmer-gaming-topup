# Animated Emoji Asset Review

## Requested sources

| Source | Finding | Storefront decision |
|---|---|---|
| Tarikul-Islam-Anik Telegram Animated Emojis | The repository documentation says the media is associated with Telegram and notes that the media files are subject to Telegram rights. | Do not copy or ship those raw Telegram assets without direct permission. |
| Google Noto Emoji Animation | The official project provides browser-ready animated emoji assets in SVG and mobile-friendly variants. | Use selected Noto animated emoji assets for the website, subject to the upstream Noto licensing terms. |
| IconScout Telegram Emoji packs | The catalog includes both free and premium packs with format and license choices that vary per asset. | Do not use any IconScout asset until the user supplies a licensed download or confirms a specific asset's commercial license. |

## Approved implementation approach

The storefront will use a small number of lightweight, self-hosted Google Noto animated emoji assets as decorative accents. They will not be branded as Telegram Premium emojis, and animation will respect the visitor's reduced-motion setting. No paid or license-restricted marketplace asset will be copied into the project.

## Sources

- https://github.com/Tarikul-Islam-Anik/Telegram-Animated-Emojis
- https://googlefonts.github.io/noto-emoji-animation/
- https://iconscout.com/lottie-animation-packs/telegram-emoji
