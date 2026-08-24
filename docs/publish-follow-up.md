# Production publish follow-up

## Current finding

The Vercel production deployment for checkpoint `caf1e05c` is marked **READY**. A fresh `zurs.me` browser visit immediately after that deployment still displayed separate PUBG Mobile **Auto** and **Fast** cards, so custom-domain alias/caching behavior requires a direct deployment-versus-domain comparison before completion.

## Scope

The comparison will only inspect publicly served release assets and routes. It will not expose player information, provider credentials, or payment controls.
