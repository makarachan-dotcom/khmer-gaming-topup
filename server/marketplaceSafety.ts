export const fraudReportStatuses = ["received", "reviewing", "resolved", "closed"] as const;
export type FraudReportStatus = (typeof fraudReportStatuses)[number];

export const disclosureRequestStatuses = ["submitted", "under_review", "approved", "rejected"] as const;
export type DisclosureRequestStatus = (typeof disclosureRequestStatuses)[number];

export function canApproveMarketplaceVerification(locationCountry: string | null | undefined) {
  return locationCountry === "KH";
}

export function hasOnlyOwnedMarketplaceScreenshotKeys(keys: string[] | undefined, userId: number) {
  const prefix = `marketplace-listings-private/${userId}/`;
  return (keys ?? []).every((key) => key.startsWith(prefix));
}

export function buildEvidenceRetentionAuditReason(evidenceType: string, verificationId: string, reason: string) {
  return `Retention removal | evidence: ${evidenceType} | verification: ${verificationId} | reason: ${reason.trim()}`;
}
