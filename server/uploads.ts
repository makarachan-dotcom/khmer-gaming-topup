import { nanoid } from "nanoid";
import { getAppwriteMediaFile, isAppwriteMediaKey, storagePut } from "./storage";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedPaymentIconTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/svg+xml"]);
const maxBytes = 5 * 1024 * 1024;
const maxPaymentIconBytes = 2 * 1024 * 1024;

export async function uploadMarketplaceScreenshot(input: { userId: number; fileName: string; contentType: string; dataUrl: string }) {
  if (!allowedImageTypes.has(input.contentType)) throw new Error("Only JPG, PNG, and WEBP images are supported");
  const [header, encoded] = input.dataUrl.split(",", 2);
  if (!header?.startsWith(`data:${input.contentType};base64`) || !encoded) throw new Error("Invalid image payload");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) throw new Error("Each image must be smaller than 5 MB");
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || "screenshot";
  return storagePut(`marketplace-listings-private/${input.userId}/${safeName}-${nanoid(8)}.${extension}`, bytes, input.contentType);
}

export async function uploadMarketplaceVerificationEvidence(input: { userId: number; verificationId: string; evidenceType: "national_id_front" | "national_id_back" | "selfie_liveness"; fileName: string; contentType: string; dataUrl: string }) {
  if (!allowedImageTypes.has(input.contentType)) throw new Error("Only JPG, PNG, and WEBP images are supported");
  const [header, encoded] = input.dataUrl.split(",", 2);
  if (!header?.startsWith(`data:${input.contentType};base64`) || !encoded) throw new Error("Invalid identity-evidence payload");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) throw new Error("Each identity image must be smaller than 5 MB");
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1];
  const result = await storagePut(`marketplace-private/${input.userId}/${input.verificationId}/${input.evidenceType}-${nanoid(8)}.${extension}`, bytes, input.contentType);
  return { ...result, byteSize: bytes.length };
}

export async function uploadAdminMediaImage(input: { adminUserId: number; fileName: string; contentType: string; dataUrl: string }) {
  if (!allowedImageTypes.has(input.contentType)) throw new Error("Only JPG, PNG, and WEBP images are supported");
  const [header, encoded] = input.dataUrl.split(",", 2);
  if (!header?.startsWith(`data:${input.contentType};base64`) || !encoded) throw new Error("Invalid media image payload");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) throw new Error("Each image must be smaller than 5 MB");
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || "media";
  const stored = await storagePut(`admin-media/${input.adminUserId}/${safeName}-${nanoid(8)}.${extension}`, bytes, input.contentType);
  // Do not hand the editor a URL that the server cannot immediately read back.
  // This catches Appwrite bucket/key misconfiguration before it becomes a broken preview.
  if (isAppwriteMediaKey(stored.key) && !(await getAppwriteMediaFile(stored.key))) {
    throw new Error("រូបភាពត្រូវបាន upload ប៉ុន្តែ storage មិនអាចអានបានទេ។ សូមព្យាយាមម្ដងទៀត។");
  }
  return stored;
}

export async function uploadAdminPaymentMethodIcon(input: { adminUserId: number; fileName: string; contentType: string; dataUrl: string }) {
  if (!allowedPaymentIconTypes.has(input.contentType)) throw new Error("Only JPG, PNG, WEBP, and SVG payment icons are supported");
  const [header, encoded] = input.dataUrl.split(",", 2);
  if (!header?.startsWith(`data:${input.contentType};base64`) || !encoded) throw new Error("Invalid payment icon payload");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maxPaymentIconBytes) throw new Error("Each payment icon must be smaller than 2 MB");
  if (input.contentType === "image/svg+xml") {
    const svg = bytes.toString("utf8");
    if (!/^\s*<svg[\s>]/i.test(svg) || /<\s*(?:script|foreignObject)\b|\bon\w+\s*=|javascript\s*:/i.test(svg)) throw new Error("Unsafe SVG payment icon");
  }
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType === "image/svg+xml" ? "svg" : input.contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || "payment-icon";
  return storagePut(`payment-method-icons/${input.adminUserId}/${safeName}-${nanoid(8)}.${extension}`, bytes, input.contentType);
}
