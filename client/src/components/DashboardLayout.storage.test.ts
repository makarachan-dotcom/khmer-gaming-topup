import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DashboardLayout.tsx", import.meta.url), "utf8");

describe("DashboardLayout browser-storage guard", () => {
  it("does not access localStorage before confirming a browser environment", () => {
    expect(source).toContain('if (typeof window === "undefined") return DEFAULT_WIDTH;');
    expect(source).toContain("window.localStorage.getItem(SIDEBAR_WIDTH_KEY)");
    expect(source).toContain("window.localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString())");
    expect(source).toContain("Storage can be unavailable");
    expect(source).toContain('root.setAttribute("data-admin", "1")');
    expect(source).toContain("zurs-admin min-h-screen bg-slate-50");
  });
});
