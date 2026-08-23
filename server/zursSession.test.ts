import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZursSession, readZursSession, readZursSessionFallbackProfile } from "./zursSession";

describe("standalone ZURS session", () => {
  beforeEach(() =>
    vi.stubEnv("ZURS_SESSION_SECRET", "unit-test-zurs-session-secret")
  );
  afterEach(() => vi.unstubAllEnvs());

  it("signs a Google user identity and rejects a changed token", async () => {
    const token = await createZursSession("google:test-user");
    expect(
      await readZursSession({ headers: { cookie: `zurs_session=${token}` } })
    ).toBe("google:test-user");
    expect(
      await readZursSession({ headers: { cookie: `zurs_session=${token}x` } })
    ).toBeNull();
  });

  it("restores a signed Google fallback profile without a database read", async () => {
    const token = await createZursSession("google:subject-123", {
      email: "Member@Example.com",
      name: "Member",
      loginMethod: "google",
    });
    const request = { headers: { cookie: `zurs_session=${token}` } };

    await expect(readZursSessionFallbackProfile(request)).resolves.toMatchObject({
      openId: "google:subject-123",
      email: "member@example.com",
      name: "Member",
      loginMethod: "google",
      role: "user",
    });
  });

  it("restores a profile display name from an updated signed fallback session", async () => {
    const token = await createZursSession("google:subject-456", {
      email: "Member@Example.com",
      name: "Member",
      displayName: "Makara ZURS Member",
      loginMethod: "google",
    });

    await expect(readZursSessionFallbackProfile({ headers: { cookie: `zurs_session=${token}` } })).resolves.toMatchObject({
      displayName: "Makara ZURS Member",
    });
  });
});
