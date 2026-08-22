import { describe, expect, it } from "vitest";
import { gameIdFromTopupPath, gameTopupPath } from "./GameTopup";

describe("dedicated game top-up routes", () => {
  it("creates and reads an encoded provider game route", () => {
    const path = gameTopupPath("mobile legends/global");
    expect(path).toBe("/topup/mobile%20legends%2Fglobal");
    expect(gameIdFromTopupPath(path)).toBe("mobile legends/global");
  });

  it("rejects paths that do not contain a game identifier", () => {
    expect(gameIdFromTopupPath("/topup")).toBe("");
    expect(gameIdFromTopupPath("/smm")).toBe("");
  });
});
