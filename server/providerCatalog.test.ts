import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { balanceSocialProviderServices, cachedPublicProviderGames, fetchProviderGameDetails, fetchProviderGames, fetchProviderPackages, fetchProviderPreviewPackages, fetchSmmProviderServices, getProviderAvailabilityCatalog, getProviderCatalogStatus, isThailandProviderProduct, submitSmmProviderOrder, validateProviderPlayerIdentity } from "./providerCatalog";

const originalEndpoint = process.env.FZR_CARDS_API_BASE_URL;
const originalApiKey = process.env.FZR_CARDS_API_KEY;
const originalSmmEndpoint = process.env.SMMGLOB_API_URL;
const originalSmmApiKey = process.env.SMMGLOB_API_KEY;
const originalNeferbyteApiKey = process.env.NEFERBYTE_API_KEY;
const originalRapidApiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
const originalWorkerUrl = process.env.VPS_WORKER_URL;
const originalWorkerSecret = process.env.WORKER_SECRET;

beforeEach(() => {
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

  it("returns provider-required fields and official game imagery only after a selected game is requested", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "acecraft", name: "Acecraft" }], meta: { next_cursor: null, has_more: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "acecraft", name: "Acecraft", imageurl: "https://cdn.example.test/acecraft.png", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "80_diamonds", name: "80 Diamonds", price_usd: "0.9864" }] }) }));
    await expect(fetchProviderGameDetails("acecraft", { includeInactive: true })).resolves.toEqual({ status: "ready", game: { id: "acecraft", name: "Acecraft", region: "Global", logoUrl: "https://cdn.example.test/acecraft.png", provider: "FZR Cards", requiredFields: [{ key: "user_id", label: "User ID", required: true, kind: "text" }] }, packages: [{ id: "acecraft:80_diamonds", label: "80 Diamonds", amountLabel: "80 Diamonds", priceLabel: "$0.99", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
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

  it("validates a player name only through the server-side FZR endpoint", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, category_id: "mobile-legends", valid: true, player_name: "ZURS Member", player_id: "123456", region: "Indonesia" }) }));
    const result = await validateProviderPlayerIdentity({ gameId: "mobile-legends", fields: { player_id: "123456", zone_id: "4567" } });
    expect(result).toEqual({ status: "verified", playerName: "ZURS Member", playerId: "123456", region: "Indonesia" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(JSON.stringify(result)).not.toContain("server-only-key");
  });

  it("requires a verified player name before revealing provider packages", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, category_id: "mobile-legends", valid: false, player_name: null }) }));
    await expect(fetchProviderPackages({ gameId: "mobile-legends", fields: { player_id: "not-valid" } })).resolves.toEqual({ status: "verification_required", packages: [] });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("keeps an unsupported provider category locked until a username can be verified", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 400 }));
    await expect(fetchProviderPackages({ gameId: "acecraft", fields: { user_id: "123456" } })).resolves.toEqual({ status: "verification_required", packages: [] });
  });

  it("keeps Mobile Legends packages gated when FZR reports that name validation is unavailable for its exact category", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    delete process.env.NEFERBYTE_API_KEY;
    delete process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "unavailable", playerName: null, playerId: null, region: null });
    await expect(fetchProviderPackages({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "unavailable", packages: [] });
  });

  it("rotates once from RapidAPI to the configured Neferbyte fallback for Mobile Legends name checks only", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    process.env.NEFERBYTE_API_KEY = "neferbyte-server-only-key";
    process.env.RAPIDAPI_ID_GAME_CHECKER_KEY = "rapidapi-server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false, msg: "temporarily unavailable" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { username: "Verified Player" } }) }));
    const result = await validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } });
    expect(result).toEqual({ status: "verified", playerName: "Verified Player", playerId: "596323155", region: "Global" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain("id-game-checker.p.rapidapi.com/mobile-legends");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[2]?.[0]).toContain("api.neferbyte.com/game-id-checker/mobile-legends");
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(3);
    expect(JSON.stringify(result)).not.toContain("rapidapi-server-only-key");
  });

  it("uses the server-only VPS Worker as a bounded Mobile Legends fallback without changing catalog or payment calls", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-server-only-key";
    process.env.VPS_WORKER_URL = "https://worker.example.test/api/check-id";
    process.env.WORKER_SECRET = "worker-server-only-secret";
    delete process.env.NEFERBYTE_API_KEY;
    delete process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, username: "Verified Worker Player", userId: "596323155", zoneId: "10085", game: "mobilelegend", status: "valid" }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } });

    expect(result).toEqual({ status: "verified", playerName: "Verified Worker Player", playerId: "596323155", region: "Global" });
    const workerCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(workerCall?.[0]).toBe("https://worker.example.test/api/check-id");
    expect(workerCall?.[1]).toMatchObject({ method: "POST", headers: { authorization: "Bearer worker-server-only-secret", "content-type": "application/json" } });
    expect(JSON.parse(String(workerCall?.[1]?.body))).toEqual({ game: "mobilelegend", id: "596323155", serverId: "10085" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain("worker-server-only-secret");
  });

  it("uses the VPS Worker for supported Honor of Kings ID validation after FZR declines the category", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "provider-server-only-key";
    process.env.VPS_WORKER_URL = "https://worker.example.test/api/check-id";
    process.env.WORKER_SECRET = "worker-server-only-secret";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, username: "Verified Honor Player", userId: "8329784098348463649", game: "honor-of-kings", status: "valid" }) }));

    const result = await validateProviderPlayerIdentity({ gameId: "honor_of_kings", fields: { player_id: "8329784098348463649" } });

    expect(result).toEqual({ status: "verified", playerName: "Verified Honor Player", playerId: "8329784098348463649", region: "Global" });
    const workerCall = (fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(JSON.parse(String(workerCall?.[1]?.body))).toEqual({ game: "honor-of-kings", id: "8329784098348463649", serverId: "" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(2);
  });

  it("stops after the finite authorized fallback chain without changing catalog or payment behavior", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    process.env.NEFERBYTE_API_KEY = "neferbyte-server-only-key";
    process.env.RAPIDAPI_ID_GAME_CHECKER_KEY = "rapidapi-server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false }) })
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ success: false }) }));

    await expect(validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } })).resolves.toEqual({ status: "unavailable", playerName: null, playerId: null, region: null });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(4);
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
