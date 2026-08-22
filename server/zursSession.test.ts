import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createZursSession, readZursSession } from "./zursSession";

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
});
