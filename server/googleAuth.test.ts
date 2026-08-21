import { describe, expect, it } from "vitest";
import { getGoogleCallbackFailureReference, getGoogleCallbackUrl, getGoogleOAuthStatus, resolveGoogleUserOpenId, shouldQueueWelcomeEmail } from "./googleAuth";

describe("Google OAuth staging", () => {
  it("stays inactive without user-owned Google OAuth credentials", () => {
    expect(getGoogleOAuthStatus({})).toEqual({ configured: false, callbackPath: "/api/auth/google/callback", reason: "Google OAuth credentials have not been configured yet." });
  });

  it("reports ready only when both Google OAuth credentials are present", () => {
    expect(getGoogleOAuthStatus({ GOOGLE_OAUTH_CLIENT_ID: "client-id", GOOGLE_OAUTH_CLIENT_SECRET: "client-secret" })).toMatchObject({ configured: true, callbackPath: "/api/auth/google/callback", reason: null });
  });

  it("uses HTTPS for managed live domains and local HTTP only for localhost", () => {
    const request = (host: string, protocol = "http", forwarded?: string) => ({ protocol, get: (name: string) => name === "host" ? host : undefined, headers: forwarded ? { "x-forwarded-proto": forwarded } : {} });
    expect(getGoogleCallbackUrl(request("khmergame-girzfgts.manus.space"))).toBe("https://khmergame-girzfgts.manus.space/api/auth/google/callback");
    expect(getGoogleCallbackUrl(request("zurs.vercel.app"))).toBe("https://zurs.vercel.app/api/auth/google/callback");
    expect(getGoogleCallbackUrl(request("localhost:3000"))).toBe("http://localhost:3000/api/auth/google/callback");
    expect(getGoogleCallbackUrl(request("internal-runtime.a.run.app"))).toBe("https://khmergame-girzfgts.manus.space/api/auth/google/callback");
    expect(getGoogleCallbackUrl(request("internal-runtime.a.run.app:443"))).toBe("https://khmergame-girzfgts.manus.space/api/auth/google/callback");
    expect(getGoogleCallbackUrl(request("internal-runtime.a.run.app"), { GOOGLE_OAUTH_REDIRECT_URI: "https://khmergame-girzfgts.manus.space/api/auth/google/callback" })).toBe("https://khmergame-girzfgts.manus.space/api/auth/google/callback");
  });

  it("keeps an existing verified-email account identity when Google is connected", () => {
    expect(resolveGoogleUserOpenId({ openId: "existing-account" }, "google-subject")).toBe("existing-account");
    expect(resolveGoogleUserOpenId(undefined, "google-subject")).toBe("google:google-subject");
  });

  it("queues one branded welcome email when a sender is authorized and no delivery exists", () => {
    expect(shouldQueueWelcomeEmail({ hasExistingDelivery: false, hasAuthorizedSender: true })).toBe(true);
    expect(shouldQueueWelcomeEmail({ hasExistingDelivery: true, hasAuthorizedSender: true })).toBe(false);
    expect(shouldQueueWelcomeEmail({ hasExistingDelivery: false, hasAuthorizedSender: false })).toBe(false);
  });

  it("maps callback stages to non-sensitive diagnostic references", () => {
    expect(getGoogleCallbackFailureReference("token")).toBe("GOOGLE_TOKEN_FAILED");
    expect(getGoogleCallbackFailureReference("user")).toBe("GOOGLE_USER_FAILED");
    expect(getGoogleCallbackFailureReference("welcome")).toBe("GOOGLE_WELCOME_FAILED");
  });
});
