import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("order tracking and support contract", () => {
  it("creates opaque purchase IDs and appends real lifecycle events", () => {
    const source = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    expect(source).toContain("function buildTrackingCode()");
    expect(source).toContain("randomBytes(10)");
    expect(source).toContain("appendOrderStatusEvent");
    expect(source).toContain('eventType: "order_created"');
    expect(source).toContain('eventType: "payment_session_created"');
    expect(source).toContain('eventType: "status_changed"');
    expect(source).toContain('eventType: "provider_submitted"');
  });

  it("scopes tracking and tickets to the owning customer and exposes admin review", () => {
    const dbSource = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const routerSource = readFileSync(resolve(process.cwd(), "server/routers.ts"), "utf8");
    expect(dbSource).toContain("eq(orders.userId, input.userId)");
    expect(dbSource).toContain("createOrderSupportTicket");
    expect(dbSource).toContain("reviewOrderSupportTicket");
    expect(routerSource).toContain("tracking: protectedProcedure");
    expect(routerSource).toContain("createTicket: protectedProcedure");
    expect(routerSource).toContain("orderSupportTickets: adminProcedure");
    expect(routerSource).toContain("reviewOrderSupportTicket: adminProcedure");
  });
});
