# Manus prompt — ZURS login security, mascot & site-wide ban (round 2)

Copy everything below the line into Manus AI. It is written **to Manus**, and it
instructs Manus to commit and push to `main` itself.

---

You are working in the `khmer-gaming-topup` repository (the ZURS storefront:
React 19 + Vite 7 + Express 4 + tRPC 11 + Drizzle, deployed on Vercel).

I am giving you a set of finished files. **Apply them exactly as provided, then
commit and push them to the `main` branch yourself.** Do not open a pull
request, do not create a side branch, and do not ask me to push.

## What this change does

It hardens `zurs.me/login` and gives the login screen a character. Nine things:

1. **Report the IP** on every wrong one-time code.
2. **Ban after 5 wrong codes**, for 24 hours.
3. **A banned person is blocked on a different device too** — switching phone,
   browser, email or network does not reset the 24 hours.
4. **Rate limits** on every `/login` endpoint.
5. **A quieter, modern `/login`** with smooth animations.
6. **A mascot** that watches the code being typed, looks up at you when the code
   is wrong, and sticks its tongue out while you are banned.
7. **A ban blocks the whole site**, not just sign-in; **an admin can lift it**
   from a new admin page that shows the **phone model and IP address**.
8. **While banned, the account page removes both the "ចូលគណនី" button and the
   "Connect with Email" button** and shows the remaining time instead.
9. **"Connect with Gmail" is renamed "Connect with Email" and now goes to
   `/login`** (our own email code flow), not the Google OAuth redirect.

Also: the **name entry step is only shown to genuinely new users**. A returning
member keeps the name they already saved, and it is never overwritten.

## Files

### New

| File | Purpose |
| --- | --- |
| `server/ipBanGuard.ts` | Express middleware that refuses the whole API for a banned actor |
| `server/deviceInsight.ts` | Turns User-Agent + Client Hints into "Samsung Galaxy A15 · Android 14 · Chrome" |
| `client/src/components/ZursLoginMascot.tsx` | The animated SVG mascot |
| `client/src/pages/AdminLoginBans.tsx` | Admin page: list active bans, unban with one click |
| `server/deviceInsight.test.ts` | Device-label parsing tests |
| `server/loginBanAdmin.test.ts` | Ban listing / unban / read-only-inspection tests |

### Modified

| File | Change |
| --- | --- |
| `server/rateLimit.ts` | Five login buckets + `redisPipeline` helper |
| `server/loginAbuseGuard.ts` | Strike/ban engine, ban index, `inspectActorBlock`, `listActiveLoginBans`, `liftLoginBan` |
| `server/loginAbuseRoutes.ts` | Guard endpoints + `GET/POST /api/admin/login-bans*` |
| `server/appwriteAuth.ts` | Enforcing gate; returns `isNewUser`/`needsName`/`savedName`; never overwrites a saved name |
| `server/app.ts` | Mounts `enforceIpBan` before all routes |
| `server/loginAbuseGuard.test.ts` | Policy tests |
| `client/src/lib/loginGuard.ts` | Device id + Client-Hints headers, `checkAccessBan` |
| `client/src/lib/appwriteAuth.ts` | Session response now carries the new-user flags |
| `client/src/pages/AppwriteLogin.tsx` | Mascot, motion, name step gated to new users |
| `client/src/pages/Account.tsx` | Both buttons → `/login`; both removed while banned |
| `client/src/styles/zurs-login.css` | Mascot styles + the visible animation layer |
| `client/src/App.tsx` | Route `/admin/login-bans` |
| `client/src/components/DashboardLayout.tsx` | Sidebar entry for the new admin page |
| `client/src/main.tsx` | Imports `zurs-login.css` last |

## How the ban works (please do not "simplify" this)

The design assumes the attacker controls the browser.

- Appwrite verifies the code **in the browser**, so our server never sees a
  wrong code. Verification is therefore **pre-charged**: the client calls
  `POST /api/auth/login/verify-attempt` (which spends the strike) *before*
  talking to Appwrite, and `POST /api/auth/login/verify-result` refunds the
  strike only on success. A client that "forgets" to report a failure loses a
  strike anyway. That direction of failure is deliberate.
- The only route that mints a ZURS cookie or creates a user row is
  `POST /api/auth/appwrite/session`, and it re-runs the guard. So "just sign up
  again from another device" cannot work.
- Strikes and bans are keyed on three scopes — **IP**, **device**, **identity
  (email)** — and a ban on any one of them cascades to the others that have been
  seen together, bounded to 50 links so one shared carrier NAT cannot cause
  thousands of writes.
- Keys are HMAC-SHA256 of the raw value, so Redis never stores a bare address.
- `server/ipBanGuard.ts` then applies the ban to **every** API request, which is
  what makes the whole site unusable while banned.

### Exemptions — keep all four

`enforceIpBan` deliberately never blocks:

1. `/api/auth/login/guard` — the ban screen must read its own countdown.
2. `/api/admin/*` — these check the admin role themselves; blocking them would
   make a ban impossible to lift.
3. `/api/webhooks/*` — Bakong and the KHQR worker. Blocking a bank callback
   because a customer on the same carrier NAT misbehaved loses real money.
4. `/api/scheduled/*` — cron.

Plus anything listed in the `LOGIN_BAN_IP_ALLOWLIST` environment variable.

It also **fails open**: if Redis is unreachable the request is allowed through.
An outage must not take the storefront offline.

## Environment

Already set, still required:

```
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

Optional, add if you want them:

```
LOGIN_GUARD_SALT=<random 32+ chars>   # falls back to ZURS_SESSION_SECRET
LOGIN_BAN_IP_ALLOWLIST=1.2.3.4,5.6.7.8  # never ban these addresses
```

**Without Upstash the guard still works but falls back to per-instance memory,
which on Vercel means a ban is not shared between serverless instances.** The
admin page shows a warning banner when that is the case. Do not ship to
production without Upstash configured.

No database migration is required. Nothing was added to `drizzle/schema.ts`.

## What I need you to do

1. Apply every file exactly as given.
2. Run:
   ```bash
   pnpm install
   pnpm check
   pnpm test
   pnpm build
   ```
3. Fix only genuine breakages you find. Do not reduce the thresholds, remove the
   exemptions, remove the fail-open behaviour, or delete the reduced-motion CSS
   block.
4. Commit and push to `main`:
   ```bash
   git add -A
   git commit -m "feat(login): site-wide 24h ban with admin unban, login mascot, email sign-in redirect"
   git push origin main
   ```
5. Confirm the Vercel deployment succeeded, then verify on the live site:
   - `zurs.me/login` shows the mascot; it looks down at the boxes while a code
     is typed and looks up at you after a wrong code.
   - Five wrong codes produce the 24-hour lock screen with the tongue out.
   - While locked, the rest of the site returns `423` and
     `zurs.me/account` shows **neither** the "ចូលគណនី" button **nor** the
     "Connect with Email" button — only the countdown.
   - `zurs.me/admin/login-bans` lists the ban with the phone model and IP, and
     the unban button restores access immediately.
   - "Connect with Email" on the account page lands on `zurs.me/login`.

If anything conflicts with code that changed since I generated these files,
prefer the existing structure and re-apply the intent rather than reverting.

---

## Round 4 additions

Install the two animation packages first - they are imported by the support
chat UI:

    pnpm add liquid-gooey thinking-orbs

thinking-orbs is at 0.1.1 and ships its own TypeScript types.
client/src/types/vendor-animations.d.ts declares both modules so the project
type-checks before install; delete the thinking-orbs block there if it ever
conflicts with the real types.

Files changed in round 4:
- client/src/styles/zurs-support.css - support-sheet repair + banner beam
- client/src/pages/Home.tsx - single banner, carousel removed
- client/src/pages/GameTopup.tsx - live pricing
- client/src/pages/AppwriteLogin.tsx - name step gate
- server/db.ts - KHQR reuse must match the current amount

Run the checks, then commit and push to main yourself:

    pnpm check
    pnpm test
    pnpm build
    git add -A
    git commit -m "fix: support sheet glitch, single bare banner with running border, first-signup-only name step, live price/margin + KHQR amount"
    git push origin main
