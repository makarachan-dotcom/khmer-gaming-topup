import { describe, expect, it } from "vitest";
import { buildOrderNumber, isSingleAdminEmail, isTerminalOrderStatus } from "./storefrontDomain";

describe("storefront domain rules", () => {
  it("only authorizes the designated administrator email", () => {
    expect(isSingleAdminEmail("chanmakara672@gmail.com")).toBe(true);
    expect(isSingleAdminEmail(" CHANMAKARA672@GMAIL.COM ")).toBe(true);
    expect(isSingleAdminEmail("other@example.com")).toBe(false);
    expect(isSingleAdminEmail(undefined)).toBe(false);
  });

  it("creates a stable, identifiable order number", () => {
    expect(buildOrderNumber(1724155200000, "ab12")).toBe("TK-55200000-AB12");
  });

  it("identifies only terminal order states", () => {
    expect(isTerminalOrderStatus("delivered")).toBe(true);
    expect(isTerminalOrderStatus("expired")).toBe(true);
    expect(isTerminalOrderStatus("paid")).toBe(false);
    expect(isTerminalOrderStatus("pending")).toBe(false);
  });
});
