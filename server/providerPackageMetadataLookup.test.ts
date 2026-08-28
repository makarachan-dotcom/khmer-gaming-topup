import { describe, expect, it } from "vitest";
import { providerFamilyMetadataPrefix } from "./db";

describe("provider package metadata lookup", () => {
  it("includes regional provider records when a combined storefront game is open", () => {
    expect(providerFamilyMetadataPrefix("mobile_legends")).toBe("mobile_legends_%");
    expect(providerFamilyMetadataPrefix("free_fire")).toBe("free_fire_%");
    expect(providerFamilyMetadataPrefix("pubg_mobile")).toBe("pubg_mobile_%");
  });

  it("keeps a regional game lookup exact so one catalog cannot leak into another", () => {
    expect(providerFamilyMetadataPrefix("mobile_legends_global")).toBeNull();
    expect(providerFamilyMetadataPrefix("free_fire_my_sg")).toBeNull();
    expect(providerFamilyMetadataPrefix("honor_of_kings")).toBeNull();
  });
});
