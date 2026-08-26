import { describe, expect, it } from "vitest";
import { buildSafeEventSearchQuery, buildZursAiSystemPrompt, containsThaiScript, consumeZursAiRateLimit, normalizeZursAiMessages, selectZursAiModel, ZursAiInputError } from "./zursAi";

describe("ZURS AI safety policy", () => {
  it("uses a fast model for ordinary requests and quality model for comparisons", () => {
    expect(selectZursAiModel("តម្លៃ MLBB មានប៉ុន្មាន?").kind).toBe("fast");
    expect(selectZursAiModel("ប្រៀបធៀបកញ្ចប់ MLBB ដែលសមបំផុត").kind).toBe("quality");
  });

  it("quietly rejects messages containing Thai script", () => {
    expect(containsThaiScript("ทดสอบ")).toBe(true);
    expect(() => normalizeZursAiMessages([{ role: "user", content: "ทดสอบ" }])).toThrow(ZursAiInputError);
  });

  it("rejects oversized, HTML-like, or overlong history input before it reaches a provider", () => {
    expect(() => normalizeZursAiMessages([{ role: "user", content: "x".repeat(801) }])).toThrow(ZursAiInputError);
    expect(() => normalizeZursAiMessages([{ role: "user", content: "<script>test</script>" }])).toThrow(ZursAiInputError);
    expect(() => normalizeZursAiMessages(Array.from({ length: 9 }, () => ({ role: "user" as const, content: "hello" })))).toThrow(ZursAiInputError);
  });

  it("keeps payment and privacy prohibitions in the server-only system prompt", () => {
    const prompt = buildZursAiSystemPrompt("Available game catalog names: Mobile Legends", []);
    expect(prompt).toContain("Never create, alter, confirm, or verify an order");
    expect(prompt).toContain("Payment Control is currently OFF");
    expect(prompt).toContain("Do not request passwords");
    expect(prompt).toContain("Ticket area in their account");
    expect(prompt).toContain("Current safe catalog context");
  });

  it("does not couple its chat adapter to wallet, orders, or KHQR modules", () => {
    const source = require("node:fs").readFileSync(require("node:path").resolve(process.cwd(), "server/zursAi.ts"), "utf8");
    expect(source).not.toContain('from "./db"');
    expect(source).not.toContain("./bakongKhqr");
    expect(source).not.toContain("./khqrWorker");
  });

  it("uses an allowlisted game keyword rather than forwarding a raw customer event message to search", () => {
    expect(buildSafeEventSearchQuery("Mobile Legends event for 012345678 and name Sokha")).toBe("mobile legends event update");
    expect(buildSafeEventSearchQuery("ព្រឹត្តិការណ៍ថ្មី សូមទាក់ទងខ្ញុំ 012345678")).toBe("game event update");
  });
});
