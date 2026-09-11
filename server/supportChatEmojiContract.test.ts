import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { splitEmojiOnly, splitMessageParts, QUICK_EMOJIS } from "../client/src/components/AnimatedEmoji";

const chat = readFileSync(join(process.cwd(), "client/src/components/SupportChat.tsx"), "utf8");
const warmth = readFileSync(join(process.cwd(), "client/src/components/ChatWarmth.tsx"), "utf8");
const css = readFileSync(join(process.cwd(), "client/src/styles/zurs-support.css"), "utf8");

describe("support chat emoji warmth", () => {
  it("uses the same Lottie emoji language on every empty chat state", () => {
    expect(chat).toContain('ChatWarmth mood="signin"');
    expect(chat).toContain('ChatWarmth mood="welcome"');
    expect(chat).toContain('ChatWarmth mood="quota"');
    expect(chat).toContain('ChatWarmth mood="closed"');
    expect(warmth).toContain('hero: "👋"');
    expect(warmth).toContain('hero: "💬"');
    expect(warmth).toContain('hero: "🌙"');
    expect(warmth).toContain('hero: "🙏"');
    expect(warmth).toContain("WavingPerson");
    expect(warmth).toContain("person: true");
    expect(chat).toContain('emoji="👉"');
    expect(chat).toContain("VerifiedName");
    expect(chat).toContain("state.displayName");
    expect(chat).toContain('memberName || "ZURS Member"');
  });

  it("keeps a composer emoji tray and renders emoji-only messages as stickers", () => {
    expect(chat).toContain("QUICK_EMOJIS");
    expect(chat).toContain("splitEmojiOnly");
    expect(chat).toContain("zs-chat__emojiTray");
    expect(chat).toContain("<AnimatedEmoji emoji={emoji} size={30} />");
    expect(chat).toContain("splitMessageParts");
    expect(chat).toContain("MessageCopy");
    expect(QUICK_EMOJIS).toHaveLength(20);
    expect(css).toContain("grid-template-columns: repeat(5, minmax(0, 1fr))");
    expect(chat).toContain('href="/api/auth/google?returnTo=%2Fchat"');
    expect(css).toContain(".zs-chat__warmth");
    expect(css).toContain(".zs-chat__emojiTray");
    expect(css).toContain(".wave-person__arm");
    expect(css).toContain(".wave-person__sparkle");
    expect(css).toContain(".zs-chat__point");
    expect(css).toContain(".zurs-verified-name");
    expect(css).toContain(".zurs-verified-seal");
    const verified = readFileSync(join(process.cwd(), "client/src/components/VerifiedName.tsx"), "utf8");
    expect(verified).toContain("zurs-verified-seal");
    expect(verified).toContain("zurs-verified-seal__ring");
    expect(verified).toContain("zurs-verified-seal__face");
    expect(verified).not.toContain('name="verified"');
    expect(verified).not.toContain('emoji="🤩"');
    expect(verified).toContain("#2aabee");
    expect(css).toContain("zurs-verified-spin");
    expect(css).toContain("zurs-verified-laugh");
    const account = readFileSync(join(process.cwd(), "client/src/pages/Account.tsx"), "utf8");
    expect(account).toContain('emoji="👉"');
    expect(account).toContain("<VerifiedName name={name}");
    const routes = readFileSync(join(process.cwd(), "server/supportChatRoutes.ts"), "utf8");
    expect(routes).toContain("displayName: actor.displayName");
  });

  it("treats a sampeah or wave as an emoji-only sticker", () => {
    expect(splitEmojiOnly("🙏")).toEqual(["🙏"]);
    expect(splitEmojiOnly("👋✨")).toEqual(["👋", "✨"]);
    expect(splitEmojiOnly("សួស្តី")).toBeNull();
    expect(splitEmojiOnly("Hello b ❤️")).toBeNull();
    expect(splitMessageParts("Hello b ❤️").map((part) => part.type)).toEqual(["text", "emoji"]);
    expect(splitMessageParts("😂")).toEqual([{ type: "emoji", value: "😂" }]);
  });
});
