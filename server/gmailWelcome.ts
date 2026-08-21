import crypto from "node:crypto";

const logoUrl = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663688034315/kBXeVXEnNVEuNZKS.jpg";

function encryptionKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT secret is unavailable for Gmail token encryption");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptRefreshToken(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptRefreshToken(value: string) {
  const [ivValue, tagValue, encryptedValue] = value.split(".");
  if (!ivValue || !tagValue || !encryptedValue) throw new Error("Invalid encrypted Gmail token");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character] ?? character);
}

export function buildWelcomeEmail(input: { recipientName: string; recipientEmail: string; senderEmail: string }) {
  const name = escapeHtml(input.recipientName || "ZURS Member");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f8fc;font-family:Arial,'Noto Sans Khmer',sans-serif;color:#172033"><div style="max-width:560px;margin:0 auto;padding:32px 16px"><div style="overflow:hidden;border-radius:22px;background:linear-gradient(135deg,#12172c,#252b63);padding:28px;color:white"><img src="${logoUrl}" width="52" height="52" alt="ZURS STORE" style="display:block;border-radius:14px;margin-bottom:18px"><p style="margin:0;color:#c8d0ff;font-size:11px;font-weight:700;letter-spacing:1.5px">ZURS STORE · GAMING & DIGITAL</p><h1 style="margin:10px 0 0;font-size:26px;line-height:1.3">សូមស្វាគមន៍ ${name}</h1><p style="margin:12px 0 0;color:#dce0f3;font-size:14px;line-height:1.7">គណនីរបស់អ្នកត្រូវបានភ្ជាប់រួចរាល់។ អ្នកអាចចាប់ផ្តើមប្រើប្រាស់សេវាហ្គេម និង Marketplace របស់ ZURS STORE បាន។</p></div><div style="background:#ffffff;padding:24px;border:1px solid #e8eaf2;border-top:0;border-radius:0 0 22px 22px"><p style="margin:0;font-size:14px;line-height:1.75">យើងផ្ញើអ៊ីមែលនេះទៅកាន់ <strong>${escapeHtml(input.recipientEmail)}</strong> បន្ទាប់ពីអ្នកជ្រើសរើសភ្ជាប់គណនីដោយ Google។</p><p style="margin:16px 0 0;font-size:12px;line-height:1.7;color:#647087">សម្រាប់សុវត្ថិភាព សូមកុំចែករំលែកពាក្យសម្ងាត់ ឬលេខកូដផ្ទៀងផ្ទាត់របស់អ្នកជាមួយនរណាម្នាក់។</p></div><p style="margin:18px 0 0;text-align:center;font-size:11px;color:#7b8497">© ZURS STORE · by ZURS STORE</p></div></body></html>`;
  const text = `សូមស្វាគមន៍ ${input.recipientName || "ZURS Member"}។ គណនីរបស់អ្នកត្រូវបានភ្ជាប់រួចរាល់ជាមួយ ZURS STORE។`;
  const raw = [`To: ${input.recipientEmail}`, `From: ZURS STORE <${input.senderEmail}>`, "Subject: សូមស្វាគមន៍មកកាន់ ZURS STORE", "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "", html].join("\r\n");
  return { raw: Buffer.from(raw).toString("base64url"), text };
}

export async function sendGmailWelcomeEmail(input: { refreshToken: string; senderEmail: string; recipientEmail: string; recipientName: string }) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Google OAuth is not configured");
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: input.refreshToken, grant_type: "refresh_token" }) });
  const token = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !token.access_token) throw new Error(token.error ?? "Unable to refresh the Gmail sender token");
  const message = buildWelcomeEmail(input);
  const sendResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ raw: message.raw }) });
  const result = await sendResponse.json() as { id?: string; error?: { message?: string } };
  if (!sendResponse.ok || !result.id) throw new Error(result.error?.message ?? "Gmail did not accept the welcome email");
  return result.id;
}
