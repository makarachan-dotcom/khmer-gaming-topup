import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { readZursSessionFallbackProfile } from "./zursSession";
import type { TrpcContext } from "./_core/context";

describe("Account profile resilience", () => {
  it("keeps a verified member name in the signed session when Appwrite is rate-limited", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("APPWRITE_ENDPOINT", "https://appwrite.example/v1");
    vi.stubEnv("APPWRITE_PROJECT_ID", "zurs-project");
    vi.stubEnv("APPWRITE_API_KEY", "server-only-test-key");
    vi.stubEnv("ZURS_SESSION_SECRET", "account-session-test-secret");
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const cookies: Array<{ name: string; value: string }> = [];
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ type: "limit_databases_reads_exceeded" }), { status: 402 })));
    const ctx: TrpcContext = {
      user: {
        id: 1_000_000_123,
        openId: "google:member-123",
        name: "Makara",
        displayName: null,
        email: "member@example.com",
        loginMethod: "google",
        role: "user",
        createdAt: new Date("2026-08-23T00:00:00.000Z"),
        updatedAt: new Date("2026-08-23T00:00:00.000Z"),
        lastSignedIn: new Date("2026-08-23T00:00:00.000Z"),
      },
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { cookie: (name: string, value: string) => cookies.push({ name, value }) } as TrpcContext["res"],
    };

    const result = await appRouter.createCaller(ctx).auth.setMemberDisplayName({ name: "Makara" });

    expect(result).toEqual({ displayName: "Makara ZURS Member", persisted: false });
    expect(cookies).toHaveLength(1);
    await expect(readZursSessionFallbackProfile({ headers: { cookie: `${cookies[0]?.name}=${cookies[0]?.value}` } })).resolves.toMatchObject({
      displayName: "Makara ZURS Member",
      email: "member@example.com",
    });
  });
});
