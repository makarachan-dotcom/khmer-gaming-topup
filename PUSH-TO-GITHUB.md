# Push this release to GitHub

Everything is already applied in this folder. You only need to commit and push.

---

## Option A — do it yourself (fastest, recommended)

```bash
cd khmer-gaming-topup-main

git checkout -b fix/ratelimit-regression-and-seo

# 1. Security regression
git add server/rateLimit.ts server/rateLimit.test.ts server/app.ts \
        server/paymentLinkRoutes.ts server/routers.ts .env.example
git commit -m "fix(security): restore rate limiting on pay key, auth and tRPC endpoints"

# 2. SEO metadata
git add client/index.html client/src/lib/seo.ts client/src/pages
git commit -m "feat(seo): full meta tags, JSON-LD and per-route SEO metadata"

# 3. Crawl files + headers
git add client/public/sitemap.xml client/public/robots.txt \
        client/public/og-cover.png client/public/logo-512.png \
        client/public/apple-touch-icon.png vercel.json
git commit -m "feat(seo): real sitemap.xml, robots.txt and vercel security headers"

# 4. Build hardening
git add vite.config.ts docs/security-seo-release.md PUSH-TO-GITHUB.md
git commit -m "perf(build): disable sourcemaps so admin procedures stay out of the public bundle"

git push -u origin fix/ratelimit-regression-and-seo
```

Then open a PR on GitHub and merge. Vercel will build the preview
automatically — **but read `docs/security-seo-release.md` §1 first**, because
the two Upstash environment variables must exist before the rate limiter is
fully effective.

---

## Option B — prompt for Manus AI

Paste everything below the line into Manus.

---

You have the updated project folder `khmer-gaming-topup-main`. All code changes
are already applied. Do **not** rewrite, re-generate, or "improve" any of the
changed files. Your only job is to commit and push them.

**Repository:** `<<<GITHUB_REPO_URL>>>`
**Branch to create:** `fix/ratelimit-regression-and-seo`

### Hard rules

1. Do **not** run `pnpm install` with a modified `package.json`. **No
   dependencies were added on purpose** — `pnpm-lock.yaml` is committed and
   Vercel installs with a frozen lockfile, so adding `@upstash/ratelimit`,
   `@upstash/redis`, or `react-helmet-async` would break the build. The Upstash
   client is a plain `fetch` call against the REST API in `server/rateLimit.ts`,
   and the SEO hook is hand-written in `client/src/lib/seo.ts`.
2. Do **not** touch `client/src/components/StorefrontLayout.tsx`. The mobile
   Tabbar is already live and is guarded by
   `client/src/components/StorefrontLayout.test.ts`.
3. Do **not** add a `Content-Security-Policy` header. See
   `docs/security-seo-release.md` §3 for why, and for the report-only version to
   trial later.
4. Do **not** change payment auth logic, Zod schemas, or the KHQR / Bakong flow.
5. Keep `client/public/sitemap.xml` and `client/public/robots.txt` where they
   are. That is Vite's `publicDir`; moving them breaks the static serving.

### Steps

1. `git checkout -b fix/ratelimit-regression-and-seo`
2. Run `pnpm check` (`tsc --noEmit`) and `pnpm vitest run server/rateLimit.test.ts`.
   Report any failure instead of "fixing" it by deleting a test.
3. Commit in these four commits, in this order:
   - `fix(security): restore rate limiting on pay key, auth and tRPC endpoints`
     — `server/rateLimit.ts`, `server/rateLimit.test.ts`, `server/app.ts`,
     `server/paymentLinkRoutes.ts`, `server/routers.ts`, `.env.example`
   - `feat(seo): full meta tags, JSON-LD and per-route SEO metadata`
     — `client/index.html`, `client/src/lib/seo.ts`, `client/src/pages/*`
   - `feat(seo): real sitemap.xml, robots.txt and vercel security headers`
     — `client/public/sitemap.xml`, `client/public/robots.txt`,
     `client/public/og-cover.png`, `client/public/logo-512.png`,
     `client/public/apple-touch-icon.png`, `vercel.json`
   - `perf(build): disable sourcemaps so admin procedures stay out of the public bundle`
     — `vite.config.ts`, `docs/security-seo-release.md`, `PUSH-TO-GITHUB.md`
4. `git push -u origin fix/ratelimit-regression-and-seo`
5. Open a PR titled **"Restore rate limiting + full SEO pass"** whose body
   contains the verification commands from `docs/security-seo-release.md` §2
   and §5.
6. Reply with the branch name, the four commit SHAs, and the PR URL. Nothing
   else.

### After the PR is merged (human, not Manus)

Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Vercel for both
Production and Preview, then redeploy. Until then the limiter falls back to a
per-instance in-memory counter and logs a warning.
