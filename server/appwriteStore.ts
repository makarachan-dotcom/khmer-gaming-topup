import crypto from "node:crypto";
import type { InsertUser, User } from "../drizzle/schema";
import { isSingleAdminEmail } from "./storefrontDomain";

type AppwriteRecord = { $id: string; sourceTable: string; sourceId: string; payload: string; sourceUpdatedAt?: string | null };
type AppwriteList = { documents?: AppwriteRecord[]; total?: number };
type AppwriteOrder = { id: string; userId: number; orderNumber: string; orderType: "topup" | "smm"; status: string; currency: string; subtotal: string; productName: string; details: unknown; createdAt: Date; updatedAt: Date };
type AppwritePayment = { id: string; orderId: string; provider: string; status: string; amount: string; currency: string; createdAt: Date; updatedAt: Date; paidAt: Date | null; orderNumber: string; productName: string; orderStatus: string };

const databaseId = () => process.env.APPWRITE_DATABASE_ID || "zurs_store";
const collectionId = "zurs_records";

function config() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  return endpoint && projectId && apiKey ? { endpoint, projectId, apiKey } : null;
}

function documentId(value: string) { return crypto.createHash("sha256").update(value).digest("hex").slice(0, 32); }
function userId(openId: string) { return 1_000_000_000 + parseInt(documentId(openId).slice(0, 7), 16); }
function asDate(value: unknown) { return value ? new Date(String(value)) : new Date(); }

export function isAppwriteStoreConfigured() { return Boolean(config()); }

export function shouldRetryAppwriteCreateAsUpdate(error: unknown) {
  return error instanceof Error && error.message.includes("HTTP 409");
}

async function request(method: string, path: string, body?: unknown) {
  const current = config();
  if (!current) return null;
  const response = await fetch(`${current.endpoint}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": current.projectId, "X-Appwrite-Key": current.apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Appwrite user store request failed with HTTP ${response.status}`);
  return response.status === 204 ? {} : response.json();
}

function parsePayload<T>(record: AppwriteRecord): T | null { try { return JSON.parse(record.payload) as T; } catch { return null; } }

function toUser(record: AppwriteRecord): User | null {
  try {
    const payload = parsePayload<Partial<User>>(record);
    if (!payload) return null;
    if (!payload.openId || typeof payload.id !== "number") return null;
    return {
      id: payload.id,
      openId: payload.openId,
      name: payload.name ?? null,
      displayName: payload.displayName ?? null,
      email: payload.email ?? null,
      loginMethod: payload.loginMethod ?? null,
      role: isSingleAdminEmail(payload.email) || payload.role === "admin" ? "admin" : "user",
      createdAt: asDate(payload.createdAt),
      updatedAt: asDate(payload.updatedAt),
      lastSignedIn: asDate(payload.lastSignedIn),
    };
  } catch { return null; }
}

const RECORD_PAGE_SIZE = 100;

function userDocumentPath(openId: string) {
  return `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`users:${openId}`)}`;
}

async function allRecords() {
  const records: AppwriteRecord[] = [];
  for (let offset = 0; offset < 10_000; offset += RECORD_PAGE_SIZE) {
    const data = await request("GET", `/databases/${databaseId()}/collections/${collectionId}/documents?limit=${RECORD_PAGE_SIZE}&offset=${offset}&total=true`) as AppwriteList | null;
    const page = data?.documents ?? [];
    records.push(...page);
    if (!data || page.length < RECORD_PAGE_SIZE || (typeof data.total === "number" && records.length >= data.total)) break;
  }
  return records;
}

async function recordsFor(table: string) {
  return (await allRecords()).filter((record) => record.sourceTable === table);
}

async function allUserRecords() {
  return recordsFor("users");
}

async function getAppwriteUserRecordByOpenId(openId: string) {
  const record = await request("GET", userDocumentPath(openId)) as AppwriteRecord | null;
  return record && record.sourceTable === "users" && record.sourceId === openId ? record : undefined;
}

export async function getAppwriteUserByOpenId(openId: string) {
  const record = await getAppwriteUserRecordByOpenId(openId);
  return record ? toUser(record) ?? undefined : undefined;
}

export async function getAppwriteUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const records = await allUserRecords();
  const users = records.map(toUser).filter((user): user is User => user !== null);
  return users.find((user) => user.email?.trim().toLowerCase() === normalized);
}

export async function upsertAppwriteUser(input: InsertUser) {
  if (!input.openId) throw new Error("User openId is required for Appwrite upsert");
  const existing = await getAppwriteUserByOpenId(input.openId);
  const now = new Date();
  const email = input.email === undefined ? existing?.email ?? null : input.email?.trim().toLowerCase() ?? null;
  const user: User = {
    id: existing?.id ?? userId(input.openId),
    openId: input.openId,
    name: input.name === undefined ? existing?.name ?? null : input.name,
    displayName: existing?.displayName ?? null,
    email,
    loginMethod: input.loginMethod === undefined ? existing?.loginMethod ?? null : input.loginMethod,
    role: isSingleAdminEmail(email) ? "admin" : "user",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    lastSignedIn: input.lastSignedIn ?? now,
  };
  const sourceId = input.openId;
  const body = { data: { sourceTable: "users", sourceId, payload: JSON.stringify(user), sourceUpdatedAt: user.updatedAt.toISOString() } };
  const path = userDocumentPath(sourceId);
  if (existing) await request("PUT", path, body);
  else {
    try {
      await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`users:${sourceId}`), ...body });
    } catch (error) {
      if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error;
      await request("PUT", path, body);
    }
  }
  return user;
}

export async function updateAppwriteUserDisplayName(input: { openId: string; displayName: string }) {
  const record = await getAppwriteUserRecordByOpenId(input.openId);
  const current = record ? toUser(record) : null;
  if (!record || !current) throw new Error("Your member profile could not be found. Please sign in again.");
  const updated: User = { ...current, displayName: input.displayName, updatedAt: new Date() };
  await request("PUT", userDocumentPath(input.openId), { data: { sourceTable: "users", sourceId: record.sourceId, payload: JSON.stringify(updated), sourceUpdatedAt: updated.updatedAt.toISOString() } });
  return { displayName: input.displayName };
}

function toOrder(record: AppwriteRecord): AppwriteOrder | null {
  const value = parsePayload<Partial<AppwriteOrder>>(record);
  if (!value || typeof value.id !== "string" || typeof value.userId !== "number" || typeof value.orderNumber !== "string") return null;
  return { id: value.id, userId: value.userId, orderNumber: value.orderNumber, orderType: value.orderType === "smm" ? "smm" : "topup", status: String(value.status ?? "pending"), currency: String(value.currency ?? "USD"), subtotal: String(value.subtotal ?? "0"), productName: String(value.productName ?? "ZURS order"), details: value.details ?? {}, createdAt: asDate(value.createdAt), updatedAt: asDate(value.updatedAt) };
}

function toPayment(record: AppwriteRecord, ordersById: Map<string, AppwriteOrder>): AppwritePayment | null {
  const value = parsePayload<Partial<AppwritePayment>>(record);
  if (!value || typeof value.id !== "string" || typeof value.orderId !== "string") return null;
  const order = ordersById.get(value.orderId);
  if (!order) return null;
  return { id: value.id, orderId: value.orderId, provider: String(value.provider ?? "payment"), status: String(value.status ?? "pending"), amount: String(value.amount ?? "0"), currency: String(value.currency ?? order.currency ?? "USD"), createdAt: asDate(value.createdAt), updatedAt: asDate(value.updatedAt), paidAt: value.paidAt ? asDate(value.paidAt) : null, orderNumber: order.orderNumber, productName: order.productName, orderStatus: order.status };
}

export async function getAppwriteCustomerOrders(userId: number) {
  const orders = (await recordsFor("orders")).map(toOrder).filter((order): order is AppwriteOrder => order?.userId === userId);
  return orders.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export async function getAppwriteCustomerPaymentHistory(userId: number) {
  const orders = await getAppwriteCustomerOrders(userId);
  const ordersById = new Map(orders.map((order) => [order.id, order]));
  const payments = (await recordsFor("payment_transactions")).map((record) => toPayment(record, ordersById)).filter((payment): payment is AppwritePayment => payment !== null);
  return payments.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}
