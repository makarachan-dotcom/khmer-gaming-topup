# VPS Worker Integration Verification

The self-hosted HTTPS worker health endpoint returned `{"status":"ok"}` during the release check. The server-only credential probe using the supplied non-user test payload passed and returned the documented valid-name response.

Vercel production deployment `dpl_HNjQoULpfdRZxYphgq59PnAwMft8` for commit `73722d9f` reached `READY` and is aliased to `zurs.me`, `www.zurs.me`, and `zurs.vercel.app`. A direct custom-domain request with the release marker reached `www.zurs.me` and rendered the ZURS storefront shell. No VPS Worker credential, player ID, server ID, or player name is recorded in this document.
