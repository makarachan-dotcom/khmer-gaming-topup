# OAuth Live Verification — 2026-08-21

The Vercel OAuth start response was confirmed to use `Cache-Control: private, no-store, max-age=0` and a short-lived `zurs_google_oauth_state` cookie with `Secure; SameSite=None`. This replaces the previous `SameSite=Lax` policy that produced the callback error “Google authorization state expired or did not match”.

| Public deployment | Sign-in result | Callback/session result | Logout result |
|---|---|---|---|
| `zurs.vercel.app` | Google OAuth initiated with the registered Vercel callback URL | Returned to `/account` with the owner account, ZURS Admin badge, and account history visible | Returned to the signed-out Account state with sign-in controls visible |
| `khmergame-girzfgts.manus.space` | Google OAuth initiated with the registered managed-host callback URL | Returned to `/account` with the owner account and ZURS Admin badge visible | Returned to the signed-out Account state with sign-in controls visible |

No OAuth code, access token, refresh token, cookie value, or account credential is recorded in this document.
