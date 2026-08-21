# Vercel OAuth Routing Investigation

On 2026-08-21, the Vercel `zurs` production deployment sourced the correct Git commit but `/api/auth/google/diagnostic` returned Vercel `404: NOT_FOUND`. The deployment overview recorded zero function invocations. Its build log also listed TypeScript errors originating from the imported Express server modules before the static output was deployed. The active production deployment is therefore serving the static application but not the current catch-all Express API function.

The next implementation step is to make the Vercel API function independently buildable from the Express application, or otherwise correct the Vercel build configuration so `api/[...path].ts` becomes a deployed function. The Google OAuth callback must not be marked live until this endpoint returns the diagnostic route from Vercel.
