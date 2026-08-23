import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { balanceSocialProviderServices, cachedPublicProviderGames, fetchProviderGameDetails, fetchProviderGames, fetchProviderPackages, fetchProviderPreviewPackages, fetchSmmProviderServices, getProviderAvailabilityCatalog, getProviderCatalogStatus, isThailandProviderProduct, resetProviderCatalogCacheForTests, submitSmmProviderOrder, validateProviderPlayerIdentity } from "./providerCatalog";

const originalEndpoint = process.env.FZR_CARDS_API_BASE_URL;
const originalApiKey = process.env.FZR_CARDS_API_KEY;
const originalSmmEndpoint = process.env.SMMGLOB_API_URL;
const originalSmmApiKey = process.env.SMMGLOB_API_KEY;
const originalNeferbyteApiKey = process.env.NEFERBYTE_API_KEY;
const originalRapidApiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
const originalWorkerUrl = process.env.VPS_WORKER_URL;
const originalWorkerSecret = process.env.WORKER_SECRET;

beforeEach(() => {
  resetProviderCatalogCacheForTests();
  delete process.env.VPS_WORKER_URL;
  delete process.env.WORKER_SECRET;
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalEndpoint === undefined) delete process.env.FZR_CARDS_API_BASE_URL;
  else process.env.FZR_CARDS_API_BASE_URL = originalEndpoint;
  if (originalApiKey === undefined) delete process.env.FZR_CARDS_API_KEY;
  else process.env.FZR_CARDS_API_KEY = originalApiKey;
  if (originalSmmEndpoint === undefined) delete process.env.SMMGLOB_API_URL;
  else process.env.SMMGLOB_API_URL = originalSmmEndpoint;
  if (originalSmmApiKey === undefined) delete process.env.SMMGLOB_API_KEY;
  else process.env.SMMGLOB_API_KEY = originalSmmApiKey;
  if (originalNeferbyteApiKey === undefined) delete process.env.NEFERBYTE_API_KEY;
  else process.env.NEFERBYTE_API_KEY = originalNeferbyteApiKey;
  if (originalRapidApiKey === undefined) delete process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
  else process.env.RAPIDAPI_ID_GAME_CHECKER_KEY = originalRapidApiKey;
  if (originalWorkerUrl === undefined) delete process.env.VPS_WORKER_URL;
  else process.env.VPS_WORKER_URL = originalWorkerUrl;
  if (originalWorkerSecret === undefined) delete process.env.WORKER_SECRET;
  else process.env.WORKER_SECRET = originalWorkerSecret;
});

describe("provider catalog", () => {
  it("keeps games and packages empty until authorized provider credentials are configured", async () => {
    delete process.env.FZR_CARDS_API_BASE_URL;
    delete process.env.FZR_CARDS_API_KEY;
    await expect(fetchProviderGames()).resolves.toEqual({ status: "unavailable", games: [] });
    await expect(fetchProviderPackages({ gameId: "provider-game", fields: { playerId: "123456" } })).resolves.toEqual({ status: "unavailable", packages: [] });
    expect(getProviderCatalogStatus()).toMatchObject({ configured: false, endpointConfigured: false, credentialConfigured: false });
  });

  it("reports connection readiness without disclosing provider secrets", () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-secret-must-not-be-returned";
    expect(getProviderCatalogStatus()).toMatchObject({ configured: true, endpointConfigured: true, credentialConfigured: true });
    expect(JSON.stringify(getProviderCatalogStatus())).not.toContain("provider-secret-must-not-be-returned");
  });

  it("preserves owner-approved cached public games when the live FazerCards catalog is unavailable", () => {
    const games = cachedPublicProviderGames({
      games: [
        { id: "cached-public", providerSourceId: "public-game", titleKh: "Public Game", titleEn: "Public Game", packages: [] },
        { id: "cached-hidden", providerSourceId: "hidden-game", titleKh: "Hidden Game", titleEn: "Hidden Game", packages: [] },
        { id: "cached-unapproved", providerSourceId: "unapproved-game", titleKh: "Unapproved Game", titleEn: "Unapproved Game", packages: [] },
        { id: "cached-thai", providerSourceId: "thai-game", titleKh: "Thai Game", titleEn: "Thai Game", packages: [] },
      ],
      smm: [],
    }, {
      activeGameIds: ["public-game", "hidden-game", "thai-game"],
      hiddenGameIds: ["hidden-game"],
      hiddenSmmServiceIds: [],
      updatedAt: new Date(),
    });

    expect(games).toEqual([{ id: "public-game", name: "Public Game", region: "Global", provider: "FZR Cards", requiredFields: [] }]);
  });

  it("shows complete paginated FazerCards inventory only to admin and never automatically publicizes the first provider page", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("smm")) return { ok: true, json: async () => [] };
      if (url.includes("cursor=page-2")) return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "new-pubg", name: "PUBG Mobile" }], meta: { next_cursor: null, has_more: false } }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "8_ball_pool", name: "8 Ball Pool" }], meta: { next_cursor: "page-2", has_more: true } }) };
    }));

    await expect(fetchProviderGames()).resolves.toEqual({ status: "ready", games: [{ id: "8_ball_pool", name: "8 Ball Pool", region: "Global", provider: "FZR Cards", requiredFields: [] }] });
    await expect(getProviderAvailabilityCatalog()).resolves.toMatchObject({ games: [{ id: "8_ball_pool", isActive: true }, { id: "new-pubg", isActive: false }] });
  });

  it("reuses a brief ready catalog cache for consecutive storefront reads", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "8_ball_pool", name: "8 Ball Pool" }], meta: { next_cursor: null, has_more: false } }) }));

    await expect(fetchProviderGames()).resolves.toMatchObject({ status: "ready" });
    await expect(fetchProviderGames()).resolves.toMatchObject({ status: "ready" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns provider-required fields and official game imagery only after a selected game is requested", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "acecraft", name: "Acecraft" }], meta: { next_cursor: null, has_more: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "acecraft", name: "Acecraft", imageurl: "https://cdn.example.test/acecraft.png", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "80_diamonds", name: "80 Diamonds", price_usd: "0.9864" }] }) }));
    await expect(fetchProviderGameDetails("acecraft", { includeInactive: true })).resolves.toEqual({ status: "ready", game: { id: "acecraft", name: "Acecraft", region: "Global", logoUrl: "https://cdn.example.test/acecraft.png", provider: "FZR Cards", requiredFields: [{ key: "user_id", label: "User ID", required: true, kind: "text" }] }, packages: [{ id: "acecraft:80_diamonds", label: "80 Diamonds", amountLabel: "80 Diamonds", priceLabel: "$0.99", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
  });

  it("merges active Mobile Legends Global, Promo, and Special variants into one family page", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?category_id=mobile_legends_global")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "mobile_legends_global", name: "Mobile Legends (Global)", fields: [{ key: "player_id", label: "Player ID", type: "text" }, { key: "server_id", label: "Server ID", type: "text" }], offers: [{ offer_id: "global", name: "86 Diamonds", price_usd: "1.00" }] }) };
      if (url.includes("/offers?category_id=mobile_legends_promo")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "mobile_legends_promo", name: "Mobile Legends (Promo)", fields: [{ key: "player_id", label: "Player ID", type: "text" }, { key: "server_id", label: "Server ID", type: "text" }], offers: [{ offer_id: "promo", name: "Promo Pass", price_usd: "2.00" }] }) };
      if (url.includes("/offers?category_id=mobile_legends_special")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "mobile_legends_special", name: "Mobile Legends (Special)", fields: [{ key: "player_id", label: "Player ID", type: "text" }, { key: "server_id", label: "Server ID", type: "text" }], offers: [{ offer_id: "special", name: "Special Pack", price_usd: "3.00" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "mobile_legends_global", name: "Mobile Legends (Global)" }, { category_id: "mobile_legends_promo", name: "Mobile Legends (Promo)" }, { category_id: "mobile_legends_special", name: "Mobile Legends (Special)" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    const result = await fetchProviderGameDetails("mobile_legends");
    expect(result).toMatchObject({ status: "ready", game: { id: "mobile_legends", name: "Mobile Legends" } });
    if (result.status === "ready") expect(result.packages.map((item) => item.id)).toEqual(["mobile_legends_global:global", "mobile_legends_promo:promo", "mobile_legends_special:special"]);
  });

  it("returns authorized package UI for an admin preview without submitting a player identity", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "preview-only-game", name: "Preview Only Game" }], meta: { next_cursor: null, has_more: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "preview-only-game", name: "Preview Only Game", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "starter", name: "Starter Pack", price_usd: "1.25" }] }) }));

    await expect(fetchProviderPreviewPackages("preview-only-game")).resolves.toEqual({ status: "ready", packages: [{ id: "preview-only-game:starter", label: "Starter Pack", amountLabel: "Starter Pack", priceLabel: "$1.25", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain("/offers?category_id=preview-only-game");
  });

  it("validates Mobile Legends only through the documented server-side free endpoint", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, name: "ZURS Member", country: "Indonesia" }) }));
    const result = await validateProviderPlayerIdentity({ gameId: "mobile-legends", fields: { player_id: "123456", zone_id: "4567" } });
    expect(result).toEqual({ status: "verified", playerName: "ZURS Member", playerId: "123456", region: "Indonesia" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("/nickname/ml?");
    expect(JSON.stringify(result)).not.toContain("server-only-key");
  });

  it("requires a verified player name before revealing provider packages", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));
    await expect(fetchProviderPackages({ gameId: "mobile-legends", fields: { player_id: "not-valid" } })).resolves.toEqual({ status: "verification_required", packages: [] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("marks an unsupported category as not supported without any provider validation request", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn());
    await expect(validateProviderPlayerIdentity({ gameId: "acecraft", fields: { user_id: "123456" } })).resolves.toEqual({ status: "not_supported", playerName: null, playerId: null, region: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the owner-approved Free Fire API only server-side when FZR does not support name validation", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, game: "Garena Free Fire", id: "redacted", name: "Verified Player" }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "free_fire_my_sg", fields: { player_id: "12345678" } })).resolves.toEqual({ status: "verified", playerName: "Verified Player", playerId: "12345678", region: "Global" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("/nickname/ff?");
    expect(JSON.stringify((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0])).not.toContain("server-only-key");
  });

  it("uses the owner-approved 8 Ball Pool response schema when FZR does not support name validation", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: true, nickname: "Verified Player", message: "Success" }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "8_ball_pool", fields: { user_id: "12345678" } })).resolves.toEqual({ status: "verified", playerName: "Verified Player", playerId: "12345678", region: "Global" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("type_name=eight_ball_pool");
  });

  it("maps Magic Chess, Call of Duty, and Arena of Valor to their owner-approved Isan endpoints", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    for (const [gameId, expectedPath, fields] of [
      ["magic_chess_gogo_global", "/nickname/mcgg?", { user_id: "12345678", server_id: "123" }],
      ["call_of_duty_mobile", "/nickname/cod?", { user_id: "12345678" }],
      ["arena_of_valor", "/nickname/aov?", { user_id: "12345678" }],
    ] as const) {
      vi.stubGlobal("fetch", vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, name: "Verified Player", country: "Global" }) }));
      await expect(validateProviderPlayerIdentity({ gameId, fields })).resolves.toMatchObject({ status: "verified", playerId: "12345678" });
      expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain(expectedPath);
      vi.unstubAllGlobals();
    }
  });

  it("does not call Magic Chess free validation until both ID and zone are complete", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn());
    await expect(validateProviderPlayerIdentity({ gameId: "magic_chess_gogo_global", fields: { user_id: "12345678" } })).resolves.toEqual({ status: "invalid", playerName: null, playerId: null, region: null });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
  });

  it("reveals an unsupported package list only after explicit ID confirmation", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "blood_strike", name: "Blood Strike", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "starter", name: "Starter Pack", price_usd: "1.25" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "blood_strike", name: "Blood Strike" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    await expect(fetchProviderPackages({ gameId: "blood_strike", fields: { user_id: "123456" }, idAccuracyConfirmed: true })).resolves.toEqual({ status: "ready", packages: [{ id: "blood_strike:starter", label: "Starter Pack", amountLabel: "Starter Pack", priceLabel: "$1.25", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.every(([url]) => !String(url).includes("validate-id"))).toBe(true);
  });

  it("reveals packages for a provider form with no ID-style field without making an identity request", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "8_ball_pool", name: "8 Ball Pool", fields: [{ key: "email", label: "Email", type: "text" }], offers: [{ offer_id: "starter", name: "Starter Pack", price_usd: "1.25" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "8_ball_pool", name: "8 Ball Pool" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    await expect(fetchProviderPackages({ gameId: "8_ball_pool", fields: { email: "customer@example.test" } })).resolves.toMatchObject({ status: "ready", packages: [{ id: "8_ball_pool:starter" }] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.every(([url]) => !String(url).includes("/validate-id"))).toBe(true);
  });

  it("keeps Mobile Legends packages gated when its documented free API is unavailable", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "unavailable", playerName: null, playerId: null, region: null });
    await expect(fetchProviderPackages({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "unavailable", packages: [] });
  });

  it("uses one documented free Mobile Legends request without rotating to paid providers", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, name: "Verified Player", country: "Global" }) }));
    const result = await validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } });
    expect(result).toEqual({ status: "verified", playerName: "Verified Player", playerId: "596323155", region: "Global" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("/nickname/ml?");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("does not use the VPS Worker for Mobile Legends after the final free-API policy", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-server-only-key";
    process.env.VPS_WORKER_URL = "https://worker.example.test/api/check-id";
    process.env.WORKER_SECRET = "worker-server-only-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, name: "Verified Player" }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } });

    expect(result).toEqual({ status: "verified", playerName: "Verified Player", playerId: "596323155", region: "Global" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toContain("/nickname/ml?");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("treats Honor of Kings as unsupported without calling the VPS Worker", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-server-only-key";
    process.env.VPS_WORKER_URL = "https://worker.example.test/api/check-id";
    process.env.WORKER_SECRET = "worker-server-only-secret";
    vi.stubGlobal("fetch", vi.fn());

    const result = await validateProviderPlayerIdentity({ gameId: "honor_of_kings", fields: { player_id: "8329784098348463649" } });

    expect(result).toEqual({ status: "not_supported", playerName: null, playerId: null, region: null });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("uses the documented Free Fire endpoint and never sends IDs to the VPS Worker", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-server-only-key";
    process.env.VPS_WORKER_URL = "https://worker.example.test/api/check-id";
    process.env.WORKER_SECRET = "worker-server-only-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: false }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "free_fire_my_sg", fields: { player_id: "12345678" } });

    expect(result.status).toBe("invalid");
    const freeApiCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(freeApiCall?.[0]).toContain("/nickname/ff?");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("stops after one unavailable free API request without rotating fallback providers", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503, json: async () => ({ success: false }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "unavailable", playerName: null, playerId: null, region: null });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("maps SMMGlob services through the server-only form request", async () => {
    process.env.SMMGLOB_API_URL = "https://smm.example.test/api/v2";
    process.env.SMMGLOB_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ service: 101, name: "Instagram Followers", category: "Instagram", type: "Default", rate: "3.5", min: 100, max: 10000, dripfeed: true, refill: false, cancel: false }] }));
    await expect(fetchSmmProviderServices()).resolves.toEqual({ status: "ready", services: [{ providerServiceId: "101", name: "Instagram Followers", category: "Instagram", serviceType: "Default", rateUsdPerThousand: "3.5000", min: 100, max: 10000, dripfeed: true, refill: false, cancel: false }] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
  });

  it("keeps valid social services when a provider catalog includes malformed records", async () => {
    process.env.SMMGLOB_API_URL = "https://smm.example.test";
    process.env.SMMGLOB_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [{ service: 101, name: "Instagram Followers", category: "Instagram", type: "Default", rate: "3.5", min: 100, max: 10000 }, { service: null, name: "Broken provider row" }] }));
    const result = await fetchSmmProviderServices();
    expect(result.status).toBe("ready");
    expect(result.services).toHaveLength(1);
    expect(result.services[0]?.providerServiceId).toBe("101");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toBe("https://smm.example.test/api/v2");
  });

  it("balances real social categories instead of filling the visible catalog with one platform", () => {
    const services = balanceSocialProviderServices([{ name: "Facebook Likes A", category: "Facebook" }, { name: "Facebook Likes B", category: "Facebook" }, { name: "TikTok Views", category: "TikTok" }, { name: "Instagram Followers", category: "Instagram" }], 4);
    expect(services.map((service) => service.category)).toEqual(["Facebook", "Instagram", "TikTok", "Facebook"]);
  });

  it("recognizes Thailand markers for exclusion without matching unrelated records", () => {
    expect(isThailandProviderProduct("Arena of Valor (TH) Region: Thailand")).toBe(true);
    expect(isThailandProviderProduct("บริการ ไทย Facebook followers")).toBe(true);
    expect(isThailandProviderProduct("Arena of Valor (ID) Region: Indonesia")).toBe(false);
  });

  it("submits a paid SMM fulfillment request only through the server-side SMMGlob add action", async () => {
    process.env.SMMGLOB_API_URL = "https://smm.example.test/api/v2";
    process.env.SMMGLOB_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ order: 987654 }) }));
    const result = await submitSmmProviderOrder({ providerServiceId: "101", target: "https://social.example.test/profile", quantity: 100 });
    expect(result).toEqual({ status: "submitted", providerOrderId: "987654" });
    const body = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]?.body as URLSearchParams;
    expect(body.get("action")).toBe("add");
    expect(body.get("service")).toBe("101");
    expect(body.get("quantity")).toBe("100");
    expect(JSON.stringify(result)).not.toContain("server-only-key");
  });
});
