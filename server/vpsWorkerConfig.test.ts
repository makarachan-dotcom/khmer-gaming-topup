import { describe, expect, it } from "vitest";

const runLiveWorkerProbe = process.env.VITEST_LIVE_CREDENTIALS === "1";

describe("VPS Worker credential configuration", () => {
  it.skipIf(!runLiveWorkerProbe)("accepts the managed bearer credential for a harmless invalid-ID probe", async () => {
    const endpoint = process.env.VPS_WORKER_URL;
    const secret = process.env.WORKER_SECRET;

    expect(endpoint).toMatch(/^https?:\/\//);
    expect(secret).toBeTruthy();

    const response = await fetch(endpoint!, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ game: "honor-of-kings", id: "8329784098348463649", serverId: "" }),
      signal: AbortSignal.timeout(15_000),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { ok?: unknown; username?: unknown; status?: unknown };
    expect(payload.ok).toBe(true);
    expect(typeof payload.username).toBe("string");
    expect(payload.status).toBe("valid");
  }, 20_000);
});
