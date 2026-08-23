import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWelcomeEmail,
  decryptRefreshToken,
  encryptRefreshToken,
} from "./gmailWelcome";

describe("Gmail welcome email safeguards", () => {
  beforeEach(() =>
    vi.stubEnv("JWT_SECRET", "unit-test-gmail-encryption-secret")
  );
  afterEach(() => vi.unstubAllEnvs());

  it("round-trips the owner refresh token through authenticated encryption", () => {
    const token = "google-refresh-token-for-test";
    const encrypted = encryptRefreshToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptRefreshToken(encrypted)).toBe(token);
  });

  it("builds a logo-branded welcome message without injecting a recipient name as HTML", () => {
    const message = buildWelcomeEmail({
      recipientName: "<script>alert(1)</script>",
      recipientEmail: "member@example.com",
      senderEmail: "chanmakara672@gmail.com",
    });
    const raw = Buffer.from(message.raw, "base64url").toString("utf8");
    const encodedBody = raw.split("\r\n\r\n")[1];
    const decodedBody = Buffer.from(encodedBody, "base64").toString("utf8");
    expect(raw).toContain("ZURS STORE");
    expect(decodedBody).toContain("files.manuscdn.com");
    expect(decodedBody).not.toContain("<script>alert(1)</script>");
    expect(raw).toContain("Subject: =?UTF-8?B?");
    expect(raw).toContain("Content-Transfer-Encoding: base64");
    expect(decodedBody).toContain("សូមស្វាគមន៍");
  });
});
