import { nanoid } from "nanoid";
import { storagePut } from "./storage";

const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxBytes = 5 * 1024 * 1024;

export async function uploadMarketplaceScreenshot(input: { userId: number; fileName: string; contentType: string; dataUrl: string }) {
  if (!allowedImageTypes.has(input.contentType)) throw new Error("Only JPG, PNG, and WEBP images are supported");
  const [header, encoded] = input.dataUrl.split(",", 2);
  if (!header?.startsWith(`data:${input.contentType};base64`) || !encoded) throw new Error("Invalid image payload");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0 || bytes.length > maxBytes) throw new Error("Each image must be smaller than 5 MB");
  const extension = input.contentType === "image/jpeg" ? "jpg" : input.contentType.split("/")[1];
  const safeName = input.fileName.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 48) || "screenshot";
  return storagePut(`marketplace/${input.userId}/${safeName}-${nanoid(8)}.${extension}`, bytes, input.contentType);
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
