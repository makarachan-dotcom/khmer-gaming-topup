import { describe, expect, it } from "vitest";

describe.runIf(process.env.VITEST_LIVE_CREDENTIALS === "1")(
  "Google OAuth credentials",
  () => {
    it("are accepted by Google as a registered OAuth client", async () => {
      const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
      expect(clientId).toBeTruthy();
      expect(clientSecret).toBeTruthy();

      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId!,
          client_secret: clientSecret!,
          code: "zurs-credential-validation-no-authorization-code",
          grant_type: "authorization_code",
          redirect_uri:
            "https://khmergame-girzfgts.manus.space/api/auth/google/callback",
        }),
      });
      const result = (await response.json()) as { error?: string };
      expect(result.error).not.toBe("invalid_client");
    }, 20_000);
  }
);
