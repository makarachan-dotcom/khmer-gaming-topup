import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { fzrIdempotencyKey, readSubmittedProviderOrderIds, topupOrderQuantity } from "./topupFulfillment";

describe("stacked weekly fulfillment", () => {
  it("clamps quantity and resumes from already submitted provider ids", () => {
    expect(topupOrderQuantity({ quantity: 2 })).toBe(2);
    expect(topupOrderQuantity({})).toBe(1);
    expect(topupOrderQuantity({ quantity: 99 })).toBe(9);
    expect(readSubmittedProviderOrderIds({ providerOrderId: "fzr-1" })).toEqual(["fzr-1"]);
    expect(readSubmittedProviderOrderIds({ providerOrderIds: ["fzr-1", "fzr-2"], providerOrderId: "fzr-2" })).toEqual(["fzr-1", "fzr-2"]);
    expect(fzrIdempotencyKey("ord1", 0, 1)).toBe("zurs-ord1");
    expect(fzrIdempotencyKey("ord1", 0, 2)).toBe("zurs-ord1-0");
    expect(fzrIdempotencyKey("ord1", 1, 2)).toBe("zurs-ord1-1");
  });

  it("posts the same FZR weekly offer once per purchased week", () => {
    const db = readFileSync(resolve(process.cwd(), "server/db.ts"), "utf8");
    const fulfill = db.slice(db.indexOf("export async function fulfillTopupOrder"), db.indexOf("export async function updateOrderStatus"));
    expect(fulfill).toContain("topupOrderQuantity(details)");
    expect(fulfill).toContain("for (let i = start; i < quantity; i++)");
    expect(fulfill).toContain("submitFzrTopupOrder");
    expect(fulfill).toContain("fzrIdempotencyKey(orderId, i, quantity)");
    expect(fulfill).toContain("providerOrderIds");
  });
});
