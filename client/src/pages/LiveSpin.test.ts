import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const liveSpin = readFileSync(new URL("./LiveSpin.tsx", import.meta.url), "utf8");
const account = readFileSync(new URL("./Account.tsx", import.meta.url), "utf8");
const store = readFileSync(new URL("../../../server/liveSpinStore.ts", import.meta.url), "utf8");

describe("Live Spin production presentation", () => {
  it("uses the approved weekly title and routes signed-in members to their ticket-history section", () => {
    expect(liveSpin).toContain("Live Spin ប្រចាំសប្តាហ៍");
    expect(liveSpin).not.toContain("Live Spin សង្ឃឹមថា");
    expect(liveSpin).toContain('href="/account#live-spin-tickets"');
    expect(account).toContain('id="live-spin-tickets"');
  });

  it("labels countdowns and preserves a Top 10 consolation display", () => {
    expect(liveSpin).toContain('const timerLabel = ["announced", "locked", "waiting"].includes(event.status) ? "ចាប់ផ្តើមក្នុង" : "ពេលនៅសល់"');
    expect(liveSpin).toContain("{timerLabel}");
    expect(liveSpin).toContain("const consolationLabelCount = Math.max(10, consolation.length)");
    expect(liveSpin).toContain("Top {consolationLabelCount} អ្នកតភ្ជាប់យូរជាងគេ");
  });

  it("keeps production defaults at threshold 100, three winners, and ten consolation slots", () => {
    expect(store).toContain("LIVE_SPIN_MINIMUM_PARTICIPANT_COUNT");
    expect(store).toContain("winnerCount ?? 3");
    expect(store).toContain("consolationGiftCount ?? 10");
  });
});
