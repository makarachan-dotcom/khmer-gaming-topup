import { getDb } from "./server/db.ts";
import { walletTopups } from "./drizzle/schema.ts";
import { eq } from "drizzle-orm";

const db = await getDb();
if (!db) throw new Error("Primary ledger is unavailable");
const record = (await db.select().from(walletTopups).where(eq(walletTopups.id, "Qox2sXivhliVO_oeTUfBk")).limit(1))[0];
const md5 = record?.paymentPayload && typeof record.paymentPayload === "object" && typeof (record.paymentPayload as Record<string, unknown>).bakongMd5 === "string" ? (record.paymentPayload as Record<string, string>).bakongMd5 : null;
if (!md5) throw new Error("Payment reference unavailable");
const response = await fetch("https://api-bakong.nbc.gov.kh/v1/check_transaction_by_md5", { method: "POST", headers: { Authorization: `Bearer ${process.env.BAKONG_API_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ md5 }) });
const payload = await response.json().catch(() => null) as { responseCode?: number; errorCode?: number; data?: { amount?: string | number; currency?: string | number; hash?: string; toAccountId?: string } } | null;
console.log(JSON.stringify({ httpStatus: response.status, responseCode: payload?.responseCode ?? null, errorCode: payload?.errorCode ?? null, hasPaymentData: Boolean(payload?.data), amountMatches: Number(payload?.data?.amount) === Number(record.amountKhr), returnedCurrency: payload?.data?.currency ?? null, expectedCurrency: record.currency, hasTransactionHash: Boolean(payload?.data?.hash), receiverMatches: payload?.data?.toAccountId?.trim().toLowerCase() === process.env.BAKONG_ACCOUNT_ID?.trim().toLowerCase() }));
