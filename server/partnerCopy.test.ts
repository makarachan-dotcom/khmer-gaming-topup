import { describe, expect, it } from "vitest";
import { resolvePartnerCopy } from "./partnerCopy";
import type { PartnerProduct } from "../shared/partnerService";

function product(over: Partial<PartnerProduct> = {}): PartnerProduct {
  return {
    id: 1,
    slug: "chatgpt-plus",
    productCode: "gpt",
    name: "ChatGPT Plus 1 Month",
    provider: { id: 1, key: "chatgpt", name: "ChatGPT" },
    emoji: "✨",
    deliveryType: "COUPON",
    currency: "USD",
    priceUsd: "10.00",
    durationDays: 30,
    warranty: { enabled: true, days: 7 },
    stock: { inStock: true, count: 3, maxQuantity: 3 },
    bulkTiers: [],
    description: "long english dump from provider",
    instructions: "long english how-to",
    updatedAt: null,
    ...over,
  };
}

describe("partner bilingual copy", () => {
  it("keeps the full provider text and a Khmer lead-in", () => {
    const copy = resolvePartnerCopy(product());
    expect(copy.descriptionKh).toContain("ChatGPT");
    expect(copy.descriptionKh).toContain("Coupon");
    expect(copy.descriptionKh).toContain("long english dump from provider");
    expect(copy.descriptionEn).toBe("long english dump from provider");
    expect(copy.instructionsKh).toContain("លេខកូដ");
    expect(copy.instructionsEn).toContain("long english how-to");
  });

  it("uses admin overrides when provided", () => {
    const copy = resolvePartnerCopy(product(), { descriptionKh: "ខ្ញុំកែហើយ", descriptionEn: "Edited EN", instructionsKh: "ប្រើកូដ", nameKh: "ឈ្មោះខ្មែរ" });
    expect(copy.descriptionKh).toBe("ខ្ញុំកែហើយ");
    expect(copy.descriptionEn).toBe("Edited EN");
    expect(copy.nameKh).toBe("ឈ្មោះខ្មែរ");
  });
});
