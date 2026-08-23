# Honor of Kings Check-ID Release Verification

The self-hosted worker HTTPS health endpoint was available during release validation, and the managed credential probe for the documented Honor of Kings request completed successfully without recording the returned player name.

Vercel production deployment `dpl_CKBpUtoV59Wf96EwJiPu8F2SLGDV` for checkpoint `5893ec02` reached `READY` with aliases for `zurs.me` and `www.zurs.me`. A direct cache-busted `zurs.me` visit rendered the authenticated storefront and loaded all 12 provider game cards, including the Honor of Kings card. Purchase controls remain disabled pending payment-security approval.

The final live fallback repair accepted the worker response's nullable `zoneId` field. Production deployment `dpl_2QeqCr5xS9kC3PSmSJow18R9GsC9` reached `READY`, and a direct public `provider.validatePlayerId` request for Honor of Kings returned `verified`. The verification record intentionally excludes player identifiers, player names, and worker credentials.

The current main checkpoint `9965b985` was also confirmed as a `READY` Vercel production deployment, with aliases for `zurs.me` and `www.zurs.me`. A direct cache-busted visit to `zurs.me` loaded the authenticated storefront and all 12 provider game cards.
