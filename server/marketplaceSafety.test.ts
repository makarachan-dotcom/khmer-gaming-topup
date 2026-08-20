import { describe, expect, it } from "vitest";
import { buildEvidenceRetentionAuditReason, canApproveMarketplaceVerification, disclosureRequestStatuses, fraudReportStatuses, hasOnlyOwnedMarketplaceScreenshotKeys } from "./marketplaceSafety";

describe("marketplace safety rules", () => {
  it("allows verification approval only for Cambodia-eligible records", () => {
    expect(canApproveMarketplaceVerification("KH")).toBe(true);
    expect(canApproveMarketplaceVerification("TH")).toBe(false);
    expect(canApproveMarketplaceVerification(null)).toBe(false);
  });

  it("keeps the administrator case-status vocabularies closed and explicit", () => {
    expect(fraudReportStatuses).toEqual(["received", "reviewing", "resolved", "closed"]);
    expect(disclosureRequestStatuses).toEqual(["submitted", "under_review", "approved", "rejected"]);
  });

  it("accepts only owner-scoped private screenshot references for a new listing", () => {
    expect(hasOnlyOwnedMarketplaceScreenshotKeys(["marketplace-listings-private/42/proof-a.webp"], 42)).toBe(true);
    expect(hasOnlyOwnedMarketplaceScreenshotKeys(["marketplace-listings-private/17/proof-a.webp"], 42)).toBe(false);
    expect(hasOnlyOwnedMarketplaceScreenshotKeys(["https://example.test/raw-public-image.webp"], 42)).toBe(false);
  });

  it("makes retention-review audit notes self-describing after a reference is removed", () => {
    expect(buildEvidenceRetentionAuditReason("national_id_front", "verification-1", "Retention period reached")).toContain("evidence: national_id_front");
    expect(buildEvidenceRetentionAuditReason("national_id_front", "verification-1", "Retention period reached")).toContain("verification: verification-1");
  });
});
