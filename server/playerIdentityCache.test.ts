import { describe, expect, it, vi, afterEach } from "vitest";

vi.mock("./providerCatalog", () => ({
  validateProviderPlayerIdentity: vi.fn(async (input: { gameId: string; fields: Record<string, string> }) => ({
    status: "verified",
    playerName: "Cached",
    playerId: input.fields.player_id ?? null,
    region: "KH",
  })),
}));

import { validateProviderPlayerIdentity } from "./providerCatalog";
import { cachedValidateProviderPlayerIdentity, playerIdentityCacheKey, resetPlayerIdentityCacheForTests } from "./playerIdentityCache";

afterEach(() => {
  resetPlayerIdentityCacheForTests();
  vi.mocked(validateProviderPlayerIdentity).mockClear();
});

describe("player identity cache", () => {
  it("hashes the same player the same way regardless of field order", () => {
    expect(playerIdentityCacheKey({ gameId: "ml", fields: { player_id: "1", server_id: "2" } })).toBe(
      playerIdentityCacheKey({ gameId: "ml", fields: { server_id: "2", player_id: "1" } }),
    );
  });

  it("calls the provider once for a repeated lookup", async () => {
    const input = { gameId: "free_fire", fields: { player_id: "1665022166" } };
    await cachedValidateProviderPlayerIdentity(input);
    await cachedValidateProviderPlayerIdentity(input);
    expect(validateProviderPlayerIdentity).toHaveBeenCalledTimes(1);
  });
});
