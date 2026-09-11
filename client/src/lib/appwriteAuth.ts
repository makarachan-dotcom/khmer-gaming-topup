import { Account, AppwriteException, Client, ID } from "appwrite";
import { loginErrorKh } from "./loginUi";

type SessionExchangeResponse = {
  authenticated: boolean;
  /** True only the first time this mailbox ever completes sign-in here. */
  isNewUser?: boolean;
  /** The server asks for a display name only when it has none stored. */
  needsName?: boolean;
  /** The name already on file, so a returning member never re-enters it. */
  savedName?: string | null;
  user: { id: number; name: string | null; displayName: string | null; email: string | null; role: "admin" | "user" };
};

function createAccount() {
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT?.trim();
  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim();
  if (!endpoint || !projectId) throw new Error("Appwrite sign-in is not configured.");
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  return new Account(client);
}

async function otpUserIdForEmail(email: string) {
  const data = new TextEncoder().encode(email.trim().toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", data);
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `e${hex.slice(0, 35)}`;
}

export async function requestAppwriteEmailOtp(email: string) {
  const account = createAccount();
  const normalized = email.trim().toLowerCase();
  try {
    const token = await account.createEmailToken({ userId: await otpUserIdForEmail(normalized), email: normalized, phrase: false });
    return { userId: token.userId };
  } catch (reason) {
    if (reason instanceof AppwriteException && (reason.code === 409 || reason.type === "user_already_exists")) {
      const token = await account.createEmailToken({ userId: ID.unique(), email: normalized, phrase: false });
      return { userId: token.userId };
    }
    if (reason instanceof AppwriteException) {
      // Log code/type only (no PII) so delivery issues are diagnosable in console.
      console.error("[OTP] createEmailToken failed:", reason.code, reason.type);
      if (reason.code === 429) throw new Error("ស្នើកូដច្រើនពេកហើយ — សូមរង់ចាំ ១៥ នាទី រួចព្យាយាមម្តងទៀត។");
      if (reason.code === 400) throw new Error("អ៊ីមែលមិនត្រឹមត្រូវ — សូមពិនិត្យម្តងទៀត។");
    }
    throw new Error("មិនអាចផ្ញើលេខកូដបានទេ — សូមព្យាយាមម្តងទៀត ឬទាក់ទង Support។");
  }
}

export async function completeAppwriteEmailOtp(input: { userId: string; secret: string }) {
  const account = createAccount();
  try {
    await account.createSession({ userId: input.userId, secret: input.secret.trim() });
  } catch (reason) {
    if (reason instanceof AppwriteException) {
      console.error("[OTP] createSession failed:", reason.code, reason.type);
    }
    throw new Error(loginErrorKh(reason, "verify"));
  }
  const jwt = await account.createJWT({ duration: 900 });
  const response = await fetch("/api/auth/appwrite/session", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jwt: jwt.jwt }),
  });
  if (!response.ok) throw new Error("មិនអាចបញ្ជាក់ការចូលគណនីបានទេ។ សូមសាកម្តងទៀត។");
  return response.json() as Promise<SessionExchangeResponse>;
}

export async function logoutFromAppwrite() {
  try {
    await createAccount().deleteSession({ sessionId: "current" });
  } catch {
    // A missing/expired Appwrite session is already effectively logged out.
  }
}

export async function getAppwriteAccount() {
  return createAccount().get();
}

export async function updateAppwriteAccountName(name: string) {
  return createAccount().updateName(name.trim());
}
