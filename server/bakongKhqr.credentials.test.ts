import { describe, expect, it } from "vitest";
import { resetBakongMerchantPreflightCache, verifyBakongMerchantAccount } from "./bakongKhqr";

const credentialsAvailable = Boolean(
  process.env.BAKONG_API_TOKEN &&
  process.env.BAKONG_ACCOUNT_ID &&
  process.env.BAKONG_MERCHANT_NAME &&
  process.env.BAKONG_MERCHANT_CITY &&
  process.env.BAKONG_MERCHANT_PHONE &&
  process.env.BAKONG_STORE_LABEL,
);
const liveSmokeRequested = process.env.RUN_LIVE_BAKONG_CREDENTIAL_SMOKE_TEST === "1";

describe("Bakong configured merchant credentials", () => {
  const credentialTest = credentialsAvailable && liveSmokeRequested ? it : it.skip;

  credentialTest("receives a successful lightweight merchant preflight response", async () => {
    const response = await fetch("https://api-bakong.nbc.gov.kh/v1/check_bakong_account", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.BAKONG_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountId: process.env.BAKONG_ACCOUNT_ID }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await response.json().catch(() => null) as { responseCode?: number; errorCode?: number } | null;

    expect({
      http: response.status,
      responseCode: payload?.responseCode ?? null,
      errorCode: payload?.errorCode ?? null,
    }).toMatchObject({ http: 200, responseCode: 0 });
  }, 15_000);

  credentialTest("verifies the configured merchant account without exposing credential values", async () => {
    resetBakongMerchantPreflightCache();
    await expect(verifyBakongMerchantAccount()).resolves.toBe("verified");
  }, 15_000);
});
