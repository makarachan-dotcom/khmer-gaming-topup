import crypto from "node:crypto";
import { nanoid } from "nanoid";
import type { InsertUser, User } from "../drizzle/schema";
import { validateAdminRoleChange } from "./adminRoles";
import { normalizeDelegatedAdminPermissions, type DelegatedAdminPermission } from "./adminPermissions";
import { isSingleAdminEmail } from "./storefrontDomain";
import type { FzrProviderSyncSnapshot, SmmProviderCatalogResponse } from "./providerCatalog";

type AppwriteRecord = { $id: string; sourceTable: string; sourceId: string; payload: string; sourceUpdatedAt?: string | null };
type AppwriteList = { documents?: AppwriteRecord[]; total?: number };
type AppwriteOrder = { id: string; userId: number; orderNumber: string; orderType: "topup" | "smm"; status: string; currency: string; subtotal: string; productName: string; details: unknown; createdAt: Date; updatedAt: Date };
type AppwritePayment = { id: string; orderId: string; provider: string; status: string; amount: string; currency: string; createdAt: Date; updatedAt: Date; paidAt: Date | null; orderNumber: string; productName: string; orderStatus: string };
export type AppwriteWalletTopup = { id: string; userId: number; referenceCode: string; provider: string; providerRequestId: string; providerTransactionId: string | null; status: "pending" | "paid" | "expired" | "failed"; amountKhr: string; paymentPayload: Record<string, unknown>; expiresAt: Date; paidAt: Date | null; creditedAt: Date | null; createdAt: Date; updatedAt: Date };
export type AppwriteProviderAvailability = { hiddenGameIds: string[]; hiddenSmmServiceIds: string[]; activeGameIds?: string[]; updatedAt: Date };
export type AppwriteProviderCatalog = { games: Array<{ id: string; providerSourceId: string; titleKh: string; titleEn: string; packageSourceIds?: string[]; packages: Array<{ id: string; providerOfferSourceId?: string; amountLabel: string; basePriceUsd: string; profitMarginPercent: string; priceUsd: string; isActive: boolean; featured: boolean; providerAuthorized: true; providerSource: string }> }>; smm: Array<{ id: string; providerSourceId: string; platform: string; titleKh: string; titleEn: string; tiers: Array<{ id: string; quantity: number; basePriceUsd: string; profitMarginPercent: string; priceUsd: string; isActive: boolean; providerAuthorized: true; providerSource: string }> }> };
type AppwriteProviderCatalogIndex = { gameSourceIds: string[]; smmSourceIds: string[]; updatedAt: string };
export type AppwriteAdminRoleAudit = { id: string; actorUserId: number; targetUserId: number; previousRole: "user" | "admin"; nextRole: "user" | "admin"; reason: string; createdAt: Date };
export type AppwritePaymentControl = { enabled: boolean; updatedByUserId: number | null; updatedAt: Date };
export type AppwriteAdminPermissions = { userId: number; permissions: DelegatedAdminPermission[]; updatedByUserId: number; updatedAt: Date };

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

const providerAvailabilitySourceId = "global";
const providerCatalogIndexSourceId = "global";
const paymentControlSourceId = "global";

function paymentControlDocumentPath() {
  return `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`payment_control:${paymentControlSourceId}`)}`;
}

export async function getAppwritePaymentControl(): Promise<AppwritePaymentControl> {
  if (!config()) return { enabled: false, updatedByUserId: null, updatedAt: new Date(0) };
  const record = await request("GET", paymentControlDocumentPath()) as AppwriteRecord | null;
  const value = record?.sourceTable === "payment_control" ? parsePayload<Partial<AppwritePaymentControl>>(record) : null;
  return { enabled: value?.enabled === true, updatedByUserId: typeof value?.updatedByUserId === "number" ? value.updatedByUserId : null, updatedAt: value?.updatedAt ? asDate(value.updatedAt) : new Date(0) };
}

export async function setAppwritePaymentControl(input: { enabled: boolean; updatedByUserId: number }) {
  if (!config()) throw new Error("Payment-control storage is unavailable.");
  const next: AppwritePaymentControl = { enabled: input.enabled, updatedByUserId: input.updatedByUserId, updatedAt: new Date() };
  const body = { data: { sourceTable: "payment_control", sourceId: paymentControlSourceId, payload: JSON.stringify(next), sourceUpdatedAt: next.updatedAt.toISOString() } };
  const path = paymentControlDocumentPath();
  const existing = await request("GET", path) as AppwriteRecord | null;
  if (existing) await request("PUT", path, body);
  else {
    try { await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`payment_control:${paymentControlSourceId}`), ...body }); }
    catch (error) { if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error; await request("PUT", path, body); }
  }
  return next;
}

function providerAvailabilityDocumentPath() {
  return `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`provider_availability:${providerAvailabilitySourceId}`)}`;
}

function parseProviderAvailability(record: AppwriteRecord | null) {
  const value = record ? parsePayload<Partial<AppwriteProviderAvailability>>(record) : null;
  return {
    hiddenGameIds: Array.isArray(value?.hiddenGameIds) ? value.hiddenGameIds.filter((id): id is string => typeof id === "string" && id.length <= 120) : [],
    hiddenSmmServiceIds: Array.isArray(value?.hiddenSmmServiceIds) ? value.hiddenSmmServiceIds.filter((id): id is string => typeof id === "string" && id.length <= 120) : [],
    activeGameIds: Array.isArray(value?.activeGameIds) ? Array.from(new Set(value.activeGameIds.filter((id): id is string => typeof id === "string" && id.length <= 120))) : undefined,
    updatedAt: value?.updatedAt ? asDate(value.updatedAt) : new Date(0),
  } satisfies AppwriteProviderAvailability;
}

export async function getAppwriteProviderAvailability() {
  if (!config()) return parseProviderAvailability(null);
  const record = await request("GET", providerAvailabilityDocumentPath()) as AppwriteRecord | null;
  return parseProviderAvailability(record?.sourceTable === "provider_availability" && record.sourceId === providerAvailabilitySourceId ? record : null);
}

export async function updateAppwriteProviderAvailability(input: { kind: "game" | "smm"; providerId: string; isActive: boolean; legacyActiveGameIds?: string[] }) {
  if (!config()) throw new Error("Provider availability storage is unavailable");
  const current = await getAppwriteProviderAvailability();
  const source = input.kind === "game" ? current.hiddenGameIds : current.hiddenSmmServiceIds;
  const nextSource = input.isActive ? source.filter((id) => id !== input.providerId) : Array.from(new Set([...source, input.providerId]));
  const currentActiveGames = current.activeGameIds ?? input.legacyActiveGameIds ?? [];
  const nextActiveGames = input.kind === "game" ? (input.isActive ? Array.from(new Set([...currentActiveGames, input.providerId])) : currentActiveGames.filter((id) => id !== input.providerId)) : currentActiveGames;
  const next: AppwriteProviderAvailability = input.kind === "game" ? { ...current, hiddenGameIds: nextSource, activeGameIds: nextActiveGames, updatedAt: new Date() } : { ...current, hiddenSmmServiceIds: nextSource, activeGameIds: current.activeGameIds, updatedAt: new Date() };
  const body = { data: { sourceTable: "provider_availability", sourceId: providerAvailabilitySourceId, payload: JSON.stringify(next), sourceUpdatedAt: next.updatedAt.toISOString() } };
  const path = providerAvailabilityDocumentPath();
  const existing = await request("GET", path) as AppwriteRecord | null;
  // Appwrite updates an existing document with PATCH. Using PUT made the live
  // availability action fail after the document had been created once.
  if (existing) await request("PATCH", path, body);
  else {
    try { await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`provider_availability:${providerAvailabilitySourceId}`), ...body }); }
    catch (error) { if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error; await request("PATCH", path, body); }
  }
  return next;
}

function providerCatalogDocumentPath(table: string, sourceId: string) {
  return `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`${table}:${sourceId}`)}`;
}

function providerCatalogId(prefix: string, sourceId: string) {
  return `${prefix}-${documentId(sourceId)}`;
}

async function upsertProviderCatalogRecord(table: "provider_catalog_game" | "provider_catalog_game_offer" | "provider_catalog_smm" | "provider_catalog_index", sourceId: string, payload: unknown) {
  if (!config()) throw new Error("Provider catalog storage is unavailable");
  const now = new Date();
  const path = providerCatalogDocumentPath(table, sourceId);
  const body = { data: { sourceTable: table, sourceId, payload: JSON.stringify(payload), sourceUpdatedAt: now.toISOString() } };
  const existing = await request("GET", path) as AppwriteRecord | null;
  if (existing) await request("PUT", path, body);
  else {
    try { await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`${table}:${sourceId}`), ...body }); }
    catch (error) { if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error; await request("PUT", path, body); }
  }
}

function asProviderGame(record: AppwriteRecord) {
  const value = parsePayload<AppwriteProviderCatalog["games"][number]>(record);
  return value && typeof value.id === "string" && Array.isArray(value.packages) ? value : null;
}

function asProviderGameOffer(record: AppwriteRecord) {
  const value = parsePayload<AppwriteProviderCatalog["games"][number]["packages"][number]>(record);
  return value && typeof value.id === "string" && typeof value.amountLabel === "string" ? value : null;
}

function asProviderSmm(record: AppwriteRecord) {
  const value = parsePayload<AppwriteProviderCatalog["smm"][number]>(record);
  return value && typeof value.id === "string" && Array.isArray(value.tiers) ? value : null;
}

function asProviderCatalogIndex(record: AppwriteRecord | null) {
  const value = record ? parsePayload<Partial<AppwriteProviderCatalogIndex>>(record) : null;
  return {
    gameSourceIds: Array.isArray(value?.gameSourceIds) ? value.gameSourceIds.filter((id): id is string => typeof id === "string" && id.length <= 180) : [],
    smmSourceIds: Array.isArray(value?.smmSourceIds) ? value.smmSourceIds.filter((id): id is string => typeof id === "string" && id.length <= 180) : [],
    updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : new Date(0).toISOString(),
  } satisfies AppwriteProviderCatalogIndex;
}

async function getAppwriteProviderCatalogIndex() {
  if (!config()) return asProviderCatalogIndex(null);
  const record = await request("GET", providerCatalogDocumentPath("provider_catalog_index", providerCatalogIndexSourceId)) as AppwriteRecord | null;
  return asProviderCatalogIndex(record?.sourceTable === "provider_catalog_index" && record.sourceId === providerCatalogIndexSourceId ? record : null);
}

async function mergeAppwriteProviderCatalogIndex(input: { gameSourceIds?: string[]; smmSourceIds?: string[] }) {
  const current = await getAppwriteProviderCatalogIndex();
  const next: AppwriteProviderCatalogIndex = {
    gameSourceIds: Array.from(new Set([...current.gameSourceIds, ...(input.gameSourceIds ?? [])])),
    smmSourceIds: Array.from(new Set([...current.smmSourceIds, ...(input.smmSourceIds ?? [])])),
    updatedAt: new Date().toISOString(),
  };
  await upsertProviderCatalogRecord("provider_catalog_index", providerCatalogIndexSourceId, next);
  return next;
}

async function readIndexedProviderCatalog(index: AppwriteProviderCatalogIndex): Promise<AppwriteProviderCatalog> {
  const indexedGames = (await mapWithConcurrency(index.gameSourceIds, 8, async (sourceId) => {
    const record = await request("GET", providerCatalogDocumentPath("provider_catalog_game", sourceId)) as AppwriteRecord | null;
    return record?.sourceTable === "provider_catalog_game" ? asProviderGame(record) : null;
  })).filter((item): item is NonNullable<typeof item> => item !== null);
  const games = await mapWithConcurrency(indexedGames, 6, async (game) => {
    if (!game.packageSourceIds?.length) return game;
    const packages = (await mapWithConcurrency(game.packageSourceIds, 8, async (sourceId) => {
      const record = await request("GET", providerCatalogDocumentPath("provider_catalog_game_offer", sourceId)) as AppwriteRecord | null;
      return record?.sourceTable === "provider_catalog_game_offer" ? asProviderGameOffer(record) : null;
    })).filter((item): item is NonNullable<typeof item> => item !== null);
    return { ...game, packages };
  });
  const smm = (await mapWithConcurrency(index.smmSourceIds, 8, async (sourceId) => {
    const record = await request("GET", providerCatalogDocumentPath("provider_catalog_smm", sourceId)) as AppwriteRecord | null;
    return record?.sourceTable === "provider_catalog_smm" ? asProviderSmm(record) : null;
  })).filter((item): item is NonNullable<typeof item> => item !== null);
  return { games, smm };
}

export async function getAppwriteProviderCatalog(): Promise<AppwriteProviderCatalog> {
  if (!config()) return { games: [], smm: [] };
  const index = await getAppwriteProviderCatalogIndex();
  if (index.gameSourceIds.length || index.smmSourceIds.length) return readIndexedProviderCatalog(index);
  const records = await allRecords();
  const games = records.filter((record) => record.sourceTable === "provider_catalog_game").map(asProviderGame).filter((item): item is NonNullable<typeof item> => item !== null);
  const smm = records.filter((record) => record.sourceTable === "provider_catalog_smm").map(asProviderSmm).filter((item): item is NonNullable<typeof item> => item !== null);
  return { games, smm };
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const output: R[] = [];
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await worker(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return output;
}

export async function syncAppwriteFzrCatalog(snapshot: Extract<FzrProviderSyncSnapshot, { status: "ready" }>) {
  await mergeAppwriteProviderCatalogIndex({ gameSourceIds: snapshot.games.map((game) => game.providerGameId) });
  const catalog = await getAppwriteProviderCatalog();
  const gamesById = new Map(catalog.games.map((item) => [item.id, item]));
  const imported = await mapWithConcurrency(snapshot.games, 8, async (game) => {
    const gameId = providerCatalogId("fzr-game", game.providerGameId);
    const existing = gamesById.get(gameId);
    const existingPackages = new Map((existing?.packages ?? []).map((item) => [item.id, item]));
    const packages = game.offers.map((offer) => {
      const id = providerCatalogId("fzr-offer", `${game.providerGameId}:${offer.providerOfferId}`);
      const previous = existingPackages.get(id);
      const basePriceUsd = previous?.basePriceUsd ?? offer.priceUsd;
      const profitMarginPercent = previous?.profitMarginPercent ?? "0.00";
      return { id, amountLabel: offer.name, basePriceUsd, profitMarginPercent, priceUsd: previous?.priceUsd ?? basePriceUsd, isActive: previous?.isActive ?? false, featured: previous?.featured ?? false, providerAuthorized: true as const, providerSource: "FZR Cards" };
    });
    const packageSourceIds = game.offers.map((offer) => `${game.providerGameId}:${offer.providerOfferId}`);
    const packagesWithSourceIds = packages.map((offer, index) => ({ ...offer, providerOfferSourceId: packageSourceIds[index]! }));
    await upsertProviderCatalogRecord("provider_catalog_game", game.providerGameId, { id: gameId, providerSourceId: game.providerGameId, titleKh: game.name, titleEn: game.name, packageSourceIds, packages: [] });
    await mapWithConcurrency(packagesWithSourceIds, 8, async (offer) => upsertProviderCatalogRecord("provider_catalog_game_offer", offer.providerOfferSourceId!, offer));
    return { games: existing ? 0 : 1, offers: game.offers.filter((offer) => !existingPackages.has(providerCatalogId("fzr-offer", `${game.providerGameId}:${offer.providerOfferId}`))).length };
  });
  return { gamesImported: imported.reduce((total, item) => total + item.games, 0), offersImported: imported.reduce((total, item) => total + item.offers, 0), provider: "FZR Cards" as const };
}

export async function syncAppwriteSmmCatalog(snapshot: Extract<SmmProviderCatalogResponse, { status: "ready" }>) {
  await mergeAppwriteProviderCatalogIndex({ smmSourceIds: snapshot.services.map((service) => service.providerServiceId) });
  const catalog = await getAppwriteProviderCatalog();
  const servicesById = new Map(catalog.smm.map((item) => [item.id, item]));
  const imported = await mapWithConcurrency(snapshot.services, 8, async (service) => {
    const serviceId = providerCatalogId("smm-service", service.providerServiceId);
    const existing = servicesById.get(serviceId);
    const tierId = providerCatalogId("smm-tier", service.providerServiceId);
    const previous = existing?.tiers.find((item) => item.id === tierId);
    const basePriceUsd = previous?.basePriceUsd ?? (Number(service.rateUsdPerThousand) * Math.max(service.min, 1) / 1000).toFixed(2);
    const profitMarginPercent = previous?.profitMarginPercent ?? "0.00";
    await upsertProviderCatalogRecord("provider_catalog_smm", service.providerServiceId, { id: serviceId, providerSourceId: service.providerServiceId, platform: service.category, titleKh: service.name, titleEn: service.name, tiers: [{ id: tierId, quantity: Math.max(service.min, 1), basePriceUsd, profitMarginPercent, priceUsd: previous?.priceUsd ?? basePriceUsd, isActive: previous?.isActive ?? false, providerAuthorized: true as const, providerSource: "SMMGlob" }] });
    return { services: existing ? 0 : 1, tiers: previous ? 0 : 1 };
  });
  return { servicesImported: imported.reduce((total, item) => total + item.services, 0), tiersImported: imported.reduce((total, item) => total + item.tiers, 0), provider: "SMMGlob" as const };
}

export async function updateAppwriteProviderOffer(input: { kind: "game" | "smm"; offerId: string; basePriceUsd: string; profitMarginPercent: string; isActive: boolean; featured?: boolean }) {
  const catalog = await getAppwriteProviderCatalog();
  const priceUsd = (Number(input.basePriceUsd) * (1 + Number(input.profitMarginPercent) / 100)).toFixed(2);
  if (input.kind === "game") {
    const game = catalog.games.find((item) => item.packages.some((offer) => offer.id === input.offerId));
    if (!game) throw new Error("Provider-authorized game offer was not found");
    const packages = game.packages.map((offer) => offer.id === input.offerId ? { ...offer, basePriceUsd: input.basePriceUsd, profitMarginPercent: input.profitMarginPercent, priceUsd, isActive: input.isActive, featured: input.featured ?? offer.featured } : offer);
    const changedOffer = packages.find((offer) => offer.id === input.offerId);
    if (changedOffer?.providerOfferSourceId) await upsertProviderCatalogRecord("provider_catalog_game_offer", changedOffer.providerOfferSourceId, changedOffer);
    else await upsertProviderCatalogRecord("provider_catalog_game", game.providerSourceId, { ...game, packages });
    return { success: true };
  }
  const service = catalog.smm.find((item) => item.tiers.some((tier) => tier.id === input.offerId));
  if (!service) throw new Error("Provider-authorized SMM offer was not found");
  const tiers = service.tiers.map((tier) => tier.id === input.offerId ? { ...tier, basePriceUsd: input.basePriceUsd, profitMarginPercent: input.profitMarginPercent, priceUsd, isActive: input.isActive } : tier);
  await upsertProviderCatalogRecord("provider_catalog_smm", service.providerSourceId, { ...service, tiers });
  return { success: true };
}

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
  // A missing document is an expected read result. A 404 from a create, update,
  // or delete request must surface as an error so the UI never claims an edit or
  // seller submission was saved when it was not persisted.
  if (response.status === 404 && method === "GET") return null;
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { type?: unknown } | null;
    const type = typeof error?.type === "string" && /^[a-z0-9_.-]{1,80}$/i.test(error.type) ? ` (${error.type})` : "";
    throw new Error(`Appwrite user store request failed with HTTP ${response.status}${type}`);
  }
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

function adminRoleAuditDocumentPath(auditId: string) {
  return `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`admin_role_audits:${auditId}`)}`;
}

function adminPermissionsDocumentPath(userId: number) {
  return `/databases/${databaseId()}/collections/${collectionId}/documents/${documentId(`admin_permissions:${userId}`)}`;
}

async function pagedRecords(pageSize: number, buildPath: (offset: number) => string) {
  const records: AppwriteRecord[] = [];
  for (let offset = 0; offset < 10_000; offset += pageSize) {
    const data = await request("GET", buildPath(offset)) as AppwriteList | null;
    const page = data?.documents ?? [];
    records.push(...page);
    if (!data || page.length < pageSize || (typeof data.total === "number" && records.length >= data.total)) break;
  }
  return records;
}

async function allRecords() {
  const collectionPath = `/databases/${databaseId()}/collections/${collectionId}/documents`;
  try {
    return await pagedRecords(RECORD_PAGE_SIZE, (offset) => {
      const query = new URLSearchParams();
      query.append("queries[]", `limit(${RECORD_PAGE_SIZE})`);
      query.append("queries[]", `offset(${offset})`);
      return `${collectionPath}?${query.toString()}`;
    });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("general_query_invalid")) throw error;
    // Some legacy Appwrite document endpoints accept standalone pagination fields,
    // but reject the newer query-array form. Preserve a smaller page size so the
    // fallback can reliably retrieve the synchronized catalog without a total count.
    return pagedRecords(25, (offset) => `${collectionPath}?limit=25&offset=${offset}`);
  }
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

export async function listAppwriteUsers() {
  if (!config()) return [];
  return (await allUserRecords()).map(toUser).filter((user): user is User => user !== null).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 100);
}

function toAdminRoleAudit(record: AppwriteRecord): AppwriteAdminRoleAudit | null {
  const value = parsePayload<Partial<AppwriteAdminRoleAudit>>(record);
  if (!value || typeof value.id !== "string" || typeof value.actorUserId !== "number" || typeof value.targetUserId !== "number" || (value.previousRole !== "user" && value.previousRole !== "admin") || (value.nextRole !== "user" && value.nextRole !== "admin") || typeof value.reason !== "string") return null;
  return { id: value.id, actorUserId: value.actorUserId, targetUserId: value.targetUserId, previousRole: value.previousRole, nextRole: value.nextRole, reason: value.reason, createdAt: asDate(value.createdAt) };
}

export async function setAppwriteUserRole(input: { actorUserId: number; targetUserId: number; nextRole: "user" | "admin"; confirmationEmail: string; reason: string }) {
  if (!config()) throw new Error("Role management storage is unavailable.");
  const target = (await listAppwriteUsers()).find((user) => user.id === input.targetUserId);
  if (!target) throw new Error("The target account was not found.");
  validateAdminRoleChange({ targetEmail: target.email, previousRole: target.role, nextRole: input.nextRole, confirmationEmail: input.confirmationEmail, reason: input.reason });
  const audit: AppwriteAdminRoleAudit = { id: nanoid(), actorUserId: input.actorUserId, targetUserId: target.id, previousRole: target.role, nextRole: input.nextRole, reason: input.reason.trim(), createdAt: new Date() };
  const auditBody = { data: { sourceTable: "admin_role_audits", sourceId: audit.id, payload: JSON.stringify(audit), sourceUpdatedAt: audit.createdAt.toISOString() } };
  const auditPath = adminRoleAuditDocumentPath(audit.id);
  try {
    await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`admin_role_audits:${audit.id}`), ...auditBody });
  } catch (error) {
    if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error;
    await request("PUT", auditPath, auditBody);
  }

  const updated: User = { ...target, role: input.nextRole, updatedAt: new Date() };
  const userBody = { data: { sourceTable: "users", sourceId: updated.openId, payload: JSON.stringify(updated), sourceUpdatedAt: updated.updatedAt.toISOString() } };
  try {
    await request("PUT", userDocumentPath(updated.openId), userBody);
  } catch (error) {
    await request("DELETE", auditPath).catch(() => undefined);
    throw error;
  }
  return { success: true };
}

export async function getAppwriteAdminPermissions(userId: number) {
  if (!config()) return [];
  try {
    const record = await request("GET", adminPermissionsDocumentPath(userId)) as AppwriteRecord | null;
    const value = record && record.sourceTable === "admin_permissions" ? parsePayload<Partial<AppwriteAdminPermissions>>(record) : null;
    return normalizeDelegatedAdminPermissions(value?.permissions);
  } catch {
    return [];
  }
}

export async function setAppwriteAdminPermissions(input: { userId: number; permissions: DelegatedAdminPermission[]; updatedByUserId: number }) {
  if (!config()) throw new Error("Delegated Admin permission storage is unavailable.");
  const updatedAt = new Date();
  const payload: AppwriteAdminPermissions = { userId: input.userId, permissions: normalizeDelegatedAdminPermissions(input.permissions), updatedByUserId: input.updatedByUserId, updatedAt };
  const body = { data: { sourceTable: "admin_permissions", sourceId: String(input.userId), payload: JSON.stringify(payload), sourceUpdatedAt: updatedAt.toISOString() } };
  const path = adminPermissionsDocumentPath(input.userId);
  try {
    await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`admin_permissions:${input.userId}`), ...body });
  } catch (error) {
    if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error;
    await request("PUT", path, body);
  }
  return { permissions: payload.permissions };
}

export async function getAppwriteAdminRoleAudits() {
  if (!config()) return [];
  const [audits, members] = await Promise.all([recordsFor("admin_role_audits"), listAppwriteUsers()]);
  const usersById = new Map(members.map((member) => [member.id, member]));
  return audits.map(toAdminRoleAudit).filter((audit): audit is AppwriteAdminRoleAudit => audit !== null).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime()).slice(0, 100).map((audit) => ({ audit, actor: usersById.get(audit.actorUserId) ?? null }));
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
    role: isSingleAdminEmail(email) || existing?.role === "admin" ? "admin" : "user",
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

export async function updateAppwriteUserDisplayName(input: { user: User; displayName: string }) {
  const updated: User = { ...input.user, displayName: input.displayName, updatedAt: new Date() };
  const sourceId = input.user.openId;
  const body = { data: { sourceTable: "users", sourceId, payload: JSON.stringify(updated), sourceUpdatedAt: updated.updatedAt.toISOString() } };
  // Profile updates run while the user is already authenticated. Create first and
  // update on a deterministic-document conflict so a quota-limited read can never
  // block Account onboarding.
  try {
    await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`users:${sourceId}`), ...body });
  } catch (error) {
    if (!shouldRetryAppwriteCreateAsUpdate(error)) throw error;
    await request("PUT", userDocumentPath(sourceId), body);
  }
  return { displayName: input.displayName };
}

function toWalletTopup(record: AppwriteRecord): AppwriteWalletTopup | null {
  const value = parsePayload<Partial<AppwriteWalletTopup>>(record);
  if (!value || typeof value.id !== "string" || typeof value.userId !== "number" || typeof value.referenceCode !== "string" || typeof value.providerRequestId !== "string") return null;
  const status = value.status;
  if (!status || !["pending", "paid", "expired", "failed"].includes(status)) return null;
  const paymentPayload = value.paymentPayload && typeof value.paymentPayload === "object" && !Array.isArray(value.paymentPayload) ? value.paymentPayload as Record<string, unknown> : {};
  return { id: value.id, userId: value.userId, referenceCode: value.referenceCode, provider: String(value.provider ?? "bakong_khqr"), providerRequestId: value.providerRequestId, providerTransactionId: value.providerTransactionId ?? null, status, amountKhr: String(value.amountKhr ?? "0"), paymentPayload, expiresAt: asDate(value.expiresAt), paidAt: value.paidAt ? asDate(value.paidAt) : null, creditedAt: value.creditedAt ? asDate(value.creditedAt) : null, createdAt: asDate(value.createdAt), updatedAt: asDate(value.updatedAt) };
}

async function allAppwriteWalletTopups() {
  return (await recordsFor("wallet_topups")).map((record) => {
    const topup = toWalletTopup(record);
    return topup ? { record, topup } : null;
  }).filter((item): item is { record: AppwriteRecord; topup: AppwriteWalletTopup } => item !== null);
}

export async function getAppwriteWalletSummary(userId: number) {
  const paidTopups = (await allAppwriteWalletTopups()).filter(({ topup }) => topup.userId === userId && topup.status === "paid");
  const balanceKhr = paidTopups.reduce((total, { topup }) => total + Number(topup.amountKhr), 0);
  return { balanceKhr: balanceKhr.toFixed(2), currency: "KHR" as const, available: true };
}

export async function createAppwriteWalletTopup(input: Omit<AppwriteWalletTopup, "providerTransactionId" | "paidAt" | "creditedAt" | "createdAt" | "updatedAt">) {
  const now = new Date();
  const topup: AppwriteWalletTopup = { ...input, providerTransactionId: null, paidAt: null, creditedAt: null, createdAt: now, updatedAt: now };
  await request("POST", `/databases/${databaseId()}/collections/${collectionId}/documents`, { documentId: documentId(`wallet_topups:${topup.id}`), data: { sourceTable: "wallet_topups", sourceId: topup.id, payload: JSON.stringify(topup), sourceUpdatedAt: now.toISOString() } });
  return topup;
}

export async function getAppwriteWalletTopup(input: { userId: number; topupId: string }) {
  const item = (await allAppwriteWalletTopups()).find(({ topup }) => topup.id === input.topupId && topup.userId === input.userId);
  return item?.topup;
}

export async function updateAppwriteWalletTopup(input: { userId: number; topupId: string; status: AppwriteWalletTopup["status"]; providerTransactionId?: string | null; paidAt?: Date | null; creditedAt?: Date | null }) {
  const item = (await allAppwriteWalletTopups()).find(({ topup }) => topup.id === input.topupId && topup.userId === input.userId);
  if (!item) throw new Error("Wallet top-up session was not found");
  if (item.topup.status !== "pending") return item.topup;
  const now = new Date();
  const topup: AppwriteWalletTopup = { ...item.topup, status: input.status, providerTransactionId: input.providerTransactionId ?? item.topup.providerTransactionId, paidAt: input.paidAt ?? item.topup.paidAt, creditedAt: input.creditedAt ?? item.topup.creditedAt, updatedAt: now };
  await request("PUT", `/databases/${databaseId()}/collections/${collectionId}/documents/${item.record.$id}`, { data: { sourceTable: "wallet_topups", sourceId: topup.id, payload: JSON.stringify(topup), sourceUpdatedAt: now.toISOString() } });
  return topup;
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
    // Appwrite-backed submissions must remain private until an administrator reviews them.
    status: "pending" as const,
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
  return { id, status: "pending" as const };
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
