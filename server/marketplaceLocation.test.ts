import { describe, expect, it } from "vitest";
import { deriveLocationRisk } from "./marketplaceLocation";

describe("marketplace location risk classification", () => {
  it("treats a precise browser location as low risk while avoiding an automatic block", () => {
    expect(deriveLocationRisk(20)).toBe("low");
    expect(deriveLocationRisk(1_000)).toBe("medium");
    expect(deriveLocationRisk(10_000)).toBe("high");
  });
});
