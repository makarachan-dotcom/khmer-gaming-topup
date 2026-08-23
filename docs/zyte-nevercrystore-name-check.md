# Zyte / nevercrystore Game ID Name-Check

Owner-approved extension of the server-side player-name verification chain. It adds coverage for games the existing Mobile-Legends-only fallbacks cannot check, and adds one more bounded rotation step for Mobile Legends itself. It changes nothing about the product catalog, packages, payment readiness, or purchase controls.

## Chain order

Mobile Legends categories (`mobile_legends_*`):

1. FZR Cards `validate-id` (primary)
2. RapidAPI Game ID Checker (when configured)
3. Neferbyte (when configured)
4. Isan nickname endpoint
5. **nevercrystore via Zyte browser** (final, owner-approved)

Other approved games (Free Fire, PUBG Mobile, Honor of Kings, Magic Chess):

1. FZR Cards `validate-id` (primary)
2. **nevercrystore via Zyte browser** — only when FZR *cannot check* the id (route unavailable, or the category unsupported/unreachable). An authoritative FZR verdict (valid or invalid player) is never overridden.

Every step is attempted at most once (the Zyte step performs at most two bounded browser attempts, the second only after a session/CSRF expiry). The chain is finite and cannot rotate indefinitely.

## How the Zyte step works

The target site sits behind an anti-bot gate that blocks datacenter IPs, so the check runs through the Zyte API browser instead of a direct request:

1. Zyte loads the public nevercrystore game page in a real browser (this clears the gate and yields the in-page CSRF token + session cookies).
2. A Zyte `evaluate` action runs `fetch("/check-user")` **inside that page/session** and publishes the raw JSON verdict into a `<pre id="ncs-check-result">` DOM node (URI-encoded to avoid HTML entity ambiguity).
3. The server reads the node back from the returned `browserHtml` and parses the verdict: `status: 1` + `data.username` → verified; `status: 0` → invalid; anything else → unavailable.

One Zyte browser session is reused per server process for up to 15 minutes to limit credit usage. The `ZYTE_API_KEY` stays server-side only and is never logged, returned to clients, or stored in source control.

## Game mapping

| Storefront game id (prefix) | nevercrystore category | Id shape |
| --- | --- | --- |
| `mobile_legends_*` | 23 (`mobile-legends-kh1`) | `user_id` + `server_id` |
| `magic_chess_*` | 25 (`magic-chess-gogo`) | `user_id` + `server_id` |
| `free_fire_*` | 21 (`free-fire-sgmy`) | `player_id` |
| `pubg_*` | 27 (`pubg-mobile`) | `player_id` |
| `honor_of_kings*` | 22 (`honor-of-kings-1`) | `player_id` |

Games outside this map return `not_supported` without any network call and keep the existing locked behavior.

## Configuration

- Set `ZYTE_API_KEY` (server-only environment variable) to the Zyte API key from the Zyte dashboard. Without it, the Zyte steps are skipped and the chain behaves exactly as before.

## Verification record (2026-08-23)

- Live probe (skipped by default; ran once with `VITEST_LIVE_CREDENTIALS=1`): Zyte authorized the browser extract route, the in-page `fetch("/check-user")` reached the nevercrystore API, and an intentionally-unknown Mobile Legends id returned a parseable `status: 0` verdict in ~18s. No real player identifier was used or recorded.
- Mocked unit coverage: game mapping, malformed-id rejection, verified/invalid verdict parsing, single bounded retry on CSRF expiry, bounded failure when Zyte itself is down, and no credential leakage into results or request bodies beyond the server-side auth header.
- Chain coverage: Mobile Legends rotates FZR → RapidAPI → Neferbyte → Isan → Zyte and stops; non-Mobile-Legends games rotate to Zyte only when FZR cannot check; unmapped games stay locked with a single provider call.
- Full validation: test suite (52 files / 139 tests, 11 intentionally skipped live credential probes), TypeScript `tsc --noEmit`, and the production build all passed.

## Operational notes

- Each check consumes Zyte browser credits; the existing per-route throttling and the debounced client flow remain the cost guardrails.
- If nevercrystore changes its category ids or page slugs, update `NCS_GAME_MAP` in `server/zyteGameIdChecker.ts`.
- Longer term, contracting a vendor top-up API directly (e.g. SmileOne/topupapi) removes the dependency on a third-party storefront's check endpoint.
