export type ProviderNetworkRisk = "low" | "medium" | "high";

type ProviderDecision = {
  ip_analyses?: Array<{
    status?: string;
    is_vpn_or_tor?: boolean;
    is_data_center?: boolean;
    warnings?: Array<{ log_type?: string }>;
  }> | null;
};

export function deriveProviderNetworkRisk(decision: unknown): ProviderNetworkRisk | undefined {
  if (!decision || typeof decision !== "object") return undefined;
  const ipAnalysis = (decision as ProviderDecision).ip_analyses?.[0];
  if (!ipAnalysis) return undefined;
  const flags = ipAnalysis.warnings?.map((warning) => warning.log_type ?? "") ?? [];
  if (ipAnalysis.is_vpn_or_tor || ipAnalysis.is_data_center || flags.includes("PRIVATE_NETWORK_DETECTED")) return "high";
  if (ipAnalysis.status === "In Review" || ipAnalysis.status === "Declined") return "medium";
  return "low";
}
