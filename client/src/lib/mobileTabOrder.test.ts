import { describe, expect, it } from "vitest";
import { moveTab, parseMobileTabOrder, tabIndexFromClientX, tabShiftX } from "./mobileTabOrder";

describe("mobile tab order", () => {
  it("fills missing tabs and drops unknown hrefs", () => {
    expect(parseMobileTabOrder(null)).toEqual(["/", "/topup", "/account"]);
    expect(parseMobileTabOrder('["/account","/"]')).toEqual(["/account", "/", "/topup"]);
    expect(parseMobileTabOrder('["/live-spin","/account"]')).toEqual(["/account", "/", "/topup"]);
  });

  it("moves a tab left or right without losing items", () => {
    expect(moveTab(["/", "/topup", "/account"], 0, 2)).toEqual(["/topup", "/account", "/"]);
    expect(moveTab(["/", "/topup", "/account"], 2, 0)).toEqual(["/account", "/", "/topup"]);
    expect(moveTab(["/", "/topup", "/account"], 1, 1)).toEqual(["/", "/topup", "/account"]);
  });

  it("maps a finger position to a slot and slides neighbors out of the way", () => {
    const rect = { left: 0, width: 300 };
    expect(tabIndexFromClientX(20, rect, 3)).toBe(0);
    expect(tabIndexFromClientX(150, rect, 3)).toBe(1);
    expect(tabIndexFromClientX(290, rect, 3)).toBe(2);
    expect(tabShiftX(0, 2, 0, 100)).toBe(100);
    expect(tabShiftX(1, 0, 2, 100)).toBe(-100);
    expect(tabShiftX(0, 0, 2, 100)).toBe(0);
  });
});
