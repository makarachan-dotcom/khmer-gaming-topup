# Vercel Deployment Guide

This repository now contains a Vercel serverless entry point at `api/[...path].ts`, a shared Express application factory, and a `vercel.json` configuration. The project builds its Vite site into `dist/public` and preserves client-side routes without rewriting `/api/*` requests.

> **Important:** Vercel can deploy the application shell and portable API routes. The original managed-hosting OAuth and storage proxy integrations are intentionally not registered on Vercel. Customer authentication remains staged until you supply a user-owned Google Cloud OAuth client, and marketplace image uploads require your own object-storage integration.

| Setting in Vercel | Value |
|---|---|
| Framework Preset | `Vite` or `Other` |
| Root Directory | Repository root |
| Install Command | `pnpm install --frozen-lockfile` |
| Build Command | `pnpm build` |
| Output Directory | `dist/public` |
| Node.js version | `22.x` |

## Deployment steps

1. Push the latest project checkpoint to the connected GitHub repository, then open **Vercel → Add New → Project** and import that repository.
2. Keep the root directory at the repository root. Enter the table values above if Vercel does not auto-detect them.
3. Open **Project Settings → Environment Variables**. Add `DATABASE_URL` for an externally reachable MySQL or TiDB database and add a long random `JWT_SECRET`. Do not add Manus-only keys such as `BUILT_IN_FORGE_API_KEY`, `OAUTH_SERVER_URL`, or `VITE_APP_ID`.
4. Deploy the project. Vercel will execute `pnpm build`, serve `dist/public`, and route `/api/*` requests into `api/[...path].ts`.
5. Test the preview deployment at `/`, `/topup`, `/smm`, `/marketplace`, and `/api/auth/google/status`. The Google endpoint should report that it is staged, not successful.
6. After you create a Google Cloud **Web application** OAuth client, add `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` in Vercel. Register `https://YOUR-VERCEL-DOMAIN/api/auth/google/callback` as its authorized redirect URI, then complete the OAuth exchange implementation.

## Troubleshooting

| Vercel symptom | Resolution |
|---|---|
| `Output Directory "dist" does not exist` | Change it to `dist/public`; this project places Vite assets there. |
| Deep links show 404 | Confirm the committed `vercel.json` is present; it rewrites non-API routes to `index.html`. |
| API endpoint returns 404 | Confirm deployment includes `api/[...path].ts` and that the requested path starts with `/api/`. |
| Login or image upload is unavailable | This is expected until Google OAuth and external object storage are configured; the built-in managed-hosting integrations do not transfer to Vercel. |
| Database error | Use a publicly reachable MySQL/TiDB provider and set its complete connection string as `DATABASE_URL`. |

## References

Vercel documents Vite SPA rewrites and environment-variable handling in its [Vite guide](https://vercel.com/docs/frameworks/frontend/vite). Its [Express guide](https://vercel.com/docs/frameworks/backend/express) describes default-exported Express applications as a supported serverless function entry point. The [rewrites documentation](https://vercel.com/docs/routing/rewrites) covers the route-preserving behavior used by this project.
