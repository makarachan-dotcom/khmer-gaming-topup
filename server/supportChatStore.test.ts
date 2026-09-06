import { describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getDb: vi.fn(async () => null),
}));

import { supportKvRead, supportKvWrite } from "./supportChatStore";

describe("support chat shared storage", () => {
  it("does not pretend to persist when the shared MySQL store is unavailable", async () => {
    await expect(supportKvWrite("sc:sess:test", JSON.stringify({ id: "test" }), 60)).resolves.toBe(false);
    await expect(supportKvRead("sc:sess:test")).resolves.toBeNull();
  });
});
