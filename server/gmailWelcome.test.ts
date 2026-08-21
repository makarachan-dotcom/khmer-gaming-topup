import { describe, expect, it } from "vitest";
import { buildWelcomeEmail, decryptRefreshToken, encryptRefreshToken } from "./gmailWelcome";

describe("Gmail welcome email safeguards", () => {
  it("round-trips the owner refresh token through authenticated encryption", () => {
    const token = "google-refresh-token-for-test";
    const encrypted = encryptRefreshToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptRefreshToken(encrypted)).toBe(token);
  });

  it("builds a logo-branded welcome message without injecting a recipient name as HTML", () => {
    const message = buildWelcomeEmail({ recipientName: "<script>alert(1)</script>", recipientEmail: "member@example.com", senderEmail: "chanmakara672@gmail.com" });
    const raw = Buffer.from(message.raw, "base64url").toString("utf8");
    expect(raw).toContain("ZURS STORE");
    expect(raw).toContain("files.manuscdn.com");
    expect(raw).not.toContain("<script>alert(1)</script>");
  });
});
