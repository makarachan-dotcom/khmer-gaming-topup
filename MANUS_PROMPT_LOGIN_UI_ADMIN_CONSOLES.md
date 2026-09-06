# MANUS PROMPT — Login UI polish + Admin support console + Device ban console

> Paste everything below the line into Manus AI. It applies the changes in this
> archive to the repository and pushes them to `main`.

---

## Role

You are working in the `khmer-gaming-topup` repository (ZURS — zurs.me). Apply
the change set described here, verify it builds, commit it, and **push to the
`main` branch**. Do not open a pull request; push straight to `main`.

## Goal

Three things the owner asked for:

1. **`/login`** — the card must look clean and smooth, with **nothing
   overlapping**.
2. **`/admin/support-chat`** — a real inbox where an admin reads and answers
   customer messages quickly.
3. **`/admin/login-bans`** — list **every device** that has touched the login
   flow, with **Ban** and **Unban** buttons on each row, full device details,
   and instant effect.
4. **`chanmakara672@gmail.com` can never be banned by the system**, under any
   code path.

## Files in this change set

### New files

| Path | What it is |
| --- | --- |
| `client/src/pages/AdminSupportChat.tsx` | Support inbox console (`/admin/support-chat`) |
| `client/src/styles/zurs-login-refined.css` | Layout pass over the login card |
| `MANUS_PROMPT_LOGIN_UI_ADMIN_CONSOLES.md` | This file |

### Modified files

| Path | Change |
| --- | --- |
| `client/src/pages/AdminLoginBans.tsx` | Rewritten: every device, ban + unban per row, live detail |
| `client/src/App.tsx` | Lazy import + route for `/admin/support-chat` |
| `client/src/main.tsx` | Imports `zurs-login-refined.css` after `zurs-login.css` |
| `server/loginAbuseGuard.ts` | Device registry, protected-actor immunity, manual ban/unban |
| `server/loginAbuseRoutes.ts` | `GET /api/admin/login-devices`, ban + unban endpoints |
| `server/supportChatRoutes.ts` | Admin inbox, thread, reply, typing, seen, close endpoints |
| `server/supportChat.ts` | `adminSeenAt` on a session + `markAdminSeen()` |
| `server/rateLimit.ts` | `adminSupportPoll` and `adminSupportSend` buckets |

Take the file contents from the archive that accompanies this prompt. Do not
re-derive them.

---

## 1. Owner immunity (most important)

`server/loginAbuseGuard.ts` now has one choke point:

```ts
export const protectedLoginEmails: readonly string[] = ["chanmakara672@gmail.com"];
```

plus anything in the optional `LOGIN_BAN_EXEMPT_EMAILS` env var (comma
separated). Rules that must survive review:

- `applyBlock()` starts with `if (await isProtectedHash(scope, hash)) return ...` —
  so **no** caller can write a block for a protected actor: not failed attempts,
  not the cascade, not a manual ban from the console.
- `evaluateLoginAttempt()` marks the actor protected and returns an allow
  decision before it ever reads block state.
- `registerLoginFailure()` returns early for a protected actor, so strikes never
  accumulate.
- `clearLoginFailures()` re-marks the owner on every successful sign-in, which
  keeps the marker alive on new devices and new addresses.
- `banLoginActor()` refuses with `reason: "protected"`; the route answers
  `409 { code: "PROTECTED_ACTOR" }` and the console shows a notice instead of
  a failed action.

Markers live at `la:trusted:<scope>:<hash>`. Device and identity markers last 90
days; the **IP** marker deliberately expires after `loginBlockSeconds` (24h), so
a shared carrier address the owner used once does not become permanently
unbannable.

## 2. Device registry

Every login attempt records a sighting at `la:dev:<deviceHash>`, indexed in the
`la:devices` sorted set (300 most recent, 30-day TTL). A row carries: label, IP,
masked email, first/last seen, sighting count, last intent, verified flag,
protected flag, and the live ban state.

New endpoints in `server/loginAbuseRoutes.ts` (all admin-only, all return
`403 { code: "FORBIDDEN" }` otherwise):

```
GET  /api/admin/login-devices        -> { durable, threshold, protectedEmails, devices, bans }
POST /api/admin/login-bans/ban       { deviceHash? | ip? | email?, hours? } -> { banned, scopes, expiresAt, ...state }
POST /api/admin/login-bans/unban     { deviceHash? | id? }                  -> { lifted, ...state }
```

The existing `GET /api/admin/login-bans` and `POST /api/admin/login-bans/lift`
keep working; nothing that already calls them changes.

Admin routes stay exempt from `ipBanGuard` on purpose: an operator caught in a
cascade must still be able to reach the page that undoes it.

## 3. Support console endpoints

In `server/supportChatRoutes.ts`:

```
GET  /api/admin/support/chats          -> { chats, waiting, unread, at }   sorted waiting -> unread -> recency
GET  /api/admin/support/chats/:id?seen=1 -> { chat }                       marks the thread read
POST /api/admin/support/reply          { sessionId, text } -> { chat }
POST /api/admin/support/typing         { sessionId, seconds? }
POST /api/admin/support/seen           { sessionId }
POST /api/admin/support/close          { sessionId }
```

Rate limits use the new generous buckets (`adminSupportPoll` 600/5min,
`adminSupportSend` 300/5min) instead of the customer buckets, which would
throttle a fast operator.

## 4. Login UI

`client/src/styles/zurs-login-refined.css` is **override only** — no markup
changed. It fixes the actual causes of the overlap:

- `zurs-fixes.css` (rose/orange) and `zurs-login.css` (indigo) both style the
  same elements. The sheet settles on one palette.
- `.zl-device__badge` sat at `right: -0.45rem; bottom: -0.45rem`, outside its
  own box. It is pulled back in.
- `.zl-steps__dot.is-active` was declared twice: `width: 2.1rem` in one rule,
  `transform: scale(1.35)` + a 4px glow ring in another. With `0.4rem` of gap
  the glow landed on the next dot. Now there is one rule.
- `.zl-otp` used `repeat(6, 1fr)`; a `1fr` track will not shrink below the
  input's intrinsic width, so the sixth box pushed past the card on a 320px
  screen. Now `repeat(6, minmax(0, 1fr))`.
- The hero is a grid with one gap, so mascot, lock chip and step dots each own
  their row and cannot collide.
- Touch targets are >= 44px, safe-area insets are respected, and every animation
  is transform/opacity only, disabled under `prefers-reduced-motion`.

`main.tsx` must import it **after** `zurs-login.css` and **before**
`zurs-support.css` (that one has to stay last).

---

## Verify before pushing

```bash
pnpm install
pnpm exec tsc --noEmit          # or: pnpm typecheck
pnpm exec vitest run            # server/loginAbuseGuard.test.ts, loginBanAdmin.test.ts must pass
pnpm build
```

Then check by hand:

- `/login` on a 320px viewport: no element overlaps another, all six OTP boxes
  fit, the lock badge is inside its square.
- `/admin/login-bans`: devices are listed, **Ban** and **Unban** both work and
  the row flips immediately.
- A row for `chanmakara672@gmail.com` shows a **ការពារ (Admin)** badge and a
  disabled Ban button; forcing the request returns `409 PROTECTED_ACTOR`.
- `/admin/support-chat`: a waiting chat appears within ~5s, Enter sends, the
  reply appears instantly and the customer sees it.

## Commit and push

```bash
git checkout main
git pull --rebase origin main
git add -A
git commit -m "feat(admin): device ban console + support inbox, owner ban immunity, login layout fixes

- /admin/login-bans lists every known login device with ban + unban per row
- /admin/support-chat: admin inbox with instant replies, quick replies, typing
- guard: chanmakara672@gmail.com can never be blocked by any code path
- login: settle the zurs-fixes/zurs-login style conflict that caused overlap"
git push origin main
```

If `main` is protected and a direct push is refused, say so and stop — do not
invent a workaround branch.

## Do not

- Do not remove the owner immunity or make it configurable to empty.
- Do not put the admin routes behind `ipBanGuard`.
- Do not edit `zurs-fixes.css` or `zurs-login.css` to fix the login layout; the
  override sheet is deliberate and keeps the diff reviewable.
- Do not change the customer-facing support chat behaviour or its rate limits.

---

## Follow-up fix: "admin can't see anything" on /admin/support-chat

Reported against the live site. Three separate causes, all addressed below.

### 1. The route does not exist in the deployed build (main cause)

`DashboardLayout.tsx` has linked to `/admin/support-chat` for a while, but
`App.tsx` had no matching route, so wouter fell through to `NotFound`. The
sidebar link led to an empty page for every admin, every time. Fixed by the
`App.tsx` route + `AdminSupportChat.tsx` page in this change set. **It only
takes effect once this is pushed and Vercel redeploys.**

### 2. The inbox could only ever list chats that were open at that second

`store.writeSession` deletes the `sc:user:<userId>` pointer when a chat closes
(that is what frees the customer's daily allowance), and that pointer was the
only index of conversations. `listOpenSessions()` therefore returned nothing
whenever no chat was live, so an operator opening the console on a quiet
afternoon saw an empty screen.

- `server/supportChat.ts`: added `supportLogTtlSeconds` (7 days), a `sc:log:<id>`
  index written for every session and **not** retired on close, `readLoggedIds`,
  `listRecentSessions()`, and `supportStoreReady()`. Closed sessions are now
  rewritten with the longer TTL so their transcript stays readable.
  The index write is wrapped in its own try/catch: it must never be the reason a
  customer cannot open a chat.
- `server/supportChatRoutes.ts`: the inbox uses `listRecentSessions()` and sorts
  waiting -> active -> closed, then by unread, then by recency.

### 3. Failure states were indistinguishable from an empty inbox

- `server/supportChatRoutes.ts`: added `sendNotAdmin()`, which answers 401 when
  there is no session and 403 when there is one, and echoes `signedInAs` so the
  console can name the account it refused. Added `GET /api/admin/support/health`
  as a deploy probe: 404 means the running build predates the admin API, 403
  means the build is current and the account is not an admin. The inbox response
  now also carries `storeReady`, `open`, and `viewer`.
- `client/src/pages/AdminSupportChat.tsx`: **removed the client-side role gate.**
  It checked `useAuth().user.role`, so a legitimate admin whose session payload
  omitted `role` got a refusal card. The server is the only place that can decide
  this, and it already does. The page now renders a specific, actionable card for
  401 / 403 / 404 / 429 / 5xx / offline, warns when `storeReady` is false, backs
  polling off to 30s while refused, and lists closed chats behind a filter.

### Verify this part specifically

```bash
pnpm exec tsc --noEmit
pnpm exec vitest run
pnpm build
```

After deploying, signed in as the owner:

1. `GET /api/admin/support/health` returns `{ ok: true, storeReady: true }`.
   A 404 means the deploy did not pick up the server change.
2. `/admin/support-chat` renders the console, not a blank page or NotFound.
3. Open a chat from a customer account, then confirm it appears in the inbox
   within ~5s and that a reply is delivered.
4. Close that chat and confirm it is still listed under the "បិទរួច" filter.
5. Sign in as a non-admin and confirm the page names the account it refused
   instead of showing an empty screen.
