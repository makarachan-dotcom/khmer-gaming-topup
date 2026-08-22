import { describe, expect, it } from "vitest";
import { hasProviderApprovedGameLogo } from "./ProviderGameIdentity";

describe("provider game identity", () => {
  it("accepts only secure provider-approved logo URLs", () => {
    expect(hasProviderApprovedGameLogo("https://provider.example/game.png")).toBe(true);
    expect(hasProviderApprovedGameLogo("http://provider.example/game.png")).toBe(false);
    expect(hasProviderApprovedGameLogo()).toBe(false);
  });
});
