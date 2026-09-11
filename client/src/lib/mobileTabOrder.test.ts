import { describe, expect, it } from "vitest";
import { tabIndexFromClientX, tabProgressFromClientX } from "./mobileTabOrder";

describe("mobile tab scrub", () => {
  it("maps a finger position to a tab slot", () => {
    const rect = { left: 0, width: 300 };
    expect(tabIndexFromClientX(20, rect, 3)).toBe(0);
    expect(tabIndexFromClientX(150, rect, 3)).toBe(1);
    expect(tabIndexFromClientX(290, rect, 3)).toBe(2);
  });

  it("tracks the thumb smoothly between slots", () => {
    const rect = { left: 0, width: 300 };
    expect(tabProgressFromClientX(50, rect, 3)).toBeCloseTo(0, 5);
    expect(tabProgressFromClientX(150, rect, 3)).toBeCloseTo(1, 5);
    expect(tabProgressFromClientX(250, rect, 3)).toBeCloseTo(2, 5);
    expect(tabProgressFromClientX(-20, rect, 3)).toBe(0);
    expect(tabProgressFromClientX(400, rect, 3)).toBe(2);
  });
});
