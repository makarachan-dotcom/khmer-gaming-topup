# Security changes only (server-side)

**No front-end files are touched.** `client/index.html`, `vercel.json`,
`vite.config.ts` and every page component are byte-identical to your zip.
Nothing in this change can affect how the site renders.

## Files changed

| File | Change |
|---|---|
| `server/rateLimit.ts` | **new** - durable rate limiter (Upstash Redis REST, no new deps) |
| `server/rateLimit.test.ts` | **new** - vitest coverage + regression guards |
| `server/paymentLinkRoutes.ts` | pay-key + invalid-token limits made durable |
| `server/app.ts` | `trust proxy`, limiter on `/api/auth` and `/api/trpc` |
| `server/routers.ts` | `orders.createTopup` limited per user |
| `.env.example` | **new** - the two Upstash variables |

## The bug this fixes

The old limiter counted in an in-memory `Map`. On Vercel each request can hit a
fresh serverless instance, so the counter was nearly always empty. That is why
40 requests to `POST /api/pay/security/check/key` returned `401` forty times
and never `429`. Counters now live in Redis, shared across all instances.

## Limits

| Endpoint | Limit | Keyed by | If Redis is down |
|---|---|---|---|
| `POST /api/pay/security/check/key` | 5 / 5 min | IP | fail-closed (429) |
| `GET /api/pay/:token` (invalid) | 10 / hour | IP | fail-closed |
| `/api/auth/*` | 10 / min | IP | fail-closed |
| `/api/trpc/*` | 60 / min | IP | fail-open (allow) |
| `orders.createTopup` | 10 / hour | user id | fail-closed |

Blocked requests return `429` with `Retry-After` and
`{ "code": "RATE_LIMITED", "retryAfter": <seconds> }`.
The pay-key limiter runs **before** `resolveUser`, so an attacker is stopped
before the database is touched.

## Setup

1. Free Redis at <https://console.upstash.com>, region **Singapore (ap-southeast-1)**.
2. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the REST panel.
3. Vercel > Settings > Environment Variables, add both to **Production and Preview**.
4. Redeploy.

Without them the limiter falls back to in-memory counting and logs a warning.
It still boots, it is just not durable.

## Test before pushing

```bash
pnpm check
pnpm vitest run server/rateLimit.test.ts
```

## Verify after deploy

```bash
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST https://www.zurs.me/api/pay/security/check/key \
    -H 'content-type: application/json' -d '{"orderId":"wrong"}'
done; echo
# expect: 401 401 401 401 401 429 429 429 429 429
```

## Push

```bash
git checkout -b fix/ratelimit-regression
git add server/rateLimit.ts server/rateLimit.test.ts server/paymentLinkRoutes.ts \
        server/app.ts server/routers.ts .env.example SECURITY-CHANGES.md
git commit -m "fix(security): durable rate limiting on pay key, auth and tRPC endpoints"
git push -u origin fix/ratelimit-regression
```

---

# Login abuse guard — zurs.me/login

Added after the storefront reported that `/login` had no abuse protection at
all: unlimited code requests, unlimited wrong codes, and no consequence for
repeating either.

## Policy

| Rule | Value | Where it is enforced |
| --- | --- | --- |
| Wrong codes before a block | **5** in a 30 minute window | `server/loginAbuseGuard.ts` |
| Block duration | **24 hours**, fixed | `loginBlockSeconds` |
| Scope of a block | IP **and** device **and** email, together | `cascadeBlock()` |
| New device from a blocked IP | blocked on its **first** request | `evaluateLoginAttempt()` |
| Sign-up while blocked | refused — no account row is created | `server/appwriteAuth.ts` |
| IP reporting | every strike, block and cascade | `getLoginAbuseReport()` |

## Why the verify flow is pre-charged

Appwrite verifies the one-time code **in the browser**, so the server never sees
a wrong code. Any "the client tells us it failed" design is therefore optional
from the attacker's point of view. Instead:

1. `POST /api/auth/login/verify-attempt` charges the strike *before* the browser
   contacts Appwrite and returns a single-use `claimId` bound to IP + device.
2. `POST /api/auth/login/verify-result` with `outcome: "success"` refunds it.

Abandoning the flow costs a strike. That is the safe direction to be wrong in.

A correct code arriving **during** an active block does not lift it —
`clearLoginFailures()` resets strike counters only, never a block. Otherwise the
whole guard would be bypassed by guessing right on attempt six.

## Cascade

An IP and a device are linked the first time they are seen together (7 day TTL).
When a block is created it is written to the IP, the device and the email at
once, plus every device already linked to that IP and every IP already linked to
that device, capped at 50 targets so a carrier NAT cannot cause thousands of
writes. A partially-blocked actor — new device, blocked IP — has the missing
parts blocked immediately, **reusing the original expiry**, so switching device
neither restarts nor shortens the countdown.

## Rate limits

Added to `rateLimitBuckets` in `server/rateLimit.ts`:

| Bucket | Limit | Window | Key |
| --- | --- | --- | --- |
| `loginOtpRequestIp` | 12 | 10 min | IP |
| `loginOtpRequestIdentity` | 4 | 15 min | email |
| `loginVerifyDevice` | 12 | 10 min | device |
| `loginGuardProbe` | 90 | 5 min | IP |
| `loginSessionExchange` | 20 | 10 min | device |

The per-IP send budget is deliberately household-sized: Cambodian mobile
carriers put many real customers behind one address. The per-identity limit is
what actually stops credential stuffing.

## Privacy

Redis keys are HMACs of the IP, device id and email — never the raw values. The
admin report keeps the **readable IP** on purpose (that is the point of an IP
report), masks the email as `ab•••@gmail.com`, and stores only a 10-character
device hash. The blocked visitor is told when they can return and nothing else:
no strike count, no scope, no hint about which signal caught them.

## Degraded mode

All state lives in Upstash Redis, reusing the connection in `server/rateLimit.ts`
(no new dependency, no new credential, no migration). Without
`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` the guard falls back to
per-instance memory, which a Vercel cold start will discard — so a 24 hour block
is **not** durable in that mode. The condition is surfaced as `durable: false`
on `GET /api/auth/login/report` rather than hidden.

Optional new env var: `LOGIN_GUARD_SALT` (falls back to `ZURS_SESSION_SECRET`).
Set it so rotating the session secret does not invalidate every active block.

## UI

`client/src/styles/zurs-login.css` is imported last in `client/src/main.tsx` and
overrides the older `.zl-*` rules in `zurs-fixes.css` by cascade order — nothing
was deleted, so a rollback is one import line. Two saturated drifting beams
became one slow aurora at roughly a fifth the opacity; the button shine, card
glow, bouncing device and blinking OTP boxes are gone; one easing curve and one
duration scale are shared by every transition; and the animated `filter: blur()`
on step changes was removed because it cannot be GPU-composited, which is what
made the old page stutter on mid-range Android.

A blocked visitor gets a dedicated screen with a live countdown and a progress
bar showing the 24 hours draining, instead of a dead form.

## Test

```bash
pnpm check
pnpm vitest run server/loginAbuseGuard.test.ts
```

## Verify after deploy

```bash
# five attempts from one device; the fifth should answer 423
for i in 1 2 3 4 5; do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://www.zurs.me/api/auth/login/verify-attempt \
    -H 'content-type: application/json' -H 'x-zurs-device: probe-aaaaaaaaaaaaaaaa' \
    -d '{"email":"probe@example.com"}'
done; echo
# expect: 200 200 200 200 423

# a different device on the same address must be 423 on its first call
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://www.zurs.me/api/auth/login/guard \
  -H 'content-type: application/json' -H 'x-zurs-device: probe-bbbbbbbbbbbbbbbb' \
  -d '{"intent":"request"}'
# expect: 423
```

---

## Round 2 — site-wide ban, mascot, admin unban, email sign-in redirect

### Site-wide enforcement

`server/ipBanGuard.ts` mounts `enforceIpBan` in `server/app.ts` immediately after
`app.set("trust proxy", 1)`, so it runs before every other route. A banned actor
now gets `423` from the whole API, not just from the login endpoints. This is
what makes the ban mean "cannot use the site" rather than "cannot sign in".

Because it covers the Google OAuth start route and the Appwrite session
exchange, hand-typing those URLs while banned does not work either. Hiding the
buttons on the account page is cosmetic; this middleware is the actual control.

**Exemptions, all deliberate:** `/api/auth/login/guard` (the ban screen must
read its own countdown), `/api/admin/*` (role-checked separately; blocking them
would make a ban impossible to lift), `/api/webhooks/*` (a blocked bank callback
loses real money), `/api/scheduled/*` (cron), `/api/health`, plus anything in
`LOGIN_BAN_IP_ALLOWLIST`.

**It fails open.** If Redis is unreachable the request is allowed. An outage
must not take the storefront down. The trade-off is that a Redis outage is also
a window where bans are not enforced; that is the right way round for a shop.

### Carrier NAT risk — read this before raising the strictness

Cambodian mobile carriers put many subscribers behind one address. A site-wide
IP ban can therefore hit real paying customers who share an address with one
abuser. Three mitigations are in place: the admin routes are exempt, there is a
one-click unban page, and `LOGIN_BAN_IP_ALLOWLIST` exists. Do not lower the
threshold below 5 or extend the cascade fanout without thinking about this.

### Admin visibility and release

- `GET /api/admin/login-bans` — active bans with IP, device label, strikes,
  expiry.
- `POST /api/admin/login-bans/lift` — releases one ban; clears the block, the
  strike counter, and the index entry.
- `client/src/pages/AdminLoginBans.tsx` at `/admin/login-bans`, owner-only in
  the sidebar.

Lifting clears strikes as well as the block. Releasing someone into a state
where one more typo re-bans them would make the button useless.

`server/deviceInsight.ts` derives the phone model from Client Hints where the
browser sends them and falls back to a User-Agent parse. It covers the vendor
prefixes that actually show up in Cambodia (`SM-` Samsung, `CPH` OPPO, `RMX`
realme, `V####` vivo, `Redmi`/`POCO` Xiaomi). The label is display-only and is
stripped of control characters before it reaches the admin table.

### Name persistence

`server/appwriteAuth.ts` now reads the existing row before upserting and passes
`name: undefined` when a name is already stored, so Appwrite can never overwrite
a name the member chose. The session response carries `isNewUser`, `needsName`
and `savedName`, and `AppwriteLogin.tsx` only shows the name step when
`needsName` is true. Returning members go straight through.

### Account page while banned

`Account.tsx` calls `checkAccessBan()` on mount. While blocked it renders a
countdown panel and **no anchors at all** — neither "ចូលគណនី" nor "Connect with
Email". The buttons also only fade in after the check resolves, so they never
flash for a banned visitor.

"Connect with Gmail" is now "Connect with Email" and points at
`/login?returnTo=%2Faccount`, i.e. our own OTP flow, not the Google redirect.

### Motion

`client/src/styles/zurs-login.css` gained the mascot styles and a visible
animation layer: staged card entrance, staggered field reveal, a per-digit pop,
a stronger error shake, button lift and a slow sheen. Ambient motion is CSS
(compositor-only, transform/opacity); anything that reacts to a keystroke is
Framer Motion. Everything is switched off under
`@media (prefers-reduced-motion: reduce)`.

The round-1 pass hid `.zl-btn__shine` and the background beams with
`display: none`, which is why the page read as static. That is reverted, but
slower and dimmer than the original.

### Still unverified here

`pnpm check`, `pnpm test` and `pnpm build` could not run in this environment
(no `node_modules`, no network). Type-checking was done file-by-file with
`tsc --noResolve`. Manus runs the real suite before pushing.

## Round 4 - support sheet, banner, name step, live pricing

### 1. ZURS SUPPORT sheet no longer glitches
The sheet overlapped its own header. Three causes stacked up in index.css:
- the whole sheet was the scroll container (overflow: auto)
- .contact-admin-sheet__header had no background of its own
- .contact-admin-card was only 80-90% opaque

So as soon as the content was taller than the sheet, a translucent card slid
across the bold title and the title showed THROUGH it. A hard
`max-height: min(58dvh, 29rem) !important` on phones guaranteed it.

Fix, in client/src/styles/zurs-support.css (imported last, so index.css and
its oklch rules are left untouched): the sheet becomes a flex column with
overflow: hidden, the list scrolls with overscroll-behavior: contain, the
header is sticky and fully opaque, and cards are solid #fff. The stale
`> .flex` / `> .mt-5` selectors from an older DOM shape are neutralised.

### 2. One banner, no background, running colour line
client/src/pages/Home.tsx: bannerSlides (2 images + carousel + dot controls +
6.5s interval) is replaced by a single heroBanner - the artwork you supplied.
The frame is zurs-banner-frame--bare: no border, no bg-panel, and the
zurs-premium.css ::after overlay is switched off. .zurs-banner-beam wraps it
with a 2px ring and spins a conic-gradient behind it, so a cyan > violet >
pink arc travels around the edge. It uses transform: rotate() rather than the
individual rotate property, for Safari and Android WebView. The artwork also
fades up out of a 12px blur as it loads, and prefers-reduced-motion stops all
of it.

### 3. Name step is first-signup only
The server was already right (server/appwriteAuth.ts: isNewUser,
needsName = !storedName, savedName echoed back). The client was the leak:

    const needsName = session.needsName ?? !(await getAppwriteAccount()).name?.trim();

Members who typed their name on this page have NO name on the Appwrite
account, so that fallback re-asked returning users every time. Now:

    const needsName = session.needsName === true && !session.savedName?.trim();

The server is the only authority, and anyone with a stored name is never
re-prompted, so a saved name can no longer be overwritten.

### 4. Price + margin apply immediately, and KHQR follows the new price
- client/src/pages/GameTopup.tsx: packagePreview and previewGamePackages were
  cached with staleTime: 60_000, so a new price could stay invisible to
  shoppers for a full minute. Now staleTime: 0 + refetchInterval: 5_000 +
  refetchOnWindowFocus. Polling is used instead of a BroadcastChannel ping
  because the admin is normally on a DIFFERENT device, and BroadcastChannel
  only reaches tabs in the same browser. (provider.packages is a mutation
  fired on demand, so it was never stale.)
- server/db.ts beginStagedPayment: canReuse checked status, expiry and QR
  presence but NOT the amount, so a pending QR could be handed back at the old
  price. It now also requires Number(existing.amount) === Number(order.subtotal)
  and a matching currency; otherwise a fresh QR is minted at the current price.
  salePriceFromMargin() already writes priceUsd = base * (1 + margin/100) on
  save, and order subtotals are always read server-side, never from the client.

## Round 7 - support chat could never work on this deployment (critical)

### Symptom

A customer opened the chat, saw `កំពុងរង់ចាំក្រុមជំនួយ`, typed a message and got
the red banner `រកមិនឃើញការឆាតនេះទេ។` (`SESSION_NOT_FOUND`). Nobody could chat,
on any device.

### Cause

`vercel.json` deploys the API as serverless functions (`api/[...path].ts`), so
consecutive requests are served by different instances. `server/supportChat.ts`
kept sessions in Redis with a module-scope `Map` fallback. With Upstash not
configured, that `Map` became the only store:

- `POST /api/support/chat/open` created the session in instance A's memory.
- `POST /api/support/chat/message` landed on instance B, where `getSession()`
  returned `null`, so the route answered `404 SESSION_NOT_FOUND`.

Two things hid the fault:

- `writeSession()` caught its own failure and returned `void`, so no caller
  could tell a stored session from a lost one.
- `/open` therefore answered `200` with a session id that existed nowhere.

### Fix

- New `server/supportChatStore.ts`: a TTL key/value store built on the existing
  `site_content` table, reusing the JSON-blob pattern the codebase already
  applies to provider availability, delegated admin permissions, payment
  methods and contact admins. No migration is needed, which matters because a
  migration nobody runs would leave the chat exactly as broken. Rows are written
  `isActive = false` so they never reach the public content feed, each row
  carries its own expiry, and expired rows are swept on read.
- `server/supportChat.ts` resolves ONE shared store per instance - MySQL, else
  Redis, else memory - and warns on the console when it lands on memory.
  Choosing a single tier avoids writing to Redis and reading from MySQL.
- `writeSession()` now returns `boolean`, `openSupportSession()` refuses to
  report success for a session it could not persist, and `/open` answers
  `503 STORAGE_UNAVAILABLE` instead of a `200` that breaks one request later.
- The daily quota moved to the same shared store. In memory it was per instance,
  so "one chat per day" was trivially bypassable and the Telegram-fallback state
  reset at random.
- Client: `SESSION_NOT_FOUND` clears the room and returns the customer to the
  topic picker instead of stranding them. The allowance is charged only when a
  chat is CLOSED, so a lost room costs them nothing.

### Operator requirement

`DATABASE_URL` must be set - it already is, for orders. If it is ever missing
and Upstash is not configured either, the chat now says so loudly instead of
failing silently.

## Round 7 - header mascot position

- Removed the round-5 `position: fixed; top: 66/78px; right: 12/16px` anchors
  from the base `.zs-mascot` rule and from the mobile block. The mascot is a
  header child, so a viewport inset only fought the header layout, and a partial
  merge could resurrect the floating version.
- `.zs-mascot` now has a fixed width plus a real right margin
  (`10px + safe-area` on phones), so the flex row reserves the gap instead of
  letting the mascot hang over the rounded corner.
- `overflow: visible` is asserted on the header, its container and the account
  nav, so no ancestor can clip the mascot or its bubble.
- The mobile bubble clamp tightened to `min(10.5rem, 100vw - 9.5rem)` because
  the bubble now opens from a mascot that sits further inside the header.


## Round 8 - Telegram service (Stars + Premium)

### Symptom
The website could not sell the Telegram service at all, even though the FazerCards
reseller account already exposes it at /panel/telegram.

### Cause (four separate blockers, all real)
1. `server/providerCatalog.ts` curates the catalog with `WANTED_PROVIDER_GAME_PATTERNS`,
   a nine-entry game allowlist. Telegram matched none of them, so it was filtered out
   of the storefront list, the admin sync, the game-details endpoint AND the package
   endpoints.
2. Storefront visibility additionally requires the provider category id to appear in
   `activeGameIds` / `initialApprovedPublicGameIds`. Telegram's category id is not in
   that historical baseline, so an allowlist entry alone would still have hidden it.
3. `submitFzrTopupOrder` always sent `fields.player_id`. Telegram Stars / Premium are
   delivered to a public @username, so a PAID Telegram order would have been rejected
   by the provider and never delivered - the same class of bug as the original
   "money taken, no diamonds" defect already documented in that file.
4. The client resolved the account identifier with a regex that only matches
   `*_id`-style keys. A `username` field resolved to `null`, and
   `canCreateTopupPurchaseContext` requires a non-empty playerId, so checkout could
   never be enabled even if the page rendered.

### Fix
- Added `/(?:^|[_\s(])telegram/i` to `WANTED_PROVIDER_GAME_PATTERNS`.
- Added `isTelegramProviderProduct()`, `telegramUsernameField()` and
  `normalizeTelegramUsername()`.
- Telegram is auto-approved for the storefront on the live path and on both
  cached/outage paths. The owner still controls it the normal way by hiding it in
  Admin, because `hiddenGameIds` is still checked first.
- The cached game-details path returns a single "Telegram Username" field for
  Telegram and never asks for a server/zone. The live path already derives its
  fields from the provider's offers response.
- `submitFzrTopupOrder` sends `{ username }` for Telegram, accepts `@name`, `name`,
  `t.me/name` or a full profile link, strips invalid characters, and refuses an
  unusable handle BEFORE calling the provider rather than after taking money.
- The two client identity regexes now accept username-style keys.

### Operator notes
- No migration and no new environment variable. The service appears as soon as the
  Telegram category is visible to the API key in `FZR_CARDS_API_KEY`
  (with `FZR_CARDS_API_BASE_URL` set).
- Retail pricing still comes from the existing Admin price + margin flow, so the
  Round 4 behaviour applies unchanged: editing the price updates the storefront
  immediately and KHQR regenerates against the new amount.
- Only `submitFzrTopupOrder` pins the outgoing field key. If the provider names the
  Telegram identity field something other than `username`, change it in that one
  place; the form itself is already provider-driven.

## Round 8 - fill-in-info banner was too tall

The game hero on the top-up page reserved `min-height: 19rem` on phones. That rule
lives in a `@media (max-width: 639px)` block in `client/src/index.css` and therefore
overrode the Tailwind `min-h-[17rem]` on the element, which is why editing only the
JSX would not have fixed it. The banner was taller than the form beneath it.

Changed: mobile min-height 19rem -> 10.5rem, JSX `min-h-[17rem]` -> `min-h-[10.5rem]`
and `sm:min-h-[18.5rem]` -> `sm:min-h-[12rem]`, padding `p-5 sm:p-7` -> `p-4 sm:p-5`,
logo 96px/112px -> 56px/64px, title clamp `1.75-2.75rem` -> `1.15-1.75rem`, the
descriptive paragraph is hidden on phones, and the layout is a compact horizontal row
instead of stacking. The eyebrow reads TELEGRAM SERVICE for Telegram products.

## Round 8b - "I dont see telegram": the id-only allowlist gates

**Symptom.** Round 8 shipped. The owner enabled the Telegram service in Admin.
The storefront still showed no Telegram card.

**Root cause.** `isWantedProviderGameId(id)` runs `WANTED_PROVIDER_GAME_PATTERNS`
against the FazerCards `category_id` ALONE. There are nine such id-only gates:

| line | function | what it blocks |
|---|---|---|
| 444 | `publicProviderGameIds` | filters the owner's `activeGameIds` |
| 461 | `cachedPublicProviderGames` | synced catalog |
| 477 | `cachedProviderAvailabilityGames` | admin on/off list |
| 496 | `cachedPublicProviderGamesDuringOutage` | provider-outage fallback |
| 550 | `fetchProviderGameDetails` | the `/game/:id` page |
| 622, 639, 679 | package lookups | the purchase flow |
| 902 | `cachedProviderAvailabilityGamesDuringOutage` | admin list during outage |

`asProviderGames` (L449) matches on `category_id + name + note`, so Telegram
reaches the **admin** list through its display name. Every gate above only sees
the id. If the provider slug is the short form `tg_stars` rather than
`telegram_stars`, the result is the exact reported behaviour:

- Telegram appears in Admin and can be toggled on.
- L444 then strips it straight back out of `activeGameIds` on read, so the
  toggle looks like it does nothing.
- The storefront never lists it, and `/game/:id` answers `unavailable`.

Round 8 only bypassed the `activeIds` clause, which is name-aware. It left the
separate `!isWantedProviderGameId(providerId)` clause untouched, so the bypass
could not take effect.

**Fix.**

1. `WANTED_PROVIDER_GAME_PATTERNS` gained `/(?:^|[_\s(])tg(?:[_\s)]|$)/i`.
   One line repairs all nine id-only gates at the root.
2. `isTelegramProviderProduct` accepts the same two spellings, so the storefront
   bypass and the `username` identity field agree with the allowlist.
3. L461 and L496 now read
   `!(isWantedProviderGameId(providerId) || isTelegramProviderProduct(id + name))`,
   so the synced and outage paths accept Telegram by **name** even when the id
   carries no telegram or tg token at all.
4. `client/src/lib/providerPresentation.ts`: `storefrontGamePriority` gained
   `telegram`, `telegram stars`, `telegram premium`. Previously Telegram scored
   the fallback priority and sorted after every game, so on a phone it sat far
   below the fold - a second, independent reason for "I dont see telegram".

**Verified.** The `tg` token is word-boundaried, so no existing category id
matches it: mobile_legends_global, magic_chess_gogo_global, pubg_mobile_auto,
free_fire_sg, 8_ball_pool, frag_pro_shooter, eafc_mobile_kh and honor_of_kings
all still return false.

**Operator note.** Owner control is unchanged. Hiding Telegram in Admin still
hides it, because `hiddenGameIds` is checked after the allowlist. If Telegram was
ever toggled off it sits in `hiddenGameIds`; toggle it off and on once to clear.

---

## Round 8c - "I still don't see telegram": Telegram is NOT in the /topups catalog

### Root cause (proven from the FazerCards API reference, https://reseller.fazercards.com/en/docs)

Rounds 8 and 8b both assumed Telegram was a `category_id` inside `GET /api/v2/topups`
that was being filtered out by an allowlist. That assumption was wrong. FazerCards
serves Telegram from a **dedicated endpoint family**:

| Purpose | Endpoint | Payload |
| --- | --- | --- |
| Stars quote | `GET /api/v2/telegram/stars` | `{ price_per_star, min_amount, max_amount }` |
| Premium quote | `GET /api/v2/telegram/premium` | `{ plans: [{ months, price_usd }] }` |
| Buy Stars | `POST /api/v2/telegram/stars/buy` | `{ telegram_username, quantity }` |
| Buy Premium | `POST /api/v2/telegram/premium/buy` | `{ telegram_username, months }` |

`GET /api/v2/topups` returns only game top-up categories. It never contained a
Telegram row, so:

- `asProviderGames(catalog.items)` could never emit a Telegram game;
- `WANTED_PROVIDER_GAME_PATTERNS` (rounds 8 + 8b) was filtering a list Telegram was
  never in - the `telegram` and `tg` patterns were correct but irrelevant;
- `storefrontGamePriority` (round 8b) was sorting a card that was never rendered;
- `submitFzrTopupOrder` posted Telegram to `/topups/order`, which the provider
  rejects. A PAID Telegram order would never have been delivered.

This is why the service stayed invisible across three deployments.

### The fix: Telegram becomes a first-class product on the existing rails

All changes are in `server/providerCatalog.ts`. No new dependency, no new table, no
migration, no bespoke checkout.

1. **New Telegram catalog reader** - `fetchTelegramProviderGames()` reads both quote
   endpoints and returns two products in the exact shape the provider sync snapshot
   already uses:
   - `telegram_stars` / "Telegram Stars", packs 50 - 10,000 clamped to the provider's
     own `min_amount` / `max_amount`, priced from `price_per_star`.
   - `telegram_premium` / "Telegram Premium", plans 3 / 6 / 12 months.
   Both require exactly one field, `username` (`telegramUsernameField()`), so
   `requiresZone` stays false and no player-ID validation is attempted.
   Results are cached 60s, **including failures**, so a 403 (product not enabled for
   the API key) is not retried on every storefront render.

2. **Injected into every catalog path** - `fetchProviderGames` now fetches the
   Telegram quotes in parallel with `/topups` and merges them ahead of the game list,
   including both `/topups`-outage branches; `fetchProviderGameDetails` resolves
   Telegram **before** every category-id allowlist gate; the three package functions
   (`fetchPublicProviderPackagePreview`, `fetchProviderPreviewPackages`,
   `fetchProviderPackages`) accept the two Telegram ids.

3. **Admin visibility and control** - `getProviderAvailabilityCatalog` appends the two
   Telegram rows so the owner sees them in the inventory list, and
   `setProviderAvailability` adds the ids to `validGameIds` so toggling no longer
   throws "not available from the synchronized FZR Cards catalog". Hiding still works:
   `hiddenGameIds` is honoured on the storefront and in the detail page.

4. **Real catalog rows via the normal sync** - `fetchFzrProviderSyncSnapshot` now
   returns the Telegram products too (and still returns them when `/topups` itself is
   down). Running Admin -> Sync top-up catalog therefore creates ordinary
   `gameProducts` / `gamePackages` rows with `providerSource = fzr_cards:telegram_stars:stars_100`,
   which is what makes admin price + margin (round 4, R20/R21), KHQR checkout and
   order fulfilment work with zero extra plumbing.

5. **Correct fulfilment** - `submitFzrTopupOrder` detects the Telegram ids and routes to
   `submitTelegramProviderOrder`, which posts to `/telegram/stars/buy` or
   `/telegram/premium/buy`. The offer id carries the amount (`stars_100`, `premium_12`),
   so a paid order replays to the provider with no extra bookkeeping. Handles are
   normalised and rejected before the provider call unless 5-32 characters, so a bad
   handle is flagged for manual review instead of failing silently after payment.
   `db.ts` needed **no change** - `fulfillTopupOrder` keeps calling the same function.

### Pricing

The sync writes provider **cost** to `basePriceUsd` with `profitMarginPercent = 0.00`,
exactly like every other synced game, so the owner sets the margin in Admin -> Pricing.
Before the first sync the storefront applies a default markup so the service is never
displayed at cost: `TELEGRAM_MARGIN_PERCENT` (optional env, default **20%**). Once a row
exists and is active, the admin sale price always wins.

### Verification

- 11 anchored edits, all applied first try (1/1/1/**2**/1/1/1/1/1/1/1).
- `isTelegramBuiltInGameId` referenced 9 times; brace balance 579/579.
- Type check on the edited file: only the 9 pre-existing errors (`node:crypto` at L2 and
  the 8 SMM `services.map` errors, which merely shifted from L891 to L1053).
- Client compatibility re-checked by regex: identity key `username` matches the
  `GameTopup.tsx` player-id extraction and identity-required tests, and fails the
  `requiresZone` test, which is correct.
- The wrong-endpoint round-8 order code is gone (`fields ... = telegramService` count 0).

### Operator note

Telegram must be enabled for the API key in the FazerCards reseller panel. If the quotes
return 403 the two products simply do not appear, and the reason is logged as
`[telegram] stars quote failed ...` / `[telegram] premium quote ...` in the function logs.
After deploying, run Admin -> Sync top-up catalog once; the sync log line now ends with
`telegram=2`.

---

## Round 9 - Telegram identity, Roblox Robux, and the checkout rebuild

### 1. Telegram handle verification (`server/telegramIdentity.ts`, NEW)

Stars and Premium are delivered to a handle, so a typo is unrecoverable. Every
handle is now checked against the **public** `t.me` preview page before payment.

- Only two public values are read: the display name and the profile picture.
- `parseTelegramProfileHtml` is pure, so it is unit-testable with no network.
- Verification requires **positive proof** of an account. `t.me` answers `200 OK`
  even for a handle that does not exist, so a missing name block is reported as
  `invalid`, never guessed as valid.
- Channels and groups are rejected (`subscribers` / `members` in the page), because
  they cannot receive Premium.
- Profile pictures are host-allowlisted to `cdn-telegram.org` / `telesco.pe` over
  HTTPS only. An arbitrary `og:image` is never rendered (SSRF / tracking guard).
- 5-minute success cache, 1-minute failure cache, 400-entry cap, 6-second timeout.
- A timeout returns `unavailable`, never `invalid`, so an outage cannot look like
  a bad username.

Wired into `validateProviderPlayerIdentity`, so the storefront shows the verified
name plus the profile photo in the existing "account verified" card.

### 2. Roblox Robux (`server/providerCatalog.ts`)

Robux is a FazerCards **manual service** - a third endpoint family, neither
`/topups` nor `/telegram`:

    GET  /api/v2/manual-services              -> categories enabled for the key
    GET  /api/v2/manual-services/:id/offers   -> offers with price_usd
    POST /api/v2/manual-services/order          { manual_service_id, product_id }

The round-8c "built-in service" layer was **generalised** rather than copied:
`isTelegramBuiltInGameId` became `isBuiltInProviderGameId` and
`fetchTelegramProviderGames` became `fetchBuiltInProviderGames`, so Roblox rides
the same 11 integration points (storefront list, details, packages, sync,
availability toggles, admin pricing). Offer ids are minted as
`manual_<serviceId>~<productId>` so a paid order can be replayed later.

**Order routing is now explicit**: Telegram goes to `/telegram/../buy`, Roblox to
`/manual-services/order`, everything else to `/topups/order`. Posting a built-in
service to `/topups/order` is rejected upstream, which would mean a PAID order is
never delivered.

New optional env: `ROBLOX_MARGIN_PERCENT` (0-300, defaults to 20).

### 3. Checkout and package surface

| Request | Change |
| --- | --- |
| Delete "package is ready" notice | `PackagePreviewNotice` deleted outright |
| Delete "view packages and prices" | Packages load on page open; the button's condition can no longer be true |
| Shrink payment method | Descriptive paragraph and hint removed; block collapses to a one-line chip once KHQR is picked |
| No re-picking the payment method | `setSelectedPaymentMethodId(null)` removed from ID editing (kept on game switch) |
| Shrink account info | 1 field = full width; 2 fields = long player ID on top, short server ID bottom-right |
| Shrink saved IDs | Single scrollable chip row; hidden once the ID is filled |
| Delete the multi-ID warning | Removed |
| Per-package banner | Owner-editable in Admin -> Pricing, five colour tones |
| Meaningful package art | Inline SVG per reward type for services with no artwork |
| No-refund consent | Dialog before checkout, with agree / decline and an instant support button |
| Marquee | Fed from grouped public store names, so `Free Fire CIS` no longer appears |

The banner overrides live in the existing `site_content` table with
`isActive:false`, so **no database migration is required**.

Fallback artwork is drawn as inline SVG data URIs, so there is no network request,
nothing to 404, and no copyrighted game asset copied into the repo. Any package
picture can still be replaced from Admin, and an override always wins.

### 4. Known limitation to confirm after deploy

`POST /manual-services/order` documents only `manual_service_id` and `product_id`
plus an untyped "optional fields map". There is **no documented field for the
Roblox username**, so it is sent as `fields: { username, roblox_username }`. If
FazerCards ignores it, the buyer's handle must be read from the order chat
(`GET/POST /manual-services/orders/:orderId/chat`).

### 5. Post-deploy checklist

1. Enable **Telegram** *and* **Manual services / Roblox** for the API key.
2. Run **Admin -> Sync top-up catalog**.
3. Set margins for Telegram Stars, Telegram Premium and Roblox Robux.
4. Failures are explicit in the logs: `[roblox] no Roblox manual-service category
   is enabled for this API key`, `[telegram] stars quote failed ...`.


## Round 10 — checkout ergonomics (one-line IDs, sticky payment method, real modal)

Three defects reported from a live phone session (screenshots + screen recording).

### R52 — Player ID and Server ID must share one line (all games)

**File:** `client/src/styles/zurs-checkout.css`

**Root cause:** the round-9 rule `.identity-fields--pair > label:first-child { flex: 1 1 100%; }`
gave the first field the entire row, so the second field (`margin-left: auto`) was
pushed onto a second line and right-aligned. That was the round-9 spec, but it
wastes a whole row.

**Fix:** the pair is now `flex-wrap: nowrap` with the primary field on
`flex: 1 1 auto` and every following field pinned to a short fixed basis
(`7.25rem`, dropping to `5.9rem` under 360 px, and `5.5rem` for a rare third
field). Labels get `text-overflow: ellipsis` so "Server ID" never wraps.
This is layout-only and applies to every game that declares more than one
required field — no per-game special-casing.

### R53 — the payment method is chosen ONCE and remembered

**Files:** `client/src/contexts/SelectedProductContext.tsx`, `client/src/pages/GameTopup.tsx`

**Root cause (two independent resets):**

1. `SelectedProductContext.setSelectedProduct()` contained
   `selectedPaymentMethodId: product ? current.selectedPaymentMethodId : null`.
   Any call that cleared the package — deselecting, switching package, or the
   `[gameId]` effect — also silently discarded the payment method.
2. `GameTopup.tsx` `useEffect(..., [gameId])` called `setSelectedPaymentMethodId(null)`
   outright.

The buyer therefore had to scroll back up to the method picker repeatedly.

**Fix:**

- `setSelectedProduct` now always carries `current.selectedPaymentMethodId` forward.
- The `[gameId]` effect no longer touches the payment method. It still clears the
  selected package, which is correct. `setSelectedPaymentMethodId(null)` now
  appears exactly ONCE in `GameTopup.tsx` (the admin-preview toggle).
- The method is additionally persisted to `localStorage` under
  `zurs.checkout.method.v1` and rehydrated on mount, so it survives a reload and
  carries across to the next purchase.
- `clearSelectedProduct()` keeps its literal reset line (a source-level test
  asserts it) but re-seeds the remembered preference immediately afterwards, so
  finishing an order does not wipe the preference.
- `PaymentMethodGate`'s validity guard is unchanged: a stored method that no
  longer exists server-side is still cleared.

**Test compatibility:** `client/src/contexts/SelectedProductContext.test.ts`
asserts seven exact source substrings. All seven are preserved verbatim and were
re-verified by `grep -cF` after the edit.

### R54 — the BEFORE PAYMENT dialog rendered at the bottom of the page

**Files:** `client/src/components/RefundPolicyDialog.tsx`, `client/src/styles/zurs-checkout.css`

**Root cause:** the dialog was mounted inside the storefront shell, and
`client/src/index.css` line 104 declares

```css
.zurs-dotted-shell > :not(.zurs-particle-field) { position: relative; z-index: 1; }
```

That selector (specificity 0-2-0) out-specifies `.refund-dialog { position: fixed;
z-index: 320 }` (0-1-0). The modal was therefore forced to `position: relative;
z-index: 1` and laid out in normal flow beneath the footer, under the action bar,
where buyers never saw it. Nothing was wrong with the component logic — it was a
pure CSS-cascade defect.

**Fix:**

- The dialog is now rendered through `createPortal(..., document.body)`, which
  moves it out of `.zurs-dotted-shell` entirely so the descendant selector can
  never match it again. `position`/`inset`/`z-index` also carry `!important` as
  defence in depth.
- While the dialog is open the component adds `refund-dialog-open` to `<body>`;
  the bottom action bar and the mobile tab bar animate away
  (`zc-bar-dismiss`) and become non-interactive. The panel simultaneously rises
  from the bar's position (`zc-modal-rise`, `transform-origin: 50% 100%`), so the
  bar visibly *becomes* the BEFORE PAYMENT step instead of a second card
  appearing below it.
- Panel children fade up on a 50 ms stagger; the warning mark pulses.
- Body scroll lock and the Escape-to-decline handler are retained, and the new
  body class is removed in the effect cleanup.
- All new motion is disabled under `prefers-reduced-motion: reduce`.

**New keyframes:** `zc-modal-rise`, `zc-stagger-up`, `zc-mark-pulse`, `zc-bar-dismiss`.

### Verification performed

- Brace balance even on all four changed files (`38/38`, `24/24`, `417/417`, CSS `109/109`).
- All seven test-guarded substrings in `SelectedProductContext.tsx` present exactly once.
- `setSelectedPaymentMethodId(null)` count in `GameTopup.tsx`: 1 (admin toggle only).
- No test file references `refund-dialog`, `identity-fields--pair`, or `RefundPolicyDialog`.
- Type check clean; the residual `TS2875`/`TS7006` lines are pre-existing
  `--noResolve` sandbox artifacts (the same 7 appear in untouched files).

**Still not runnable in the sandbox:** `pnpm check`, `pnpm test`, `pnpm build`
(no `node_modules`, no network). Delegated to the deploy step.


### Round 10b — Roblox Robux enabled in Admin but invisible on the storefront

**File:** `server/providerCatalog.ts`

**Symptom:** the owner enabled Roblox Robux in Admin, the row showed the green
"showing in store" state, the FZR sync reported it — but the storefront never
listed it. Telegram Stars and Telegram Premium, enabled the same way, worked.

**Root cause:** `WANTED_PROVIDER_GAME_PATTERNS` is an id-level allowlist, and
`publicProviderGameIds()` re-filters the owner's approved ids through it:

```ts
const approvedIds = availability.activeGameIds?.length ? availability.activeGameIds : initialApprovedPublicGameIds;
return new Set(approvedIds.filter((id) => isWantedProviderGameId(id) && !availability.hiddenGameIds.includes(id)));
```

Round 9 added the whole Roblox layer — catalog fetch, manual-service ordering,
identity field, artwork, margin env var — but never added a Roblox pattern to
that list. `isWantedProviderGameId("roblox_robux")` returned **false**, so the id
the owner had just approved was deleted from the public set again, one line later.
Every downstream list gate (`cachedPublicProviderGames`, the availability list,
the SMM-adjacent list) then rejected it too. Telegram was immune only because
round 8c had added `/telegram/i` and `/tg/i` patterns for exactly this reason —
the comment block above the list documents the trap verbatim.

The game-detail route was never affected: `fetchProviderGameDetails` short-circuits
on `isBuiltInProviderGameId(gameId)` before reaching the allowlist gate, which is
why a direct link to the Roblox page would have worked while the listing did not.

**Fix (two parts):**

1. Added `/(?:^|[_\s(])(?:roblox|robux)/i` to `WANTED_PROVIDER_GAME_PATTERNS`.
   Verified: `isWantedProviderGameId("roblox_robux")` now returns `true`.
2. Hardened the two persisted-catalog gates so **any** built-in service survives
   them, not just Telegram. `isTelegramProviderProduct(...)` became
   `(isBuiltInProviderGameId(providerId) || isTelegramProviderProduct(...))` in
   both the "is wanted" and the "is active" clauses (4 occurrences across 2 lines).
   This matters because Roblox and Telegram exist **only** in the persisted catalog
   — they are never present in the `/topups` payload — so these gates are their
   primary path to the storefront, not just an outage fallback. The
   `hiddenGameIds` check is untouched, so hiding a service in Admin still works.

**Guard against regression:** never add a built-in service (a provider family that
is synthesised locally rather than read from `/topups`) without adding a matching
pattern to `WANTED_PROVIDER_GAME_PATTERNS`. Enabling it in Admin is not sufficient.

**Verification:** brace balance 639/639; zero `TS1xxx` syntax errors; no compressed-url
artifacts; the allowlist predicate simulated directly against `roblox_robux`.
Raw parenthesis counting is not a valid check on this file — 10 regex literals
contain `[_\s(]` or `[_\s)]` character classes, which skew the count by design.
