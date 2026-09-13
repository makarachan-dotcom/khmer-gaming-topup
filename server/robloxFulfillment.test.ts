import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { submitFzrTopupOrder } from "./providerCatalog";

const originalEndpoint = process.env.FZR_CARDS_API_BASE_URL;
const originalApiKey = process.env.FZR_CARDS_API_KEY;

describe("Roblox Robux fulfilment", () => {
  beforeEach(() => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.FZR_CARDS_API_BASE_URL = originalEndpoint;
    process.env.FZR_CARDS_API_KEY = originalApiKey;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts the Roblox login to the operator chat after creating the manual-service order", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/api/v2/manual-services/order")) {
        expect(init?.headers && (init.headers as Record<string, string>)["Idempotency-Key"]).toBe("zurs-order-1");
        const body = JSON.parse(String(init?.body));
        expect(body).toMatchObject({ manual_service_id: "svc1", product_id: "prod9" });
        expect(body.fields.username).toBe("builderman");
        return { ok: true, text: async () => JSON.stringify({ ok: true, order_id: "fzr-roblox-77", chat_required: true }), json: async () => ({ ok: true, order_id: "fzr-roblox-77", chat_required: true }) };
      }
      if (String(url).includes("/manual-services/orders/fzr-roblox-77/chat")) {
        expect(init?.body).toBeInstanceOf(FormData);
        const body = String((init?.body as FormData).get("body"));
        expect(body).toContain("builderman");
        expect(body).toContain("secret-pass");
        expect(JSON.stringify(init?.headers ?? {})).not.toMatch(/secret-pass/);
        return { ok: true, text: async () => JSON.stringify({ sender: "reseller", body: "ok" }), json: async () => ({ sender: "reseller", body: "ok" }) };
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitFzrTopupOrder({
      categoryId: "roblox_robux",
      offerId: "manual_svc1~prod9",
      playerId: "@builderman",
      serverId: null,
      password: "secret-pass",
      idempotencyKey: "zurs-order-1",
    })).resolves.toEqual({ status: "submitted", providerOrderId: "fzr-roblox-77" });

    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((url) => url.includes("/topups/order"))).toBe(false);
    expect(urls[0]).toContain("/manual-services/order");
    expect(urls[1]).toContain("/manual-services/orders/fzr-roblox-77/chat");
  });

  it("resends only the operator chat when the FZR order already exists", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("/chat")) {
        return { ok: true, text: async () => "", json: async () => ({}) };
      }
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(submitFzrTopupOrder({
      categoryId: "roblox_robux",
      offerId: "manual_svc1~prod9",
      playerId: "builderman",
      serverId: null,
      password: "secret-pass",
      existingOrderId: "fzr-roblox-77",
    })).resolves.toEqual({ status: "submitted", providerOrderId: "fzr-roblox-77" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/manual-services/orders/fzr-roblox-77/chat");
  });

  it("does not mark the provider submit complete if the operator never received the login", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (String(url).endsWith("/api/v2/manual-services/order")) {
        return { ok: true, json: async () => ({ ok: true, order_id: "fzr-roblox-77" }), text: async () => JSON.stringify({ ok: true, order_id: "fzr-roblox-77" }) };
      }
      return { ok: false, status: 503, text: async () => "busy", json: async () => ({}) };
    }));

    await expect(submitFzrTopupOrder({
      categoryId: "roblox_robux",
      offerId: "manual_svc1~prod9",
      playerId: "builderman",
      serverId: null,
      password: "secret-pass",
    })).resolves.toEqual({ status: "unavailable" });
  });
});

describe("Roblox fulfilment wiring", () => {
  it("retries Roblox chat on already-submitted paid orders and never logs the password", () => {
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const catalog = readFileSync(resolve(process.cwd(), "server/providerCatalog.ts"), "utf8");
    expect(db).toContain("providerChatSent");
    expect(db).toContain("fzrIdempotencyKey(orderId, i, quantity)");
    expect(db).toContain("robloxNeedsChat");
    const robloxFn = catalog.slice(catalog.indexOf("async function submitRobloxProviderOrder"), catalog.indexOf("export function isWantedProviderProduct"));
    expect(robloxFn).toContain("sendRobloxOperatorChat");
    expect(robloxFn).toContain("FormData");
    expect(robloxFn).not.toContain("JSON.stringify(response)");
    expect(robloxFn).not.toMatch(/console\.warn\(`[^\n]*password/);
  });
});
