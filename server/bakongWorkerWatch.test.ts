import { afterEach, describe, expect, it, vi } from "vitest";
import { registerBakongKhqrWorkerWatch } from "./bakongKhqr";

const keys = ["KHQR_WORKER_URL", "KHQR_WORKER_CALLBACK_URL", "KHQR_AUTOMATION_API_KEY", "KHQR_WORKER_CALLBACK_SECRET"] as const;
const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

afterEach(() => {
  keys.forEach((key) => { const value = original[key]; if (value === undefined) delete process.env[key]; else process.env[key] = value; });
  vi.unstubAllGlobals();
});

describe("Bakong worker watch registration", () => {
  it("calls the worker watch endpoint with a server-only API credential and exact payment fields", async () => {
    process.env.KHQR_WORKER_URL = "https://pay-worker.zurs.me";
    process.env.KHQR_WORKER_CALLBACK_URL = "https://www.zurs.me/api/webhooks/khqr-worker";
    process.env.KHQR_AUTOMATION_API_KEY = "worker-api-test-key";
    process.env.KHQR_WORKER_CALLBACK_SECRET = "worker-callback-secret-for-test-123";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await registerBakongKhqrWorkerWatch({ md5: "a".repeat(32), orderId: "order-verified-123", amount: "100", currency: "KHR" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://pay-worker.zurs.me/api/payments/watch");
    expect((init.headers as Record<string, string>)["X-API-Key"]).toBe("worker-api-test-key");
    expect(JSON.parse(String(init.body))).toMatchObject({ orderId: "order-verified-123", amount: "100", currency: "KHR" });
  });
});
