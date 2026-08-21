# Vercel OAuth Investigation

On 21 August 2026, the live diagnostic endpoint at `https://zurs.vercel.app/api/auth/google/diagnostic` reported the following safe configuration state:

```json
{
  "routeVersion": "oauth-callback-v3",
  "callbackUrl": "https://zurs.vercel.app/api/auth/google/callback",
  "databaseConfigured": false
}
```

Google OAuth credentials and the Vercel callback URL are configured, but the Vercel runtime does not currently have a `DATABASE_URL`. The Google callback therefore cannot persist or retrieve the local ZURS user record needed to create an authenticated session. Add the same MySQL/TiDB `DATABASE_URL` used by the managed ZURS STORE deployment to the **Production** environment of the Vercel `zurs` project, then redeploy and re-test sign-in.

## Appwrite fallback update

On 21 August 2026, the Vercel `zurs` project received `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY`, and `APPWRITE_DATABASE_ID` for Production and Preview. Vercel then created the production deployment from checkpoint `cbcafb5b`, which includes an Appwrite-backed user-store fallback when `DATABASE_URL` is unavailable. The remaining verification is to complete a real Google sign-in against `zurs.vercel.app` and confirm that the callback reaches `/account` with a ZURS session.
