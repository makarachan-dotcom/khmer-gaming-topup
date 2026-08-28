import { Account, Client, ID } from "appwrite";

type SessionExchangeResponse = { authenticated: boolean; user: { id: number; name: string | null; displayName: string | null; email: string | null; role: "admin" | "user" } };

function createAccount() {
  const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT?.trim();
  const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID?.trim();
  if (!endpoint || !projectId) throw new Error("Appwrite sign-in is not configured.");
  const client = new Client().setEndpoint(endpoint).setProject(projectId);
  return new Account(client);
}

export async function requestAppwriteEmailOtp(email: string) {
  const account = createAccount();
  const token = await account.createEmailToken({ userId: ID.unique(), email: email.trim().toLowerCase(), phrase: false });
  return { userId: token.userId };
}

export async function completeAppwriteEmailOtp(input: { userId: string; secret: string }) {
  const account = createAccount();
  await account.createSession({ userId: input.userId, secret: input.secret.trim() });
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
