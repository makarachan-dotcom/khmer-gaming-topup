import crypto from "node:crypto";
import type { InsertUser, User } from "../drizzle/schema";
import { isSingleAdminEmail } from "./storefrontDomain";

type AppwriteRecord = { $id: string; sourceTable: string; sourceId: string; payload: string; sourceUpdatedAt?: string | null };
type AppwriteList = { documents?: AppwriteRecord[] };

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

function toUser(record: AppwriteRecord): User | null {
  try {
    const payload = JSON.parse(record.payload) as Partial<User>;
    if (!payload.openId || typeof payload.id !== "number") return null;
    return {
      id: payload.id,
      openId: payload.openId,
      name: payload.name ?? null,
      displayName: payload.displayName ?? null,
      email: payload.email ?? null,
      loginMethod: payload.loginMethod ?? null,
      role: payload.role === "admin" ? "admin" : "user",
      createdAt: asDate(payload.createdAt),
      updatedAt: asDate(payload.updatedAt),
      lastSignedIn: asDate(payload.lastSignedIn),
    };
  } catch { return null; }
}

async function allUserRecords() {
  const data = await request("GET", `/databases/${databaseId()}/collections/${collectionId}/documents?limit=100&total=false`) as AppwriteList | null;
  return (data?.documents ?? []).filter((record) => record.sourceTable === "users");
}

export async function getAppwriteUserByOpenId(openId: string) {
  const records = await allUserRecords();
  const users = records.map(toUser).filter((user): user is User => user !== null);
  return users.find((user) => user.openId === openId);
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
  const path = `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`users:${sourceId}`)}`;
  if (existing) await request("PUT", path, body);
  else await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`users:${sourceId}`), ...body });
  return user;
}

export async function updateAppwriteUserDisplayName(id: number, displayName: string) {
  const records = await allUserRecords();
  const record = records.find((candidate) => toUser(candidate)?.id === id);
  const current = record ? toUser(record) : null;
  if (!record || !current) throw new Error("Appwrite user record was not found");
  const updated: User = { ...current, displayName, updatedAt: new Date() };
  await request("PUT", `/databases/${databaseId()}/collections/${collectionId}/documents/${record.$id}`, { data: { sourceTable: "users", sourceId: record.sourceId, payload: JSON.stringify(updated), sourceUpdatedAt: updated.updatedAt.toISOString() } });
  return { displayName };
}
