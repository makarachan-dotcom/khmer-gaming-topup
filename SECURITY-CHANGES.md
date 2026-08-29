# Security changes only

UI, page text and SEO are untouched. The only visual difference is that the
SEO fallback block was removed from `client/index.html`, so `<div id="root">`
is empty again and the app renders exactly as before.

## Files changed

| File | Change |
|---|---|
| `server/rateLimit.ts` | **new** — durable rate limiter (Upstash Redis REST, zero new deps) |
| `server/rateLimit.test.ts` | **new** — vitest coverage + regression guards |
| `server/paymentLinkRoutes.ts` | pay-key + invalid-token limits now durable |
| `server/app.ts` | `trust proxy`, limiter mounted on `/api/auth` and `/api/trpc` |
| `server/routers.ts` | `orders.createTopup` limited per user |
| `vercel.json` | security headers + `no-store` on `/api` and `/checkout` |
| `vite.config.ts` | `sourcemap: false` |
| `client/index.html` | SEO fallback block removed |
| `.env.example` | **new** — the two Upstash variables |

## The bug that was fixed

The old limiter used an in-memory `Map`. On Vercel every request can hit a
fresh serverless instance, so the counter was almost always empty. That is why
40 requests to `POST /api/pay/security/check/key` returned `401` forty times
and never `429` — brute force was effectively unlimited. Counters now live in
Redis, shared across all instances.

## Limits

| Endpoint | Limit | Keyed by | If Redis is down |
|---|---|---|---|
| `POST /api/pay/security/check/key` | 5 / 5 min | IP | fail-closed (429) |
| `GET /api/pay/:token` (invalid) | 10 / hour | IP | fail-closed |
| `/api/auth/*` | 10 / min | IP | fail-closed |
| `/api/trpc/*` | 60 / min | IP | fail-open (allow) |
| `orders.createTopup` | 10 / hour | user id | fail-closed |

Blocked requests return `429` with a `Retry-After` header and
`{ "code": "RATE_LIMITED", "retryAfter": <seconds> }`.

The pay-key limiter runs **before** `resolveUser`, so an attacker is stopped
before touching the database.

## Setup (required)

1. Create a free Redis at <https://console.upstash.com> — region **Singapore
   (ap-southeast-1)**, closest to Cambodia.
2. Copy **UPSTASH_REDIS_REST_URL** and **UPSTASH_REDIS_REST_TOKEN** from the
   REST API panel.
3. Vercel → Project → Settings → Environment Variables. Add both to
   **Production and Preview**.
4. Redeploy.

Without these the limiter falls back to in-memory counting and logs a warning
on boot — it still works locally but is not durable on serverless.

## Verify after deploy

```bash
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST https://www.zurs.me/api/pay/security/check/key \
    -H 'content-type: application/json' -d '{"orderId":"wrong"}'
done; echo
# expect: 401 401 401 401 401 429 429 429 429 429

curl -sI https://www.zurs.me/ | grep -i 'x-frame-options\|strict-transport\|x-content-type'
```

Run locally before pushing:

```bash
pnpm check
pnpm vitest run server/rateLimit.test.ts
```

## Push to GitHub

```bash
git checkout -b fix/ratelimit-regression
git add server/rateLimit.ts server/rateLimit.test.ts server/paymentLinkRoutes.ts \
        server/app.ts server/routers.ts vercel.json vite.config.ts \
        client/index.html .env.example SECURITY-CHANGES.md
git commit -m "fix(security): durable rate limiting on pay key, auth and tRPC endpoints"
git push -u origin fix/ratelimit-regression
```

## Known pre-existing issue (not touched)

`client/index.html` points `og:image` at `https://www.zurs.me/og-cover.png`,
but no such file exists in `client/public/`, so link previews on Facebook and
Telegram show no image. Dropping a 1200x630 PNG at `client/public/og-cover.png`
fixes it. Not done here because it is not a security change.
