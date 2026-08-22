import { afterEach, describe, expect, it, vi } from "vitest";
import { balanceSocialProviderServices, cachedPublicProviderGames, fetchProviderGameDetails, fetchProviderGames, fetchProviderPackages, fetchProviderPreviewPackages, fetchSmmProviderServices, getProviderAvailabilityCatalog, getProviderCatalogStatus, isThailandProviderProduct, submitSmmProviderOrder, validateProviderPlayerIdentity } from "./providerCatalog";

const originalEndpoint = process.env.FZR_CARDS_API_BASE_URL;
const originalApiKey = process.env.FZR_CARDS_API_KEY;
const originalSmmEndpoint = process.env.SMMGLOB_API_URL;
const originalSmmApiKey = process.env.SMMGLOB_API_KEY;
const originalNeferbyteApiKey = process.env.NEFERBYTE_API_KEY;
const originalRapidApiKey = process.env.RAPIDAPI_ID_GAME_CHECKER_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("shows the complete paginated FazerCards inventory only to admin while preserving legacy public games until they are added", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "legacy-game", name: "Legacy Game" }], meta: { next_cursor: "page-2", has_more: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "new-pubg", name: "PUBG Mobile" }], meta: { next_cursor: null, has_more: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "legacy-game", name: "Legacy Game" }], meta: { next_cursor: "page-2", has_more: true } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "new-pubg", name: "PUBG Mobile" }], meta: { next_cursor: null, has_more: false } }) }));

    await expect(fetchProviderGames()).resolves.toEqual({ status: "ready", games: [{ id: "legacy-game", name: "Legacy Game", region: "Global", provider: "FZR Cards", requiredFields: [] }] });
    await expect(getProviderAvailabilityCatalog()).resolves.toMatchObject({ games: [{ id: "legacy-game", isActive: true }, { id: "new-pubg", isActive: false }] });
  });

  it("returns provider-required fields and official game imagery only after a selected game is requested", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", items: [{ category_id: "acecraft", name: "Acecraft" }], meta: { next_cursor: null, has_more: false } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, kind: "topup", category_id: "acecraft", name: "Acecraft", imageurl: "https://cdn.example.test/acecraft.png", fields: [{ key: "user_id", label: "User ID", type: "text" }], offers: [{ offer_id: "80_diamonds", name: "80 Diamonds", price_usd: "0.9864" }] }) }));
    await expect(fetchProviderGameDetails("acecraft")).resolves.toEqual({ status: "ready", game: { id: "acecraft", name: "Acecraft", region: "Global", logoUrl: "https://cdn.example.test/acecraft.png", provider: "FZR Cards", requiredFields: [{ key: "user_id", label: "User ID", required: true, kind: "text" }] }, packages: [{ id: "acecraft:80_diamonds", label: "80 Diamonds", amountLabel: "80 Diamonds", priceLabel: "$0.99", provider: "FZR Cards", paymentMethods: ["khqr", "bank"] }] });
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

  it("uses the verified server-only RapidAPI route before an inactive Neferbyte alternative for Mobile Legends", async () => {
    process.env.FZR_CARDS_API_BASE_URL = "https://provider.example.test";
    process.env.FZR_CARDS_API_KEY = "server-only-key";
    process.env.NEFERBYTE_API_KEY = "neferbyte-server-only-key";
    process.env.RAPIDAPI_ID_GAME_CHECKER_KEY = "rapidapi-server-only-key";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 400 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: { username: "Verified Player" } }) }));
    const result = await validateProviderPlayerIdentity({ gameId: "mobile_legends_global", fields: { player_id: "596323155", server_id: "10085" } });
    expect(result).toEqual({ status: "verified", playerName: "Verified Player", playerId: "596323155", region: "Global" });
    expect((fetch as ReturnType<typeof vi.fn>).mock.calls[1]?.[0]).toContain("id-game-checker.p.rapidapi.com/mobile-legends");
    expect(JSON.stringify(result)).not.toContain("rapidapi-server-only-key");
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
