# Mobile Legends Family Consolidation Release

## Local validation

The mobile storefront review showed one Mobile Legends card and no Global, Promo, or Special child cards. The consolidated card routes to the `mobile_legends` family page, where active provider variants are retrieved as one package list.

## Custom-domain verification

The first two browser checks immediately after publication returned a blank document shell, but the Vercel production deployment reached `READY`. A subsequent cache-fresh check at `https://www.zurs.me/?release=029292a2&verification=1` loaded the current storefront and showed **9 / 9** customer-facing game cards, including exactly one `Mobile Legends` card linked to `/topup/mobile_legends`. Global, Promo, and Special were absent as child cards. No credentials, player IDs, or player names are recorded in this note.
