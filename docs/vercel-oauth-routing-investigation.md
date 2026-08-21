# Vercel OAuth Routing Investigation

On 2026-08-21, the Vercel `zurs` production deployment sourced the correct Git commit but `/api/auth/google/diagnostic` returned Vercel `404: NOT_FOUND`. The deployment overview recorded zero function invocations. Its build log also listed TypeScript errors originating from the imported Express server modules before the static output was deployed. The active production deployment is therefore serving the static application but not the current catch-all Express API function.

The next implementation step is to make the Vercel API function independently buildable from the Express application, or otherwise correct the Vercel build configuration so `api/[...path].ts` becomes a deployed function. The Google OAuth callback must not be marked live until this endpoint returns the diagnostic route from Vercel.

## Follow-up findings

The Vercel deployment resources confirmed that `/api/[...path]` existed, but runtime logs showed `ERR_MODULE_NOT_FOUND` for `/var/task/server/app` imported from the function. The application is now bundled as `dist/vercel-app.mjs` and imported by the function, after which `/api/auth/google/diagnostic` returned successfully from `https://zurs.vercel.app`.

Vercel did not include the platform-provided `JWT_SECRET` or `OAUTH_SERVER_URL`. Its runtime logs showed that the prior Google-start route failed with `Session secret unavailable`, so the Google flow now uses a standalone signed cookie session. Google OAuth client ID and client secret were set as sensitive Vercel Production and Preview environment variables, then the deployment was redeployed.
