import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

function diditStatus(path: string, apiKey: string) {
  const output = execFileSync("curl", ["-sS", "--connect-timeout", "10", "--max-time", "15", "-o", "/dev/null", "-w", "%{http_code}", "-H", `x-api-key: ${apiKey}`, `https://verification.didit.me${path}`], { encoding: "utf8" });
  return Number(output.trim());
}

describe("Didit KYC configuration", () => {
  it("accepts the configured server-side API key on the sessions endpoint", async () => {
    const apiKey = process.env.DIDIT_API_KEY;
    expect(apiKey).toBeTruthy();
    const status = diditStatus("/v3/session/?limit=1", apiKey!);
    expect(status, `Didit rejected the configured key with HTTP ${status}`).not.toBe(401);
    expect(status, `Didit rejected the configured key with HTTP ${status}`).not.toBe(403);
  }, 15_000);

  it("resolves the configured hosted KYC workflow", async () => {
    const apiKey = process.env.DIDIT_API_KEY; const workflowId = process.env.DIDIT_WORKFLOW_ID;
    expect(workflowId).toMatch(/^[0-9a-f-]{20,}$/i);
    const status = diditStatus(`/v3/workflows/${workflowId}/`, apiKey!);
    expect(status, `Didit workflow validation failed with HTTP ${status}`).toBe(200);
  }, 15_000);

  it("has a webhook signing secret while the provider connection remains authenticated", () => {
    expect(process.env.DIDIT_WEBHOOK_SECRET).toBeTruthy();
    const status = diditStatus("/v3/session/?limit=1", process.env.DIDIT_API_KEY!);
    expect(status).not.toBe(401);
    expect(status).not.toBe(403);
  }, 15_000);
});
