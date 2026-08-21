import { describe, expect, it } from "vitest";
import { isAppwriteStoreConfigured } from "./appwriteStore";

describe("Appwrite user store", () => {
  it("uses server-only Appwrite credentials when they are available", () => {
    expect(isAppwriteStoreConfigured()).toBe(true);
  });
});
