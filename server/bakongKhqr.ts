import bakongKhqr from "bakong-khqr";
import QRCode from "qrcode";
import { getKhqrWorkerCredentials } from "./khqrWorkerSecrets";

const { BakongKHQR, IndividualInfo, khqrData } = bakongKhqr as any;
const apiBaseUrl = "https://api-bakong.nbc.gov.kh";
const zursLogoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";

type Currency = "USD" | "KHR";
export const khqrPaymentWindowMs = 5 * 60 * 1000;
type BakongConfig = { token: string; accountId: string; merchantName: string; merchantCity: string; merchantPhone: string; storeLabel: string };
type BakongResponse = { responseCode?: number; errorCode?: number; data?: { shortLink?: string; hash?: string; amount?: string | number; currency?: string; toAccountId?: string } };
export type BakongMerchantPreflightStatus = "verified" | "account_not_found" | "rejected" | "configuration_missing" | "unavailable";
const merchantPreflightCacheTtlMs = 60_000;
let merchantPreflightCache: { status: BakongMerchantPreflightStatus; checkedAt: number } | null = null;

function getConfig(): BakongConfig | null {
  const token = process.env.BAKONG_API_TOKEN?.trim();
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
}

function getCachedMerchantPreflight() {
  if (!merchantPreflightCache || Date.now() - merchantPreflightCache.checkedAt >= merchantPreflightCacheTtlMs) return null;
  return merchantPreflightCache.status;
}

function rememberMerchantPreflight(status: BakongMerchantPreflightStatus) {
  // Keep a short, process-local cache to avoid calling Bakong for every availability render.
  if (status !== "unavailable") merchantPreflightCache = { status, checkedAt: Date.now() };
  return status;
}

export async function getBakongPaymentReadiness() {
  if (!getConfig()) return { ready: false, reason: "automatic_payment_pending" as const };
  const status = getCachedMerchantPreflight() ?? await verifyBakongMerchantAccount();
  return status === "verified"
    ? { ready: true, reason: "ready" as const }
    : { ready: false, reason: "merchant_unverified" as const };
}

export async function verifyBakongMerchantAccount() {
  const config = getConfig();
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
  const config = getConfig();
  if (!config) throw new Error("Bakong KHQR is not configured");
  const amount = validAmount(input.amount);
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
  return { md5, qrImageDataUrl, deeplink, expiresAt: expiry };
}

export async function checkBakongKhqrPayment(input: { md5: string; expectedAmount: string; expectedCurrency: Currency; expectedMerchantAccountId?: string }) {
  const config = getConfig();
  if (!config) throw new Error("Bakong KHQR is not configured");
  const response = await fetch(`${apiBaseUrl}/v1/check_transaction_by_md5`, { method: "POST", headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ md5: input.md5 }) });
  const payload = await readBakongJson(response);
  if (!payload) return { status: "unavailable" as const };
  if (!response.ok || payload.responseCode !== 0 || !payload.data) return { status: payload.errorCode === 1 ? "unpaid" as const : "unavailable" as const };
  const matchesAmount = Math.abs(Number(payload.data.amount) - Number(input.expectedAmount)) < 0.00001;
  const matchesCurrency = payload.data.currency === input.expectedCurrency;
  const expectedMerchantAccountId = (input.expectedMerchantAccountId ?? config.accountId).trim().toLowerCase();
  // The private stored MD5 plus exact amount and currency are mandatory. Bakong
  // may omit the optional receiver field; when it is supplied, it must match.
  const returnedReceiver = payload.data.toAccountId?.trim().toLowerCase();
  const matchesReceiver = !returnedReceiver || returnedReceiver === expectedMerchantAccountId;
  if (!matchesAmount || !matchesCurrency || !matchesReceiver || !payload.data.hash) return { status: "unavailable" as const, reason: "bakong_transaction_did_not_match_stored_session" };
  return { status: "paid" as const, transactionHash: payload.data.hash };
}

export async function registerBakongKhqrWorkerWatch(input: { md5: string; orderId: string; amount: string; currency: Currency }) {
  const baseUrl = process.env.KHQR_WORKER_URL?.replace(/\/$/, "");
  const { apiKey } = getKhqrWorkerCredentials();
  const callbackUrl = process.env.KHQR_WORKER_CALLBACK_URL || "https://www.zurs.me/api/webhooks/khqr-worker";
  if (!baseUrl?.startsWith("https://") || !apiKey || !callbackUrl.startsWith("https://")) throw new Error("KHQR automation worker is not configured.");
  const response = await fetch(`${baseUrl}/api/payments/watch`, { method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": apiKey }, body: JSON.stringify({ ...input, callbackUrl }), signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error("KHQR automation worker rejected the payment watch request.");
  const result = await response.json() as { ok?: boolean };
  if (!result.ok) throw new Error("KHQR automation worker did not accept the payment watch request.");
}
