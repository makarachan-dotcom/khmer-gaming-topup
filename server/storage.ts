// Storage helpers for marketplace media.
// Prefer the Manus Forge store when it is configured. Production Vercel deployments
// without Forge credentials fall back to the existing server-only Appwrite project.

import { ENV } from "./_core/env";

const APPWRITE_MEDIA_BUCKET = process.env.APPWRITE_STORAGE_BUCKET_ID || "zurs_media";
const MAX_MARKETPLACE_FILE_BYTES = 5 * 1024 * 1024;

type AppwriteStorageConfig = { endpoint: string; projectId: string; apiKey: string };

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;
  return forgeUrl && forgeKey ? { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey } : null;
}

function getAppwriteConfig(): AppwriteStorageConfig | null {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  return endpoint && projectId && apiKey ? { endpoint: endpoint.replace(/\/+$/, ""), projectId, apiKey } : null;
}

function appwriteHeaders(config: AppwriteStorageConfig) {
  return { "X-Appwrite-Project": config.projectId, "X-Appwrite-Key": config.apiKey };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function appwriteMediaKey(fileId: string) {
  return `appwrite/${APPWRITE_MEDIA_BUCKET}/${fileId}`;
}

function parseAppwriteMediaKey(relKey: string) {
  const [provider, bucketId, fileId, ...rest] = normalizeKey(relKey).split("/");
  if (provider !== "appwrite" || !bucketId || !fileId || rest.length) return null;
  return { bucketId, fileId };
}

export function isAppwriteMediaKey(relKey: string) {
  return Boolean(parseAppwriteMediaKey(relKey));
}

async function ensureAppwriteBucket(config: AppwriteStorageConfig) {
  const bucketPath = `${config.endpoint}/storage/buckets/${APPWRITE_MEDIA_BUCKET}`;
  const existing = await fetch(bucketPath, { headers: appwriteHeaders(config), signal: AbortSignal.timeout(20_000) });
  if (existing.ok) return;
  if (existing.status !== 404) throw new Error(`Appwrite storage bucket check failed (${existing.status})`);

  const create = await fetch(`${config.endpoint}/storage/buckets`, {
    method: "POST",
    headers: { ...appwriteHeaders(config), "Content-Type": "application/json" },
    body: JSON.stringify({
      bucketId: APPWRITE_MEDIA_BUCKET,
      name: "ZURS marketplace media",
      permissions: [],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: MAX_MARKETPLACE_FILE_BYTES,
      allowedFileExtensions: ["jpg", "jpeg", "png", "webp"],
      compression: "none",
      encryption: true,
      antivirus: true,
      transformations: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (create.ok || create.status === 409) return;
  const message = await create.text().catch(() => "");
  throw new Error(`Appwrite storage bucket creation failed (${create.status}): ${message}`);
}

async function appwriteStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const config = getAppwriteConfig();
  if (!config) throw new Error("Storage is unavailable: configure Forge storage or server-side Appwrite credentials");
  await ensureAppwriteBucket(config);

  const fileId = crypto.randomUUID();
  const fileName = normalizeKey(relKey).split("/").pop() || "upload";
  const form = new FormData();
  form.set("fileId", fileId);
  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  form.set("file", blob, fileName);

  const response = await fetch(`${config.endpoint}/storage/buckets/${APPWRITE_MEDIA_BUCKET}/files`, {
    method: "POST",
    headers: appwriteHeaders(config),
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Appwrite storage upload failed (${response.status}): ${message}`);
  }

  const key = appwriteMediaKey(fileId);
  return { key, url: `/manus-storage/${key}` };
}

async function forgeStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
  forge: { forgeUrl: string; forgeKey: string },
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: `/manus-storage/${key}` };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const forge = getForgeConfig();
  return forge ? forgeStoragePut(relKey, data, contentType, forge) : appwriteStoragePut(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: `/manus-storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (isAppwriteMediaKey(key)) return `/manus-storage/${key}`;

  const forge = getForgeConfig();
  if (!forge) throw new Error("Storage is unavailable: configure Forge storage or server-side Appwrite credentials");
  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` } });
  if (!resp.ok) {
    const msg = await resp.text().catch(() => resp.statusText);
    throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
  }
  const { url } = (await resp.json()) as { url: string };
  return url;
}

export async function getAppwriteMediaFile(relKey: string): Promise<Response | null> {
  const parsed = parseAppwriteMediaKey(relKey);
  const config = getAppwriteConfig();
  if (!parsed || !config) return null;
  const response = await fetch(`${config.endpoint}/storage/buckets/${parsed.bucketId}/files/${parsed.fileId}/view`, {
    headers: appwriteHeaders(config),
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Appwrite storage read failed (${response.status})`);
  return response;
}
