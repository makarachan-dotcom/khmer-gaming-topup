import { describe, expect, it } from "vitest";

describe("KHQR worker endpoint configuration", () => {
  it("keeps the worker and website callback on HTTPS endpoints", () => {
    const worker = new URL(process.env.KHQR_WORKER_URL ?? "");
    const callback = new URL(process.env.KHQR_WORKER_CALLBACK_URL ?? "");
    expect(worker.protocol).toBe("https:");
    expect(worker.hostname).toBe("pay-worker.zurs.me");
    expect(new URL("/health", worker).toString()).toBe("https://pay-worker.zurs.me/health");
    expect(callback.protocol).toBe("https:");
    expect(callback.hostname).toBe("www.zurs.me");
    expect(callback.pathname).toBe("/api/webhooks/khqr-worker");
  });
});
