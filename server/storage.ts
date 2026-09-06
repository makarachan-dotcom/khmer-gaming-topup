// Storage helpers for marketplace + admin media.
//
// FIX (401 on upload): the old code ALWAYS used the Manus Forge store whenever
// BUILT_IN_FORGE_API_URL / BUILT_IN_FORGE_API_KEY were present in the environment.
// After moving to Vercel those Forge credentials are stale, so every presign call
// answered 401 and the upload died with "Storage presign failed (401)" — even though
// server-side Appwrite credentials were configured and healthy.
//
// New behaviour:
//   1. If Forge is configured, try it first.
//   2. If Forge answers 401/403 (or is unreachable) and Appwrite is configured,
//      transparently fall back to Appwrite Storage and remember that Forge is dead
//      for this process so we don't pay the failing round-trip on every upload.
//   3. If nothing works, throw a clear Khmer message that tells the admin exactly
//      which env var to fix instead of a raw "(401)".

import { ENV } from "./_core/env";

const APPWRITE_MEDIA_BUCKET = process.env.APPWRITE_STORAGE_BUCKET_ID || "zurs_media";
const MAX_MARKETPLACE_FILE_BYTES = 5 * 1024 * 1024;

type AppwriteStorageConfig = { endpoint: string; projectId: string; apiKey: string };
type ForgeConfig = { forgeUrl: string; forgeKey: string };

/** Set to true once Forge rejects our key; skipped for the rest of the process lifetime. */
let forgeUnauthorized = false;

class StorageAuthError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "StorageAuthError";
  }
}

function getForgeConfig(): ForgeConfig | null {
  if (forgeUnauthorized) return null;
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

function publicMediaUrl(relKey: string): string {
  return `/api/media/${normalizeKey(relKey)}`;
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function appwriteMediaKey(sourceKey: string, fileId: string) {
  return `appwrite/${APPWRITE_MEDIA_BUCKET}/${normalizeKey(sourceKey)}/${fileId}`;
}

function parseAppwriteMediaKey(relKey: string) {
  const parts = normalizeKey(relKey).split("/");
  const [provider, bucketId, ...sourceAndFile] = parts;
  if (provider !== "appwrite" || !bucketId || sourceAndFile.length < 2) return null;
  const fileId = sourceAndFile.at(-1);
  if (!fileId) return null;
  return { bucketId, fileId };
}

export function isAppwriteMediaKey(relKey: string) {
  return Boolean(parseAppwriteMediaKey(relKey));
}

/** Human-readable (Khmer) explanation used by the Admin UI when every backend fails. */
function unavailableMessage(detail?: string) {
  const hint = getAppwriteConfig()
    ? "APPWRITE_API_KEY មិនត្រឹមត្រូវ ឬគ្មានសិទ្ធិ files.read / files.write / buckets.read / buckets.write។"
    : "សូមកំណត់ APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID និង APPWRITE_API_KEY ក្នុង Vercel → Settings → Environment Variables រួច Redeploy។";
  return `Storage មិនអាចប្រើបានទេ។ ${hint}${detail ? ` (${detail})` : ""}`;
}

async function ensureAppwriteBucket(config: AppwriteStorageConfig) {
  const bucketPath = `${config.endpoint}/storage/buckets/${APPWRITE_MEDIA_BUCKET}`;
  const existing = await fetch(bucketPath, { headers: appwriteHeaders(config), signal: AbortSignal.timeout(20_000) });
  if (existing.ok) return;
  if (existing.status === 401 || existing.status === 403) throw new StorageAuthError(unavailableMessage(`Appwrite ${existing.status}`), existing.status);
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
      allowedFileExtensions: ["jpg", "jpeg", "png", "webp", "svg", "mp4", "webm", "bin", "enc"],
      compression: "none",
      encryption: true,
      antivirus: true,
      transformations: true,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (create.ok || create.status === 409) return;
  if (create.status === 401 || create.status === 403) throw new StorageAuthError(unavailableMessage(`Appwrite ${create.status}`), create.status);
  const message = await create.text().catch(() => "");
  throw new Error(`Appwrite storage bucket creation failed (${create.status}): ${message}`);
}

async function appwriteStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
): Promise<{ key: string; url: string }> {
  const config = getAppwriteConfig();
  if (!config) throw new Error(unavailableMessage());
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
  if (response.status === 401 || response.status === 403) throw new StorageAuthError(unavailableMessage(`Appwrite ${response.status}`), response.status);
  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(`Appwrite storage upload failed (${response.status}): ${message}`);
  }

  const key = appwriteMediaKey(relKey, fileId);
  return { key, url: publicMediaUrl(key) };
}

async function forgeStoragePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType: string,
  forge: ForgeConfig,
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const presignUrl = new URL("v1/storage/presign/put", forge.forgeUrl + "/");
  presignUrl.searchParams.set("path", key);
  const presignResp = await fetch(presignUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` }, signal: AbortSignal.timeout(15_000) });
  if (presignResp.status === 401 || presignResp.status === 403) {
    forgeUnauthorized = true;
    console.warn(`[Storage] Forge rejected BUILT_IN_FORGE_API_KEY (${presignResp.status}). Falling back to Appwrite for the rest of this process.`);
    throw new StorageAuthError(`Storage presign failed (${presignResp.status})`, presignResp.status);
  }
  if (!presignResp.ok) {
    const msg = await presignResp.text().catch(() => presignResp.statusText);
    throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
  }
  const { url: s3Url } = (await presignResp.json()) as { url: string };
  if (!s3Url) throw new Error("Forge returned empty presign URL");

  const blob = typeof data === "string" ? new Blob([data], { type: contentType }) : new Blob([data as any], { type: contentType });
  const uploadResp = await fetch(s3Url, { method: "PUT", headers: { "Content-Type": contentType }, body: blob });
  if (!uploadResp.ok) throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
  return { key, url: publicMediaUrl(key) };
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const forge = getForgeConfig();
  const appwrite = getAppwriteConfig();

  if (forge) {
    try {
      return await forgeStoragePut(relKey, data, contentType, forge);
    } catch (error) {
      // Only fall back when a second backend actually exists; otherwise surface the real error.
      if (!appwrite) {
        if (error instanceof StorageAuthError) throw new Error(unavailableMessage(`Forge ${error.status}`));
        throw error;
      }
      console.warn("[Storage] Forge upload failed, retrying with Appwrite:", error instanceof Error ? error.message : error);
    }
  }

  return appwriteStoragePut(relKey, data, contentType);
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: publicMediaUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);
  if (isAppwriteMediaKey(key)) return publicMediaUrl(key);

  const forge = getForgeConfig();
  if (!forge) throw new Error(unavailableMessage());
  const getUrl = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
  getUrl.searchParams.set("path", key);
  const resp = await fetch(getUrl, { headers: { Authorization: `Bearer ${forge.forgeKey}` }, signal: AbortSignal.timeout(15_000) });
  if (resp.status === 401 || resp.status === 403) {
    forgeUnauthorized = true;
    throw new Error(unavailableMessage(`Forge ${resp.status}`));
  }
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
  if (response.status === 401 || response.status === 403) throw new Error(unavailableMessage(`Appwrite ${response.status}`));
  if (!response.ok) throw new Error(`Appwrite storage read failed (${response.status})`);
  return response;
}

/**
 * Lightweight probe used by the Admin "Retry" button so the UI can show WHICH backend
 * is broken instead of a generic "(401)".
 */
export async function storageHealth(): Promise<{ ok: boolean; backend: "forge" | "appwrite" | "none"; detail: string }> {
  const appwrite = getAppwriteConfig();
  if (appwrite) {
    try {
      const res = await fetch(`${appwrite.endpoint}/storage/buckets/${APPWRITE_MEDIA_BUCKET}`, { headers: appwriteHeaders(appwrite), signal: AbortSignal.timeout(10_000) });
      if (res.ok || res.status === 404) return { ok: true, backend: "appwrite", detail: res.ok ? "Appwrite bucket reachable" : "Appwrite reachable (bucket will be auto-created)" };
      return { ok: false, backend: "appwrite", detail: unavailableMessage(`Appwrite ${res.status}`) };
    } catch (error) {
      return { ok: false, backend: "appwrite", detail: `Appwrite unreachable: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  const forge = getForgeConfig();
  if (forge) {
    try {
      const probe = new URL("v1/storage/presign/get", forge.forgeUrl + "/");
      probe.searchParams.set("path", "health-probe.txt");
      const res = await fetch(probe, { headers: { Authorization: `Bearer ${forge.forgeKey}` }, signal: AbortSignal.timeout(10_000) });
      if (res.status === 401 || res.status === 403) { forgeUnauthorized = true; return { ok: false, backend: "forge", detail: unavailableMessage(`Forge ${res.status}`) }; }
      return { ok: true, backend: "forge", detail: "Forge reachable" };
    } catch (error) {
      return { ok: false, backend: "forge", detail: `Forge unreachable: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  return { ok: false, backend: "none", detail: unavailableMessage() };
}
