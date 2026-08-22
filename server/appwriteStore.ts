import crypto from "node:crypto";
import { nanoid } from "nanoid";
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

export type AppwriteMarketplaceListingInput = {
  sellerUserId: number;
  listingType: "sale" | "swap" | "wanted";
  game: string;
  title: string;
  rankLevel: string;
  priceUsd?: string | null;
  description: string;
  contactMethod: string;
  telegramUsername?: string | null;
  screenshots?: string[];
};

export type AppwriteMarketplaceListing = AppwriteMarketplaceListingInput & {
  id: string;
  status: "draft" | "pending" | "approved" | "rejected" | "closed" | "sold";
  reviewNote?: string | null;
  reviewedByUserId?: number | null;
  reviewedAt?: Date | null;
  soldAt?: Date | null;
  cleanupAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AppwriteMarketplaceRecord = { record: AppwriteRecord; listing: AppwriteMarketplaceListing };

function toMarketplaceListing(record: AppwriteRecord): AppwriteMarketplaceListing | null {
  const value = parsePayload<Partial<AppwriteMarketplaceListing>>(record);
  if (!value || typeof value.id !== "string" || typeof value.sellerUserId !== "number" || typeof value.title !== "string") return null;
  const status = value.status;
  if (!status || !["draft", "pending", "approved", "rejected", "closed", "sold"].includes(status)) return null;
  return {
    id: value.id,
    sellerUserId: value.sellerUserId,
    listingType: value.listingType === "swap" || value.listingType === "wanted" ? value.listingType : "sale",
    status,
    game: String(value.game ?? "Unspecified game"),
    title: value.title,
    rankLevel: String(value.rankLevel ?? "Unspecified"),
    priceUsd: value.priceUsd ?? null,
    description: String(value.description ?? ""),
    contactMethod: String(value.contactMethod ?? "Not provided"),
    telegramUsername: value.telegramUsername ?? null,
    screenshots: Array.isArray(value.screenshots) ? value.screenshots.filter((key): key is string => typeof key === "string") : [],
    reviewNote: value.reviewNote ?? null,
    reviewedByUserId: typeof value.reviewedByUserId === "number" ? value.reviewedByUserId : null,
    reviewedAt: value.reviewedAt ? asDate(value.reviewedAt) : null,
    soldAt: value.soldAt ? asDate(value.soldAt) : null,
    cleanupAt: value.cleanupAt ? asDate(value.cleanupAt) : null,
    createdAt: asDate(value.createdAt),
    updatedAt: asDate(value.updatedAt),
  };
}

async function allAppwriteMarketplaceRecords() {
  return (await recordsFor("marketplaceListings")).map((record) => {
    const listing = toMarketplaceListing(record);
    return listing ? { record, listing } satisfies AppwriteMarketplaceRecord : null;
  }).filter((item): item is AppwriteMarketplaceRecord => item !== null);
}

export async function listAppwriteMarketplaceListings(status?: AppwriteMarketplaceListing["status"]) {
  const [listingRecords, userRecords] = await Promise.all([allAppwriteMarketplaceRecords(), allUserRecords()]);
  const sellers = new Map(userRecords.map(toUser).filter((user): user is User => user !== null).map((user) => [user.id, user]));
  return listingRecords
    .filter(({ listing }) => !status || listing.status === status)
    .sort((left, right) => right.listing.createdAt.getTime() - left.listing.createdAt.getTime())
    .map(({ listing }) => {
      const seller = sellers.get(listing.sellerUserId);
      return { listing, seller: seller ? { id: seller.id, name: seller.displayName ?? seller.name, email: seller.email } : null };
    });
}

export async function updateAppwriteMarketplaceListing(input: { listingId: string; status: AppwriteMarketplaceListing["status"]; reviewNote?: string | null; reviewerUserId: number }) {
  const item = (await allAppwriteMarketplaceRecords()).find(({ listing }) => listing.id === input.listingId);
  if (!item) throw new Error("Marketplace listing not found");
  const now = new Date();
  const updated: AppwriteMarketplaceListing = {
    ...item.listing,
    status: input.status,
    reviewNote: input.reviewNote?.trim() || null,
    reviewedByUserId: input.reviewerUserId,
    reviewedAt: now,
    updatedAt: now,
  };
  await request("PUT", `/databases/${databaseId()}/collections/${collectionId}/documents/${item.record.$id}`, {
    data: { sourceTable: "marketplaceListings", sourceId: updated.id, payload: JSON.stringify(updated), sourceUpdatedAt: now.toISOString() },
  });
  return { success: true };
}

export async function deleteAppwriteMarketplaceListing(listingId: string) {
  const item = (await allAppwriteMarketplaceRecords()).find(({ listing }) => listing.id === listingId);
  if (!item) throw new Error("Marketplace listing not found");
  await request("DELETE", `/databases/${databaseId()}/collections/${collectionId}/documents/${item.record.$id}`);
  return { success: true };
}

export async function createAppwriteMarketplaceListing(input: AppwriteMarketplaceListingInput) {
  if (!config()) throw new Error("Appwrite marketplace storage is unavailable");
  const now = new Date();
  const id = nanoid();
  const listing = {
    id,
    sellerUserId: input.sellerUserId,
    listingType: input.listingType,
    // Seller submissions are published immediately; administrators can still hold,
    // remove, or close any listing from the marketplace control panel.
    status: "approved" as const,
    game: input.game.trim(),
    title: input.title.trim(),
    rankLevel: input.rankLevel.trim(),
    priceUsd: input.priceUsd ?? null,
    description: input.description.trim(),
    contactMethod: input.contactMethod.trim(),
    telegramUsername: input.telegramUsername?.trim().replace(/^@/, "") || null,
    screenshots: input.screenshots ?? [],
    createdAt: now,
    updatedAt: now,
  };
  await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, {
    documentId: documentId(`marketplaceListings:${id}`),
    data: {
      sourceTable: "marketplaceListings",
      sourceId: id,
      payload: JSON.stringify(listing),
      sourceUpdatedAt: now.toISOString(),
    },
  });
  return { id, status: "approved" as const };
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
