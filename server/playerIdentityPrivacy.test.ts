import { describe, expect, it } from "vitest";
import { toPublicPlayerIdentityResponse } from "./playerIdentityPrivacy";

describe("public player identity response", () => {
  it("returns only the verified display details required by the customer form", () => {
    const response = toPublicPlayerIdentityResponse({
      status: "verified",
      playerName: "Verified Player",
      playerId: "596323155",
      region: "Global",
    });

    expect(response).toEqual({ status: "verified", playerName: "Verified Player", region: "Global" });
    expect(JSON.stringify(response)).not.toContain("596323155");
    expect(Object.keys(response)).not.toContain("playerId");
  });

  it("does not expose identity details for non-verified outcomes", () => {
    expect(toPublicPlayerIdentityResponse({ status: "unavailable", playerName: null, playerId: null, region: null })).toEqual({
      status: "unavailable",
      playerName: null,
      region: null,
    });
  });
});
