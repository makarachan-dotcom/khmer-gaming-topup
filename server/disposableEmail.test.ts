import { describe, expect, it } from "vitest";
import { isDisposableEmail, parseLoginEmail } from "./disposableEmail";

describe("login email edge validation", () => {
  it("accepts a normal mailbox and rejects junk, CRLF, and oversized values", () => {
    expect(parseLoginEmail("Chan@Gmail.com")).toBe("chan@gmail.com");
    expect(parseLoginEmail("a@b.c")).toBe(null);
    expect(parseLoginEmail("not-an-email")).toBe(null);
    expect(parseLoginEmail("user@domain\r\ninjected@evil.com")).toBe(null);
    expect(parseLoginEmail(`${"a".repeat(300)}@gmail.com`)).toBe(null);
    expect(parseLoginEmail(" user@zurs.me ")).toBe("user@zurs.me");
  });

  it("flags well-known disposable inboxes", () => {
    expect(isDisposableEmail("victim@mailinator.com")).toBe(true);
    expect(isDisposableEmail("x@yopmail.com")).toBe(true);
    expect(isDisposableEmail("chan@gmail.com")).toBe(false);
    expect(isDisposableEmail("shop@zurs.me")).toBe(false);
  });
});
