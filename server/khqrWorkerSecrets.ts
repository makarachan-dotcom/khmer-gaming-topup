import crypto from "node:crypto";

function derive(label: string) {
  const root = process.env.JWT_SECRET;
  if (!root || root.length < 32) return null;
  return crypto.createHmac("sha256", root).update(`zurs-khqr:${label}:v1`).digest("hex");
}

export function getKhqrWorkerCredentials() {
  const apiKey = process.env.KHQR_AUTOMATION_API_KEY || derive("automation-api");
  const callbackSecret = process.env.KHQR_WORKER_CALLBACK_SECRET || derive("callback");
  return { apiKey, callbackSecret };
}
