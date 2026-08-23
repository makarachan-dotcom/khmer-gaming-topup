import { afterEach, describe, expect, it, vi } from "vitest";
import { checkProviderGameIdViaZyte } from "./zyteGameIdChecker";

const originalZyteApiKey = process.env.ZYTE_API_KEY;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalZyteApiKey === undefined) delete process.env.ZYTE_API_KEY;
  else process.env.ZYTE_API_KEY = originalZyteApiKey;
});

function zyteBrowserHtml(value: { httpStatus: number; body?: string | null }) {
  return `<!doctype html><html><body><pre id="ncs-check-result">NCS:${encodeURIComponent(JSON.stringify(value))}</pre></body></html>`;
}

function zyteOkResponse(value: { httpStatus: number; body?: string | null }) {
  return { ok: true, json: async () => ({ statusCode: 200, browserHtml: zyteBrowserHtml(value) }) };
}

function ncsSuccessBody(username: string) {
  return JSON.stringify({ status: 1, data: { username } });
}

function ncsFailureBody(message = "USER ID nao existe") {
  return JSON.stringify({ status: 0, data: [], error_msg: message });
}

describe("nevercrystore Game ID checks through the owner-approved Zyte browser route", () => {
  it("reports games outside the approved map as not_supported without any network call", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkProviderGameIdViaZyte("blood_strike", { player_id: "123456" })).resolves.toEqual({ status: "not_supported" });
    await expect(checkProviderGameIdViaZyte("acecraft", { user_id: "123456" })).resolves.toEqual({ status: "not_supported" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stays unavailable without a configured Zyte credential and never performs a request", async () => {
    delete process.env.ZYTE_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkProviderGameIdViaZyte("mobile_legends_global", { player_id: "596323155", server_id: "10085" })).resolves.toEqual({ status: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects malformed ids before spending any Zyte credit", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkProviderGameIdViaZyte("mobile_legends_global", { player_id: "abc", server_id: "10085" })).resolves.toEqual({ status: "invalid" });
    await expect(checkProviderGameIdViaZyte("mobile_legends_global", { player_id: "596323155" })).resolves.toEqual({ status: "invalid" });
    await expect(checkProviderGameIdViaZyte("free_fire_my_sg", { player_id: "12" })).resolves.toEqual({ status: "invalid" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("verifies a Mobile Legends player through one browser evaluate round-trip", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn().mockResolvedValue(zyteOkResponse({ httpStatus: 200, body: ncsSuccessBody("ZURS Player") }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkProviderGameIdViaZyte("mobile_legends_global", { player_id: "596323155", server_id: "10085" });
    expect(result).toEqual({ status: "verified", playerName: "ZURS Player" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.zyte.com/v1/extract");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(String(init.body)) as { url: string; browserHtml: boolean; actions: Array<{ action: string; source: string }> };
    expect(payload.url).toBe("https://nevercrystore.com/game/mobile-legends-kh1");
    expect(payload.browserHtml).toBe(true);
    expect(payload.actions).toHaveLength(1);
    expect(payload.actions[0]?.source).toContain('form.set("category_id", "23")');
    expect(payload.actions[0]?.source).toContain('form.set("user_id", "596323155")');
    expect(payload.actions[0]?.source).toContain('form.set("server_id", "10085")');
    expect(payload.actions[0]?.source).not.toContain("zyte-server-only-key");
    expect(JSON.stringify(result)).not.toContain("zyte-server-only-key");
  });

  it("maps every owner-approved game family to its nevercrystore category and id shape", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn().mockResolvedValue(zyteOkResponse({ httpStatus: 200, body: ncsSuccessBody("Mapped Player") }));
    vi.stubGlobal("fetch", fetchMock);

    const cases: Array<{ gameId: string; fields: Record<string, string>; categoryId: string; idField: string; pageSlug: string }> = [
      { gameId: "magic_chess_gogo_global", fields: { user_id: "77889900", zone_id: "10127" }, categoryId: "25", idField: "user_id", pageSlug: "magic-chess-gogo" },
      { gameId: "free_fire_my_sg", fields: { player_id: "5099999999" }, categoryId: "21", idField: "player_id", pageSlug: "free-fire-sgmy" },
      { gameId: "pubg_mobile_fast", fields: { player_id: "5123456789" }, categoryId: "27", idField: "player_id", pageSlug: "pubg-mobile" },
      { gameId: "honor_of_kings", fields: { player_id: "9876543210" }, categoryId: "22", idField: "player_id", pageSlug: "honor-of-kings-1" },
    ];
    for (const entry of cases) {
      await expect(checkProviderGameIdViaZyte(entry.gameId, entry.fields)).resolves.toEqual({ status: "verified", playerName: "Mapped Player" });
      const payload = JSON.parse(String((fetchMock.mock.calls.at(-1) as [string, RequestInit])[1].body)) as { url: string; actions: Array<{ source: string }> };
      expect(payload.url).toBe(`https://nevercrystore.com/game/${entry.pageSlug}`);
      expect(payload.actions[0]?.source).toContain(`form.set("category_id", "${entry.categoryId}")`);
      expect(payload.actions[0]?.source).toContain(`form.set("${entry.idField}"`);
    }
    expect(fetchMock).toHaveBeenCalledTimes(cases.length);
  });

  it("returns invalid when nevercrystore reports the id does not exist", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(zyteOkResponse({ httpStatus: 200, body: ncsFailureBody() })));
    await expect(checkProviderGameIdViaZyte("pubg_mobile_auto", { player_id: "5123456789" })).resolves.toEqual({ status: "invalid" });
  });

  it("retries exactly once on a fresh browser session after a CSRF expiry (419)", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(zyteOkResponse({ httpStatus: 419, body: "" }))
      .mockResolvedValueOnce(zyteOkResponse({ httpStatus: 200, body: ncsSuccessBody("Retry Player") }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(checkProviderGameIdViaZyte("mobile_legends_promo", { player_id: "596323155", server_id: "10085" })).resolves.toEqual({ status: "verified", playerName: "Retry Player" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstSession = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as { sessionContext: Array<{ value: string }> };
    const secondSession = JSON.parse(String((fetchMock.mock.calls[1] as [string, RequestInit])[1].body)) as { sessionContext: Array<{ value: string }> };
    expect(secondSession.sessionContext[0]?.value).not.toBe(firstSession.sessionContext[0]?.value);
  });

  it("stays bounded and unavailable when Zyte itself keeps failing", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkProviderGameIdViaZyte("honor_of_kings", { player_id: "9876543210" })).resolves.toEqual({ status: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('"zyte-server-only-key"');
  });

  it("treats a missing in-page result node as unavailable after one bounded retry", async () => {
    process.env.ZYTE_API_KEY = "zyte-server-only-key";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ statusCode: 200, browserHtml: "<!doctype html><html><body>no result node</body></html>" }) });
    vi.stubGlobal("fetch", fetchMock);
    await expect(checkProviderGameIdViaZyte("free_fire_my_sg", { player_id: "5099999999" })).resolves.toEqual({ status: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
