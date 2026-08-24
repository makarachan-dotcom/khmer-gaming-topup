# Production publish follow-up

## Current finding

The Vercel production deployment for checkpoint `caf1e05c` is marked **READY**. A fresh `zurs.me` browser visit immediately after that deployment still displayed separate PUBG Mobile **Auto** and **Fast** cards, so custom-domain alias/caching behavior requires a direct deployment-versus-domain comparison before completion.

## Scope

The comparison will only inspect publicly served release assets and routes. It will not expose player information, provider credentials, or payment controls.

## Resolution

After the cache-fresh checkpoint `adf02cd6`, `https://www.zurs.me` completed loading with **9 / 9** cards and one customer-facing `PUBG Mobile` route (`/topup/pubg_mobile`). The separate Auto/Fast child cards are no longer present. The Level Up generated artwork asset remains publicly available from the official domain; package-card preview verification remains the final follow-up.

## Package-card verification

An authenticated Admin Preview on the official Mobile Legends page rendered package cards without customer input. Diamond, bonus, pass/membership, and special package cards used their category-specific artwork together with the official Mobile Legends logo. No question-mark preview appeared, and the Preview retained the disabled purchase/order behavior.
