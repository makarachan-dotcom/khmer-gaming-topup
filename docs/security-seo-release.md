# Security + SEO release — manual checklist

Everything in this document is work that **cannot** be done from the codebase.
The code changes are already committed; these are the dashboard / DNS / Google
steps that make them effective.

---

## 1. Upstash Redis (REQUIRED — without this the rate limiter is weakened)

`server/rateLimit.ts` uses Upstash over its REST API. On Vercel every request
can land on a fresh serverless instance, so an in-process `Map` counter (what
the old code used) resets constantly and cannot stop a brute-force attempt.

1. Sign up at <https://upstash.com> (free tier is enough).
2. **Create Database** → type `Redis` → region **`ap-southeast-1` (Singapore)** —
   the lowest latency to Cambodia.
3. Open the database → **REST API** tab → copy `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`.
4. Vercel → project → **Settings → Environment Variables**, add both:

   | Name | Value | Environments |
   | --- | --- | --- |
   | `UPSTASH_REDIS_REST_URL` | `https://xxxx.upstash.io` | Production, Preview |
   | `UPSTASH_REDIS_REST_TOKEN` | `AX...` | Production, Preview |

5. **Redeploy.** Environment variables are only injected at build/boot time.

### What happens if you skip this

`rateLimitBackendConfigured` returns `false` and every bucket falls back to a
per-instance in-memory counter with a `console.warn`. The endpoint still works,
but the limit is per-instance instead of global. Do not ship to production like
this.

---

## 2. Rate-limit behaviour that is now live

| Endpoint | Limit | Key | Redis down |
| --- | --- | --- | --- |
| `POST /api/pay/security/check/key` | 5 / 5 min | IP | **fail-closed** (429) |
| `GET /api/pay/:token` (invalid token) | 10 / hour | IP | **fail-closed** (429) |
| `/api/auth/*` | 10 / min | IP | **fail-closed** (429) |
| `/api/trpc/*` (public) | 60 / min | IP | **fail-open** (allow) |
| `orders.createTopup` | 10 / hour | user id | **fail-closed** (429) |

The fail policy is deliberate: money and credential endpoints must degrade to
"deny" so a Redis outage cannot be used as a bypass, while general browsing
must degrade to "allow" so a Redis outage does not take the storefront down.

**429 response shape** (no limiter internals are exposed):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 214
Cache-Control: no-store

{ "code": "RATE_LIMITED", "retryAfter": 214 }
```

### Verify after deploying

```bash
# Expect: 401 401 401 401 401 429 429 429 429 429
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code} " \
    -X POST https://www.zurs.me/api/pay/security/check/key \
    -H 'content-type: application/json' \
    -d '{"orderId":"wrong"}'
done; echo

# Expect: Retry-After header present
curl -si -X POST https://www.zurs.me/api/pay/security/check/key \
  -H 'content-type: application/json' -d '{"orderId":"wrong"}' | grep -i retry-after
```

Run the unit tests locally with `pnpm vitest run server/rateLimit.test.ts`.

---

## 3. Content-Security-Policy — read before adding one

`vercel.json` now sets `X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy` and
`Cross-Origin-Opener-Policy`.

A CSP was **deliberately not added**, because this app loads from several
origins and a wrong CSP is an instant white screen:

- `fonts.googleapis.com`, `fonts.gstatic.com` (Khmer webfonts)
- `files.manuscdn.com` (banners, artwork)
- `reseller.fazercards.com` (provider)
- Appwrite (auth), Ably (Live Spin realtime)
- `%VITE_ANALYTICS_ENDPOINT%/umami`

When you want one, ship it in **report-only** mode first for about a week:

```json
{
  "key": "Content-Security-Policy-Report-Only",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://*.manuscdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https://*.appwrite.io https://*.ably.io wss://*.ably.io https://reseller.fazercards.com https://files.manuscdn.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self'"
}
```

Read the violation reports, fix the origins, and only then rename the header to
`Content-Security-Policy`.

> Note: the original brief said CSP/HSTS/XFO/nosniff were already working. A
> repo-wide grep found none of them in the source, so they were either set in
> the Vercel dashboard or not actually live. Check
> `curl -sI https://www.zurs.me/ | grep -i -E 'content-security|strict-transport|x-frame'`
> and remove whichever copy is duplicated.

---

## 4. Google Search Console

1. <https://search.google.com/search-console> → **Add property** → *Domain* →
   `zurs.me` (covers apex + www + all subdomains).
2. Add the TXT record it gives you at your DNS provider, then verify.
3. **Sitemaps** → submit `sitemap.xml`.
4. **URL Inspection** → paste `https://www.zurs.me/` → *Request indexing*.
   Repeat for `/topup/game-mlbb` and `/live-spin`.
5. Check **Page indexing** after ~3 days for "Discovered – currently not
   indexed" and "Duplicate without user-selected canonical".

### Canonical host — do this or you split your ranking

Everything (canonical tag, sitemap, robots, JSON-LD) points at **`www.zurs.me`**.
Make sure the apex 301-redirects there:

- Vercel → **Settings → Domains** → add both `zurs.me` and `www.zurs.me`
- Set `www.zurs.me` as **primary**, and `zurs.me` → *Redirect to* `www.zurs.me`
  with a **308/301**, not a proxy.

Verify: `curl -sI https://zurs.me/ | head -3` should show `301`/`308` +
`location: https://www.zurs.me/`.

---

## 5. Verify the SEO files actually serve

```bash
curl -sI https://www.zurs.me/sitemap.xml   # 200 + application/xml (NOT text/html)
curl -sI https://www.zurs.me/robots.txt    # 200 + text/plain
curl -sI https://www.zurs.me/og-cover.png  # 200 + image/png
curl -s  https://www.zurs.me/ | grep -c '<h1'   # exactly 1
```

If `sitemap.xml` returns HTML, the file was not copied into `dist/public` —
confirm it is at `client/public/sitemap.xml` (Vite's `publicDir`).

---

## 6. Bundle size (Part C)

Admin routes were already `React.lazy` + `Suspense` in `client/src/App.tsx`, and
`vite.config.ts` splits `client/src/pages/Admin*` into an `admin` chunk. This
release also disables source maps so the admin procedure names cannot be
recovered from the public bundle.

After `pnpm build`, confirm the admin surface is gone from the entry chunk:

```bash
ls -la dist/public/assets/index-*.js                       # target < 400 KB
grep -l "rotateProviderCredential" dist/public/assets/*.js  # should match admin-*.js only
```

If `index-*.js` still matches, something in a shared module imports an admin
page directly — find it with
`grep -rn "pages/Admin" client/src --include=*.tsx | grep -v "lazy("`.

---

## 7. Off-page (this is what actually beats the copycat stores)

The misspellings *zeus store* / *zues store* belong to other businesses. You
cannot outrank them by putting their names in your schema — that risks a
misleading-markup penalty and can strengthen their brand entity instead. What
works is making **Zurs** an unambiguous entity that Google auto-corrects to:

- [ ] **Google Business Profile** — name exactly `Zurs Store`, website
      `https://www.zurs.me/`, category *Computer/Video game store*.
- [ ] **Facebook page** — Page name `Zurs Store`, website field filled, then add
      the real page URL to `sameAs` in `client/index.html`.
- [ ] **Telegram channel** — public `@` handle, pinned post linking `zurs.me`.
- [ ] **TikTok** — bio link to `zurs.me`.
- [ ] Post in Khmer gaming groups / Reddit / MLBB communities using the exact
      string **"Zurs Store (zurs.me)"** so the brand + domain co-occur.
- [ ] Ask 10–20 real customers for Google reviews that mention *Zurs*.
- [ ] Run a small Google Ads brand campaign on `zurs`, `zurs store`, `zeus store
      topup`, `zues store` for 2–4 weeks. Paid clicks on the misspelling teach
      Google the association far faster than on-page markup.

Once `sameAs` has 2+ verified profiles, add them to the Organization JSON-LD
block in `client/index.html`.

---

## 8. Placeholders still to fill in

| Where | Placeholder | Needs |
| --- | --- | --- |
| `client/index.html` → Organization `sameAs` | only Facebook is listed | Telegram + TikTok URLs |
| `PUSH-TO-GITHUB.md` | `<<<GITHUB_REPO_URL>>>` | your repo URL |
