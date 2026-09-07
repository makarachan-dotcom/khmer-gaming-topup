import { describe, expect, it } from "vitest";
import { resolvePartnerCopy, resolveDeliveryType } from "./partnerCopy";
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

  it("rebrands supplier copy as ZURS.me", () => {
    const copy = resolvePartnerCopy(product({
      name: "GGSoma ChatGPT Plus",
      description: "Sold on https://ggsoma.store/chatgpt by ggsoma",
      instructions: "Open ggsoma.store to redeem",
    }));
    expect(copy.nameEn).toBe("ZURS.me ChatGPT Plus");
    expect(copy.descriptionEn).not.toMatch(/ggsoma/i);
    expect(copy.descriptionEn).toContain("zurs.me");
    expect(copy.instructionsEn).toContain("zurs.me");
    expect(copy.descriptionKh).not.toMatch(/ggsoma/i);
  });
});

describe("delivery type from product data", () => {
  it("treats CDK products as CDK even when the catalog says coupon", () => {
    expect(resolveDeliveryType({ apiType: "COUPON", name: "ChatGPT Pro X20 CDK FW" })).toBe("CDK");
    expect(resolveDeliveryType({ apiType: "COUPON", name: "Claude Pro CDK" })).toBe("CDK");
    expect(resolveDeliveryType({ apiType: "CDK", name: "Canva Pro 12m" })).toBe("CDK");
  });

  it("keeps coupon, link, and account types when the name matches", () => {
    expect(resolveDeliveryType({ apiType: "COUPON", name: "Spotify Premium Coupon 3 Month" })).toBe("COUPON");
    expect(resolveDeliveryType({ apiType: "COUPON", name: "Canva Pro Invite Link 12m" })).toBe("LINK");
    expect(resolveDeliveryType({ apiType: "COUPON", name: "Netflix 4K Private" })).toBe("READY_ACCOUNT");
    expect(resolveDeliveryType({ apiType: "LINK", name: "CapCut Pro 1 Year" })).toBe("LINK");
  });
});
