import { describe, expect, it } from "vitest";
import { describeDevice } from "./deviceInsight";

/*
 * These assertions are about the admin ban table being *readable*. An operator
 * deciding whether to release a lockout needs "Samsung Galaxy A15 · Android ·
 * Chrome", not a 140-character User-Agent string.
 *
 * Client Hints are preferred where the browser sends them, because the model is
 * explicit there; the User-Agent fallback is a best-effort parse and is only
 * ever used for display.
 */

describe("describeDevice", () => {
  it("prefers the Client Hints model over the User-Agent guess", () => {
    const insight = describeDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A155F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
      model: "SM-A155F",
      platform: "Android",
      platformVersion: "14",
    });

    expect(insight.kind).toBe("phone");
    expect(insight.model).toContain("Samsung");
    expect(insight.label).toContain("Samsung");
  });

  it("recognises the common Cambodian Android vendors from the User-Agent alone", () => {
    const oppo = describeDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 13; CPH2467) AppleWebKit/537.36 Chrome/122.0.0.0 Mobile Safari/537.36",
      model: null,
      platform: null,
      platformVersion: null,
    });
    expect(oppo.model).toContain("OPPO");

    const xiaomi = describeDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 12; Redmi Note 11) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
      model: null,
      platform: null,
      platformVersion: null,
    });
    expect(xiaomi.model).toContain("Xiaomi");
  });

  it("identifies iPhone and desktop separately, because the ban table sorts by kind", () => {
    const iphone = describeDevice({
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
      model: null,
      platform: null,
      platformVersion: null,
    });
    expect(iphone.kind).toBe("phone");
    expect(iphone.os).toContain("iOS");

    const desktop = describeDevice({
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      model: null,
      platform: null,
      platformVersion: null,
    });
    expect(desktop.kind).toBe("desktop");
    expect(desktop.browser).toContain("Chrome");
  });

  it("never returns an empty label, so the admin table always has something to show", () => {
    const blank = describeDevice({ userAgent: null, model: null, platform: null, platformVersion: null });
    expect(blank.label.length).toBeGreaterThan(0);
    expect(blank.kind).toBe("unknown");
  });

  it("does not let a hostile User-Agent smuggle control characters into the label", () => {
    // The label is rendered in the admin UI and written to the report feed, so
    // it must stay printable no matter what the client sends.
    const hostile = describeDevice({
      userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A155F\n\r<script>alert(1)</script>)",
      model: "SM-A155F\u0000\u001b[31m",
      platform: "Android",
      platformVersion: "14",
    });

    expect(hostile.label).not.toContain("\n");
    expect(hostile.label).not.toContain("\r");
    expect(hostile.label).not.toContain("\u0000");
  });
});
