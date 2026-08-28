import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppwriteAccountFromJwt, getAppwriteAuthConfig, isSafeAppwriteJwt } from "./appwriteAuth";

const original = { endpoint: process.env.APPWRITE_ENDPOINT, projectId: process.env.APPWRITE_PROJECT_ID };

afterEach(() => {
  if (original.endpoint === undefined) delete process.env.APPWRITE_ENDPOINT;
  else process.env.APPWRITE_ENDPOINT = original.endpoint;
  if (original.projectId === undefined) delete process.env.APPWRITE_PROJECT_ID;
  else process.env.APPWRITE_PROJECT_ID = original.projectId;
  vi.unstubAllGlobals();
});

describe("Appwrite Auth identity proof", () => {
  it("uses only the configured Appwrite endpoint and project ID", () => {
    expect(getAppwriteAuthConfig({ APPWRITE_ENDPOINT: "https://sgp.cloud.appwrite.io/v1", APPWRITE_PROJECT_ID: "zurs" } as NodeJS.ProcessEnv)).toEqual({ endpoint: "https://sgp.cloud.appwrite.io/v1", projectId: "zurs" });
    expect(getAppwriteAuthConfig({ APPWRITE_ENDPOINT: "http://localhost/v1", APPWRITE_PROJECT_ID: "zurs" } as NodeJS.ProcessEnv)).toBeNull();
  });

  it("rejects a missing or implausible browser identity proof before network access", async () => {
    const request = vi.fn();
    vi.stubGlobal("fetch", request);
    expect(isSafeAppwriteJwt("short")).toBe(false);
    await expect(getAppwriteAccountFromJwt("short", { APPWRITE_ENDPOINT: "https://sgp.cloud.appwrite.io/v1", APPWRITE_PROJECT_ID: "zurs" } as NodeJS.ProcessEnv)).resolves.toBeNull();
    expect(request).not.toHaveBeenCalled();
  });

  it("verifies an Appwrite JWT server-side and returns only the account fields needed for a ZURS session", async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ $id: "appwrite-user-1", email: "ADMIN@example.com", name: "ZURS Admin", emailVerification: true }), { status: 200 }));
    vi.stubGlobal("fetch", request);
    const account = await getAppwriteAccountFromJwt("a".repeat(32), { APPWRITE_ENDPOINT: "https://sgp.cloud.appwrite.io/v1", APPWRITE_PROJECT_ID: "zurs" } as NodeJS.ProcessEnv);
    expect(account).toEqual({ id: "appwrite-user-1", email: "admin@example.com", name: "ZURS Admin" });
    expect(request).toHaveBeenCalledWith("https://sgp.cloud.appwrite.io/v1/account", expect.objectContaining({ headers: expect.objectContaining({ "X-Appwrite-Project": "zurs", "X-Appwrite-JWT": "a".repeat(32) }) }));
  });
});
