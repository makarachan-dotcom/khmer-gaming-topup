import bakongKhqr from "bakong-khqr";
import QRCode from "qrcode";
import { getKhqrWorkerCredentials } from "./khqrWorkerSecrets";
import { resolveProviderCredential } from "./providerCredentialResolver";
import { bakongPaidAmountMatches, normalizeBakongCurrency } from "./paymentSecurity";

const { BakongKHQR, IndividualInfo, khqrData } = bakongKhqr as any;
const apiBaseUrl = "https://api-bakong.nbc.gov.kh";
const zursLogoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";

type Currency = "USD" | "KHR";
export const khqrPaymentWindowMs = 5 * 60 * 1000;
type BakongConfig = { token: string; accountId: string; merchantName: string; merchantCity: string; merchantPhone: string; storeLabel: string };
type BakongResponse = { responseCode?: number; errorCode?: number; data?: { shortLink?: string; hash?: string; token?: string; amount?: string | number; currency?: string | number; toAccountId?: string; transactionHash?: string; txnHash?: string } };
export type BakongMerchantPreflightStatus = "verified" | "account_not_found" | "rejected" | "configuration_missing" | "unavailable";
const merchantPreflightCacheTtlMs = 60_000;
const tokenCacheTtlMs = 50 * 60 * 1000;
let merchantPreflightCache: { status: BakongMerchantPreflightStatus; checkedAt: number } | null = null;
let accessTokenCache: { token: string; at: number } | null = null;

async function getBakongAccessToken(forceRenew = false): Promise<string | null> {
  if (!forceRenew && accessTokenCache && Date.now() - accessTokenCache.at < tokenCacheTtlMs) return accessTokenCache.token;
  const envToken = await resolveProviderCredential("bakong", process.env.BAKONG_API_TOKEN);
  if (!forceRenew && envToken) return envToken;
  const email = process.env.BAKONG_REGISTERED_EMAIL?.trim();
  if (email) {
    try {
      const response = await fetch(`${apiBaseUrl}/v1/renew_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        signal: AbortSignal.timeout(10_000),
      });
      const payload = await readBakongJson(response);
      const token = typeof payload?.data?.token === "string" ? payload.data.token.trim() : "";
      if (payload?.responseCode === 0 && token) {
        accessTokenCache = { token, at: Date.now() };
        return token;
      }
    } catch {
      /* Fall through to the deployment token. */
    }
  }
  return envToken ?? null;
}

function transactionHashFrom(data: NonNullable<BakongResponse["data"]> | undefined) {
  return [data?.hash, data?.transactionHash, data?.txnHash].find((value) => typeof value === "string" && value.trim().length >= 8)?.trim();
}

async function lookupBakongMd5(token: string, md5: string) {
  return fetch(`${apiBaseUrl}/v1/check_transaction_by_md5`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ md5 }),
    signal: AbortSignal.timeout(10_000),
  });
}

async function getConfig(): Promise<BakongConfig | null> {
  const token = await resolveProviderCredential("bakong", process.env.BAKONG_API_TOKEN);
  const accountId = process.env.BAKONG_ACCOUNT_ID?.trim();
  const merchantName = process.env.BAKONG_MERCHANT_NAME?.trim();
  const merchantCity = process.env.BAKONG_MERCHANT_CITY?.trim();
  const merchantPhone = process.env.BAKONG_MERCHANT_PHONE?.trim();
  const storeLabel = process.env.BAKONG_STORE_LABEL?.trim();
  if (!token || !accountId || !merchantName || !merchantCity || !merchantPhone || !storeLabel) return null;
  return { token, accountId, merchantName, merchantCity, merchantPhone, storeLabel };
}

export function resetBakongMerchantPreflightCache() {
  merchantPreflightCache = null;
  accessTokenCache = null;
}

function getCachedMerchantPreflight() {
  if (!merchantPreflightCache || Date.now() - merchantPreflightCache.checkedAt >= merchantPreflightCacheTtlMs) return null;
  return merchantPreflightCache.status;
}

function rememberMerchantPreflight(status: BakongMerchantPreflightStatus) {
  if (status !== "unavailable") merchantPreflightCache = { status, checkedAt: Date.now() };
  return status;
}

export async function getBakongPaymentReadiness() {
  if (!(await getConfig())) return { ready: false, reason: "automatic_payment_pending" as const };
  const status = getCachedMerchantPreflight() ?? await verifyBakongMerchantAccount();
  return status === "verified"
    ? { ready: true, reason: "ready" as const }
    : { ready: false, reason: "merchant_unverified" as const };
}

export async function verifyBakongMerchantAccount() {
  const config = await getConfig();
  if (!config) return rememberMerchantPreflight("configuration_missing");
  try {
    const response = await fetch(`${apiBaseUrl}/v1/check_bakong_account`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: config.accountId }),
      signal: AbortSignal.timeout(10_000),
    });
    const payload = await readBakongJson(response);
    if (response.ok && payload?.responseCode === 0) return rememberMerchantPreflight("verified");
    if (response.ok && payload?.responseCode === 1 && payload.errorCode === 11) return rememberMerchantPreflight("account_not_found");
    if (response.ok && payload?.responseCode === 1) return rememberMerchantPreflight("rejected");
    return rememberMerchantPreflight("unavailable");
  } catch {
    return rememberMerchantPreflight("unavailable");
  }
}

function currencyCode(currency: Currency) { return currency === "KHR" ? khqrData.currency.khr : khqrData.currency.usd; }
function validAmount(amount: string) { const value = Number(amount); if (!Number.isFinite(value) || value <= 0) throw new Error("Invalid payment amount"); return value; }

async function readBakongJson(response: Response): Promise<BakongResponse | null> {
  const body = await response.text().catch(() => "");
  if (!body.trim() || /^\s*</.test(body)) return null;
  try { return JSON.parse(body) as BakongResponse; } catch { return null; }
}

export async function createBakongKhqrPayment(input: { trackingCode: string; amount: string; currency: Currency }) {
  const config = await getConfig();
  if (!config) throw new Error("Bakong KHQR is not configured");
  const amount = validAmount(input.amount);
  // Keep QR validity aligned with the worker's five-minute automatic-check window.
  const expiry = new Date(Date.now() + khqrPaymentWindowMs);
  const info = new IndividualInfo(config.accountId, config.merchantName, config.merchantCity, {
    currency: currencyCode(input.currency), amount, mobileNumber: config.merchantPhone, billNumber: input.trackingCode.slice(0, 35), storeLabel: config.storeLabel, terminalLabel: "ZURS", expirationTimestamp: expiry.getTime(),
  });
  const generated = new BakongKHQR().generateIndividual(info);
  const qr = generated?.data?.qr as string | undefined;
  const md5 = generated?.data?.md5 as string | undefined;
  if (!qr || !md5) throw new Error("Bakong KHQR payload could not be created");
  const qrImageDataUrl = await QRCode.toDataURL(qr, { errorCorrectionLevel: "M", margin: 1, width: 560, color: { dark: "#121429", light: "#ffffff" } });
  let deeplink: string | null = null;
  try {
    const response = await fetch(`${apiBaseUrl}/v1/generate_deeplink_by_qr`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ qr, sourceInfo: { appIconUrl: zursLogoUrl, appName: "ZURS STORE", appDeepLinkCallback: "https://khmergame-girzfgts.manus.space/order-status" } }) });
    const payload = await readBakongJson(response);
    if (response.ok && payload?.responseCode === 0 && payload.data?.shortLink) deeplink = payload.data.shortLink;
  } catch { /* A scannable KHQR remains available if the optional deeplink service is unavailable. */ }
  return { md5, qrImageDataUrl, deeplink, expiresAt: expiry, merchantAccountId: config.accountId };
}

export async function checkBakongKhqrPayment(input: { md5: string; expectedAmount: string; expectedCurrency: Currency; expectedMerchantAccountId?: string }) {
  const config = await getConfig();
  if (!config) throw new Error("Bakong KHQR is not configured");
  let token = await getBakongAccessToken(false) ?? config.token;
  let response = await lookupBakongMd5(token, input.md5);
  let payload = await readBakongJson(response);
  if (response.status === 401 || payload?.errorCode === 6) {
    token = await getBakongAccessToken(true) ?? config.token;
    response = await lookupBakongMd5(token, input.md5);
    payload = await readBakongJson(response);
  }
  if (!payload) return { status: "unavailable" as const, reason: "empty_or_malformed_bakong_response" };
  if (!response.ok || payload.responseCode !== 0 || !payload.data) return { status: payload.responseCode === 1 || payload.errorCode === 17 ? "unpaid" as const : "unavailable" as const, reason: `bakong_response_${payload.responseCode ?? "unknown"}_${payload.errorCode ?? "unknown"}` };
  const data = payload.data;
  const actualCurrency = normalizeBakongCurrency(data.currency);
  const transactionHash = transactionHashFrom(data);
  const amountPresent = data.amount !== undefined && data.amount !== null && String(data.amount).trim() !== "";
  const matchesAmount = !amountPresent || (actualCurrency != null && bakongPaidAmountMatches({
    expectedAmount: input.expectedAmount,
    expectedCurrency: input.expectedCurrency,
    actualAmount: data.amount as string | number,
    actualCurrency,
  }));
  const matchesCurrency = !amountPresent || actualCurrency != null;
  const expectedMerchantAccountId = (input.expectedMerchantAccountId ?? config.accountId).trim().toLowerCase();
  const returnedReceiver = data.toAccountId?.trim().toLowerCase();
  // The MD5 is computed from our QR (account + amount). A receiver-field alias
  // from Bakong must not strand a real payment that already hit the merchant.
  const matchesReceiver = !returnedReceiver || returnedReceiver === expectedMerchantAccountId || Boolean(transactionHash);
  if (!matchesAmount || !matchesCurrency || !matchesReceiver || !transactionHash) return { status: "unavailable" as const, reason: "bakong_transaction_did_not_match_stored_session" };
  return { status: "paid" as const, transactionHash };
}

export async function registerBakongKhqrWorkerWatch(input: { md5: string; orderId: string; amount: string; currency: Currency; expiresAt: Date }) {
  const baseUrl = process.env.KHQR_WORKER_URL?.replace(/\/$/, "");
  const { apiKey } = getKhqrWorkerCredentials();
  const callbackUrl = process.env.KHQR_WORKER_CALLBACK_URL || "https://www.zurs.me/api/webhooks/bakong";
  if (!baseUrl?.startsWith("https://") || !apiKey || !callbackUrl.startsWith("https://")) throw new Error("KHQR automation worker is not configured.");
  const response = await fetch(`${baseUrl}/api/track-payment`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey }, body: JSON.stringify({ md5: input.md5, orderId: input.orderId, amount: input.amount, currency: input.currency, expiresAt: input.expiresAt.toISOString(), callbackUrl }), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("KHQR automation worker rejected the payment watch request.");
  const result = await response.json() as { ok?: boolean };
  if (!result.ok) throw new Error("KHQR automation worker did not accept the payment watch request.");
}
