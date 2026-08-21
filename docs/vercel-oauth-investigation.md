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
