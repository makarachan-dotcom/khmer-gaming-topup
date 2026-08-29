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
