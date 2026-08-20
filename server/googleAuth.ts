import type { Express, Request } from "express";

export function getGoogleOAuthStatus(env = process.env) {
  const configured = Boolean(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
  return {
    configured,
    callbackPath: "/api/auth/google/callback",
    reason: configured ? null : "Google OAuth credentials have not been configured yet.",
  } as const;
}

function getCallbackUrl(req: Request) {
  return `${req.protocol}://${req.get("host")}/api/auth/google/callback`;
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google/status", (_req, res) => res.json(getGoogleOAuthStatus()));
  app.get("/api/auth/google", (req, res) => {
    const status = getGoogleOAuthStatus();
    if (!status.configured) return res.status(503).json({ ...status, callbackUrl: getCallbackUrl(req) });
    return res.status(501).json({ ...status, callbackUrl: getCallbackUrl(req), reason: "Google OAuth exchange is staged and will be activated after the registered test callback is confirmed." });
  });
  app.get("/api/auth/google/callback", (req, res) => {
    const status = getGoogleOAuthStatus();
    return res.status(status.configured ? 501 : 503).json({ ...status, callbackUrl: getCallbackUrl(req) });
  });
}
