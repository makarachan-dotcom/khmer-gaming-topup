import { describe, expect, it } from "vitest";
import { createZursSession, readZursSession } from "./zursSession";

describe("standalone ZURS session", () => {
  it("signs a Google user identity and rejects a changed token", async () => {
    const token = await createZursSession("google:test-user");
    expect(await readZursSession({ headers: { cookie: `zurs_session=${token}` } })).toBe("google:test-user");
    expect(await readZursSession({ headers: { cookie: `zurs_session=${token}x` } })).toBeNull();
  });
});
