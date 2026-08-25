import { afterEach, describe, expect, it } from "vitest";
import { getKhqrWorkerCredentials } from "./khqrWorkerSecrets";

const original = process.env.JWT_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = original;
  delete process.env.KHQR_AUTOMATION_API_KEY;
  delete process.env.KHQR_WORKER_CALLBACK_SECRET;
});

describe("KHQR worker secret derivation", () => {
  it("derives separate API and callback values without exposing the root secret", () => {
    process.env.JWT_SECRET = "a-32-character-root-secret-for-tests";
    const credentials = getKhqrWorkerCredentials();
    expect(credentials.apiKey).toHaveLength(64);
    expect(credentials.callbackSecret).toHaveLength(64);
    expect(credentials.apiKey).not.toBe(credentials.callbackSecret);
  });

  it("prefers a provisioned callback secret that meets the minimum HMAC strength", () => {
    process.env.JWT_SECRET = "a-32-character-root-secret-for-tests";
    process.env.KHQR_WORKER_CALLBACK_SECRET = "rotated-callback-secret-that-is-at-least-32";
    expect(getKhqrWorkerCredentials().callbackSecret).toBe("rotated-callback-secret-that-is-at-least-32");
    expect(getKhqrWorkerCredentials().callbackSecret?.length).toBeGreaterThanOrEqual(32);
  });
});
