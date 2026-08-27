import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { balanceSocialProviderServices, cachedProviderAvailabilityGames, cachedPublicProviderGames, fetchProviderGameDetails, fetchProviderGames, fetchProviderPackages, fetchProviderPreviewPackages, fetchSmmProviderServices, getProviderAvailabilityCatalog, getProviderCatalogStatus, isThailandProviderProduct, providerPackageRecordId, resetProviderCatalogCacheForTests, setProviderAvailability, submitSmmProviderOrder, validateProviderPlayerIdentity } from "./providerCatalog";

const originalEndpoint = process.env.FZR_CARDS_API_BASE_URL;
const originalApiKey = process.env.FZR_CARDS_API_KEY;
const originalSmmEndpoint = process.env.SMMGLOB_API_URL;
const originalSmmApiKey = process.env.SMMGLOB_API_KEY;
const originalNeferbyteApiKey = process.env.NEFERBYTE_API_KEY;
const originalRapidApiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
const originalWorkerUrl = process.env.VPS_WORKER_URL;
const originalWorkerSecret = process.env.WORKER_SECRET;
const originalHerokuBridgeUrl = process.env.HEROKU_BRIDGE_URL;
const originalHerokuBridgeApiKey = process.env.HEROKU_BRIDGE_API_KEY;
const originalHerokuBridgeKey = process.env.HEROKU_BRIDGE_KEY;
const originalAppwriteEndpoint = process.env.APPWRITE_ENDPOINT;
const originalAppwriteProjectId = process.env.APPWRITE_PROJECT_ID;
const originalAppwriteApiKey = process.env.APPWRITE_API_KEY;

beforeEach(() => {
  resetProviderCatalogCacheForTests();
  delete process.env.VPS_WORKER_URL;
  delete process.env.WORKER_SECRET;
  delete process.env.HEROKU_BRIDGE_URL;
  delete process.env.HEROKU_BRIDGE_API_KEY;
  delete process.env.HEROKU_BRIDGE_KEY;
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
  if (originalHerokuBridgeUrl === undefined) delete process.env.HEROKU_BRIDGE_URL;
  else process.env.HEROKU_BRIDGE_URL = originalHerokuBridgeUrl;
  if (originalHerokuBridgeApiKey === undefined) delete process.env.HEROKU_BRIDGE_API_KEY;
  else process.env.HEROKU_BRIDGE_API_KEY = originalHerokuBridgeApiKey;
  if (originalHerokuBridgeKey === undefined) delete process.env.HEROKU_BRIDGE_KEY;
  else process.env.HEROKU_BRIDGE_KEY = originalHerokuBridgeKey;
  if (originalAppwriteEndpoint === undefined) delete process.env.APPWRITE_ENDPOINT;
  else process.env.APPWRITE_ENDPOINT = originalAppwriteEndpoint;
  if (originalAppwriteProjectId === undefined) delete process.env.APPWRITE_PROJECT_ID;
  else process.env.APPWRITE_PROJECT_ID = originalAppwriteProjectId;
  if (originalAppwriteApiKey === undefined) delete process.env.APPWRITE_API_KEY;
  else process.env.APPWRITE_API_KEY = originalAppwriteApiKey;
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

  it("keeps synchronized provider games available to the owner inventory during a live FZR outage", () => {
    const games = cachedProviderAvailabilityGames({
      games: [
        { id: "cached-free-fire", providerSourceId: "free_fire_bd", titleKh: "Free Fire (BD)", titleEn: "Free Fire (BD)", packages: [] },
        { id: "cached-thai", providerSourceId: "thai-game", titleKh: "Thai Game", titleEn: "Thai Game", packages: [] },
      ],
      smm: [],
    }, {
      activeGameIds: ["free_fire_bd"],
      hiddenGameIds: [],
      hiddenSmmServiceIds: [],
      updatedAt: new Date(),
    });

    expect(games).toEqual([{ id: "free_fire_bd", name: "Free Fire (BD)", isActive: true }]);
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

  it("keeps a confirmed admin visibility update in the shared catalog cache immediately", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    process.env.APPWRITE_ENDPOINT = "https://appwrite.example.test/v1";
    process.env.APPWRITE_PROJECT_ID = "zurs-project";
    process.env.APPWRITE_API_KEY = "appwrite-server-only-key";
    let savedAvailability: Record<string, unknown> | null = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.startsWith("https://provider.example.test")) {
        return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "free_fire_my_sg", name: "Free Fire (MY/SG)" }, { category_id: "free_fire_bd", name: "Free Fire (BD)" }], meta: { next_cursor: null, has_more: false } }) };
      }
      if (init?.method === "GET") {
        return savedAvailability
          ? { ok: true, json: async () => ({ $id: "availability", sourceTable: "provider_availability", sourceId: "global", payload: JSON.stringify(savedAvailability) }) }
          : { ok: false, status: 404, json: async () => ({}) };
      }
      savedAvailability = JSON.parse(String(init?.body ?? "{}"))?.data?.payload ? JSON.parse(JSON.parse(String(init?.body)).data.payload) : null;
      return { ok: true, json: async () => ({ $id: "availability" }) };
    }));

    await expect(setProviderAvailability({ kind: "game", providerId: "free_fire_bd", isActive: true })).resolves.toMatchObject({ activeGameIds: expect.arrayContaining(["free_fire_bd"]) });
    const inventory = await getProviderAvailabilityCatalog();
    expect(inventory.games.find((game) => game.id === "free_fire_bd")).toMatchObject({ isActive: true });
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
    await expect(fetchProviderGameDetails("acecraft", { includeInactive: true })).resolves.toEqual({ status: "ready", game: { id: "acecraft", name: "Acecraft", region: "Global", logoUrl: "https://cdn.example.test/acecraft.png", provider: "FZR Cards", requiredFields: [{ key: "user_id", label: "User ID", required: true, kind: "text" }] }, packages: [{ id: providerPackageRecordId("acecraft", "80_diamonds"), label: "80 Diamonds", amountLabel: "80 Diamonds", priceLabel: "$0.99", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
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
    if (result.status === "ready") expect(result.packages.map((item) => item.id)).toEqual([providerPackageRecordId("mobile_legends_global", "global"), providerPackageRecordId("mobile_legends_promo", "promo"), providerPackageRecordId("mobile_legends_special", "special")]);
  });

  it("merges owner-enabled Free Fire regional variants into one public Free Fire family page", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?category_id=free_fire_my_sg")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "free_fire_my_sg", name: "Free Fire (MY/SG)", fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [{ offer_id: "my-sg", name: "100 Diamonds", price_usd: "1.00" }] }) };
      if (url.includes("/offers?category_id=free_fire_bd")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "free_fire_bd", name: "Free Fire (BD)", fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [{ offer_id: "bd", name: "310 Diamonds", price_usd: "2.00" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "free_fire_my_sg", name: "Free Fire (MY/SG)" }, { category_id: "free_fire_bd", name: "Free Fire (BD)" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    const result = await fetchProviderGameDetails("free_fire", { includeInactive: true });
    expect(result).toMatchObject({ status: "ready", game: { id: "free_fire", name: "Free Fire" } });
    if (result.status === "ready") expect(result.packages.map((item) => item.id)).toEqual([providerPackageRecordId("free_fire_my_sg", "my-sg"), providerPackageRecordId("free_fire_bd", "bd")]);
  });

  it("merges active PUBG Mobile Auto and Fast variants into one family page", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?category_id=pubg_mobile_auto")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "pubg_mobile_auto", name: "PUBG Mobile (Auto)", fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [{ offer_id: "auto", name: "60 UC", price_usd: "1.00" }] }) };
      if (url.includes("/offers?category_id=pubg_mobile_fast")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "pubg_mobile_fast", name: "PUBG Mobile (Fast)", fields: [{ key: "player_id", label: "Player ID", type: "text" }], offers: [{ offer_id: "fast", name: "120 UC", price_usd: "2.00" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "pubg_mobile_auto", name: "PUBG Mobile (Auto)" }, { category_id: "pubg_mobile_fast", name: "PUBG Mobile (Fast)" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    const result = await fetchProviderGameDetails("pubg_mobile");
    expect(result).toMatchObject({ status: "ready", game: { id: "pubg_mobile", name: "PUBG Mobile" } });
    if (result.status === "ready") expect(result.packages.map((item) => item.id)).toEqual([providerPackageRecordId("pubg_mobile_auto", "auto"), providerPackageRecordId("pubg_mobile_fast", "fast")]);
  });

  it("returns authorized package UI for an admin preview without submitting a player identity", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "preview-only-game", name: "Preview Only Game" }], meta: { next_cursor: null, has_more: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "preview-only-game", name: "Preview Only Game", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "starter", name: "Starter Pack", price_usd: "1.25" }] }) }));

    await expect(fetchProviderPreviewPackages("preview-only-game")).resolves.toEqual({ status: "ready", packages: [{ id: providerPackageRecordId("preview-only-game", "starter"), label: "Starter Pack", amountLabel: "Starter Pack", priceLabel: "$1.25", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
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

  it("reports supported PUBG Mobile and Blood Strike checks as unavailable when their authorized bridge is not configured", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn());
    for (const gameId of ["pubg_mobile_auto", "blood_strike"]) {
      await expect(validateProviderPlayerIdentity({ gameId, fields: { user_id: "12345678" } })).resolves.toEqual({ status: "unavailable", playerName: null, playerId: null, region: null });
    }
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports malformed supported-game IDs as invalid instead of rendering the unsupported confirmation state", async () => {
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
    vi.stubGlobal("fetch", vi.fn());

    for (const [gameId, fields] of [
      ["pubg_mobile_auto", { player_id: "626" }],
      ["blood_strike", { user_id: "abc" }],
      ["honor_of_kings", { player_id: "12" }],
      ["magic_chess_gogo_global", { user_id: "12345678" }],
    ] as const) {
      await expect(validateProviderPlayerIdentity({ gameId, fields })).resolves.toEqual({ status: "invalid", playerName: null, playerId: null, region: null });
    }
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

  it("treats a malformed successful Free Fire response without a username as invalid", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, game: "Garena Free Fire" }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "free_fire_my_sg", fields: { player_id: "12345678" } })).resolves.toEqual({ status: "invalid", playerName: null, playerId: null, region: null });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
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

  it("reveals a genuinely unsupported approved category package list only after explicit ID confirmation", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "eafc_mobile_kh", name: "EAFC Mobile", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "starter", name: "Starter Pack", price_usd: "1.25" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "eafc_mobile_kh", name: "EAFC Mobile" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    await expect(fetchProviderPackages({ gameId: "eafc_mobile_kh", fields: { user_id: "123456" }, idAccuracyConfirmed: true })).resolves.toEqual({ status: "ready", packages: [{ id: providerPackageRecordId("eafc_mobile_kh", "starter"), label: "Starter Pack", amountLabel: "Starter Pack", priceLabel: "$1.25", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.every(([url]) => !String(url).includes("validate-id"))).toBe(true);
  });

  it("reveals packages for a provider form with no ID-style field without making an identity request", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("/offers?")) return { ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "8_ball_pool", name: "8 Ball Pool", fields: [{ key: "email", label: "Email", type: "text" }], offers: [{ offer_id: "starter", name: "Starter Pack", price_usd: "1.25" }] }) };
      return { ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "8_ball_pool", name: "8 Ball Pool" }], meta: { next_cursor: null, has_more: false } }) };
    }));

    await expect(fetchProviderPackages({ gameId: "8_ball_pool", fields: { email: "customer@example.test" } })).resolves.toMatchObject({ status: "ready", packages: [{ id: providerPackageRecordId("8_ball_pool", "starter") }] });
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

  it("uses the authorized bridge for Honor of Kings without exposing its server credential", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-server-only-key";
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, username: "Verified HOK Player" }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "honor_of_kings", fields: { player_id: "8329784098348463649" } });

    expect(result).toEqual({ status: "verified", playerName: "Verified HOK Player", playerId: "8329784098348463649", region: "Global" });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(String(call?.[0])).toBe("https://bridge.example.test/api/check-player");
    expect(String((call?.[1] as RequestInit).body)).toContain('"game":"honor-of-kings"');
    expect(JSON.stringify(result)).not.toContain("bridge-secret-for-test-only");
  });

  it("uses the authorized bridge for PUBG Mobile and Blood Strike player-name checks", async () => {
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
    for (const [gameId, bridgeGame] of [["pubg_mobile_auto", "pubg-mobile"], ["blood_strike", "blood-strike"]] as const) {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, username: "Verified Bridge Player" }) }));
      await expect(validateProviderPlayerIdentity({ gameId, fields: { user_id: "12345678" } })).resolves.toMatchObject({ status: "verified", playerName: "Verified Bridge Player", playerId: "12345678" });
      const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(String((call?.[1] as RequestInit).body)).toContain(`"game":"${bridgeGame}"`);
      vi.unstubAllGlobals();
    }
  });

  it("accepts the existing server-only bridge-key alias for PUBG Mobile during secure key-name migration", async () => {
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_KEY = "legacy-server-only-bridge-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, username: "Verified Bridge Player" }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "pubg_mobile_auto", fields: { user_id: "12345678" } });
    const call = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];

    expect(result).toMatchObject({ status: "verified", playerName: "Verified Bridge Player" });
    expect(call?.[1]).toMatchObject({ headers: { "x-bridge-key": "legacy-server-only-bridge-key" } });
    expect(JSON.stringify(result)).not.toContain("legacy-server-only-bridge-key");
  });

  it("uses the authorized bridge for Magic Chess only after its free name check is temporarily unavailable", async () => {
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, username: "Verified Magic Chess Player" }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "magic_chess_gogo_global", fields: { user_id: "12345678", server_id: "123" } })).resolves.toMatchObject({ status: "verified", playerName: "Verified Magic Chess Player", playerId: "12345678" });
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(String(calls[0]?.[0])).toContain("/nickname/mcgg?");
    expect(String((calls[1]?.[1] as RequestInit).body)).toContain('"game":"magic-chess"');
    expect(String((calls[1]?.[1] as RequestInit).body)).toContain('"zoneId":"123"');
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

  it("uses the authorized HTTPS bridge for Mobile Legends only after the free check is unavailable", async () => {
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, username: "Verified Bridge Player" }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "verified", playerName: "Verified Bridge Player", playerId: "596323155", region: "Global" });
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(2);
    expect(String(calls[0]?.[0])).toContain("/nickname/ml?");
    expect(String(calls[1]?.[0])).toBe("https://bridge.example.test/api/check-player");
    expect(calls[1]?.[1]).toMatchObject({ method: "POST", headers: { "x-bridge-key": "bridge-secret-for-test-only" } });
  });

  (originalHerokuBridgeApiKey ? it : it.skip)("uses the configured server-only bridge secret without returning it to the caller", async () => {
    expect(originalHerokuBridgeApiKey).toBeTruthy();
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = originalHerokuBridgeApiKey;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ success: true, username: "Verified Bridge Player" }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } });
    const bridgeOptions = (fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[1] as RequestInit;

    expect(result).toMatchObject({ status: "verified", playerName: "Verified Bridge Player" });
    expect(bridgeOptions.headers).toMatchObject({ "x-bridge-key": originalHerokuBridgeApiKey });
    expect(JSON.stringify(result)).not.toContain(originalHerokuBridgeApiKey ?? "");
  });

  it("does not call the bridge after a definitive invalid free API result", async () => {
    process.env.HEROKU_BRIDGE_URL = "https://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: false }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "invalid", playerName: null, playerId: null, region: null });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("rejects an insecure bridge URL and preserves the free-provider unavailable status", async () => {
    process.env.HEROKU_BRIDGE_URL = "http://bridge.example.test";
    process.env.HEROKU_BRIDGE_API_KEY = "bridge-secret-for-test-only";
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
