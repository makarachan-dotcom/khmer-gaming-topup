type DiditSessionResponse = { session_id: string; url: string; status: string };

function getDiditConfig() {
  const apiKey = process.env.DIDIT_API_KEY; const workflowId = process.env.DIDIT_WORKFLOW_ID;
  if (!apiKey || !workflowId) throw new Error("Identity verification is not configured");
  return { apiKey, workflowId };
}

export async function createDiditHostedSession(input: { vendorData: string; verificationId: string }) {
  const { apiKey, workflowId } = getDiditConfig();
  const response = await fetch("https://verification.didit.me/v3/session/", { method: "POST", headers: { "x-api-key": apiKey, "content-type": "application/json" }, body: JSON.stringify({ workflow_id: workflowId, vendor_data: input.vendorData, metadata: { marketplace_verification_id: input.verificationId, purpose: "zurs-marketplace-seller-verification" }, callback_method: "both" }), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Unable to start identity verification");
  const data = await response.json() as DiditSessionResponse;
  if (!data.session_id || !data.url) throw new Error("Identity provider returned an incomplete session");
  return data;
}
