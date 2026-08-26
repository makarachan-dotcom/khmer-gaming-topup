import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("ZURS AI chat client contract", () => {
  it("exposes a shared open event without a client-side payment entry point", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/ZursAiChat.tsx"), "utf8");
    const events = readFileSync(resolve(process.cwd(), "client/src/lib/zursAiEvents.ts"), "utf8");
    expect(source).toContain("zurs:open-ai-chat");
    expect(events).toContain("zurs:open-ai-chat");
    expect(events).toContain("zurs:ai:open-intent");
    expect(source).toContain('location === "/ai"');
    expect(source).toContain('fetch("/api/ai/chat/stream"');
    expect(source).toContain("/^\\/topup\\/[a-zA-Z0-9_%.-]+$/");
    expect(source).not.toContain("wallet.beginTopup");
    expect(source).not.toContain("khqr");
  });
});
