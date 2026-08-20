import { describe, expect, it } from "vitest";
import { deriveProviderNetworkRisk } from "./providerNetworkRisk";

describe("provider network risk", () => {
  it("routes a signed VPN or hosting signal to review risk without treating it as a hard block", () => {
    expect(deriveProviderNetworkRisk({ ip_analyses: [{ status: "Approved", is_vpn_or_tor: true }] })).toBe("high");
    expect(deriveProviderNetworkRisk({ ip_analyses: [{ status: "Approved", is_data_center: true }] })).toBe("high");
    expect(deriveProviderNetworkRisk({ ip_analyses: [{ status: "Approved", is_vpn_or_tor: false, is_data_center: false }] })).toBe("low");
  });

  it("leaves the existing location-risk value unchanged when the provider has no IP analysis result", () => {
    expect(deriveProviderNetworkRisk({})).toBeUndefined();
    expect(deriveProviderNetworkRisk(null)).toBeUndefined();
  });
});
