import { describe, expect, it } from "vitest";
import { smmPlatformFor } from "./smmPresentation";

describe("SMM provider presentation", () => {
  it("derives the visible platform from real provider category text", () => {
    expect(smmPlatformFor("Instagram Followers").label).toBe("Instagram");
    expect(smmPlatformFor("Telegram members").label).toBe("Telegram");
  });
});
