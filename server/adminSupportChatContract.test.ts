import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin support chat reply path", () => {
  it("registers the operator inbox route and a reply endpoint the console posts to", () => {
    const app = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf8");
    const page = readFileSync(join(process.cwd(), "client/src/pages/AdminSupportChat.tsx"), "utf8");
    const routes = readFileSync(join(process.cwd(), "server/supportChatRoutes.ts"), "utf8");
    const nav = readFileSync(join(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");

    expect(app).toContain('path="/admin/support-chat"');
    expect(app).toContain("AdminSupportChat");
    expect(nav).toContain('path: "/admin/support-chat"');
    expect(page).toContain('request("/api/admin/support/reply"');
    expect(page).toContain("sessionId: chat.id");
    expect(routes).toContain('app.post("/api/admin/support/reply"');
    expect(routes).toContain('appendMessage({ sessionId: session.id, role: "admin"');
    expect(routes).toContain("requireSupportAdmin");
  });
});
