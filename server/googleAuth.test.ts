import { describe, expect, it } from "vitest";
import { getGoogleOAuthStatus } from "./googleAuth";

describe("Google OAuth staging", () => {
  it("stays inactive without user-owned Google OAuth credentials", () => {
    expect(getGoogleOAuthStatus({})).toEqual({ configured: false, callbackPath: "/api/auth/google/callback", reason: "Google OAuth credentials have not been configured yet." });
  });

  it("reports ready only when both Google OAuth credentials are present", () => {
    expect(getGoogleOAuthStatus({ GOOGLE_OAUTH_CLIENT_ID: "client-id", GOOGLE_OAUTH_CLIENT_SECRET: "client-secret" })).toMatchObject({ configured: true, callbackPath: "/api/auth/google/callback", reason: null });
  });
});
