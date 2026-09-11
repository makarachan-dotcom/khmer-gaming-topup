import { deviceHeaders } from "./loginGuard";

/* Shapes mirror `publicSession()` in server/supportChatRoutes.ts. Keep in sync. */

export type SupportMessageRole = "user" | "admin" | "system";
export type SupportMessageKind = "text" | "image" | "voice";

export type SupportMessage = {
  id: string;
  role: SupportMessageRole;
  kind: SupportMessageKind;
  text: string;
  mediaUrl?: string | null;
  at: string;
};

export type SupportSessionStatus = "waiting" | "active" | "closed";

export type SupportSessionView = {
  id: string;
  status: SupportSessionStatus;
  topic: string;
  orderRef?: string | null;
  openedAt: string;
  closedAt?: string | null;
  adminTyping: boolean;
  messages: SupportMessage[];
};

export type SupportQuota = {
  used: number;
  limit: number;
  blocked: boolean;
  resetsInSeconds: number;
};

export type SupportState = {
  authenticated: boolean;
  displayName?: string | null;
  quota: SupportQuota;
  session: SupportSessionView | null;
};

export type SupportErrorCode =
  | "SIGN_IN_REQUIRED"
  | "SUPPORT_DAILY_LIMIT"
  | "SESSION_CLOSED"
  | "SESSION_NOT_FOUND"
  | "EMPTY_MESSAGE"
  | "UNSUPPORTED_TYPE"
  | "INVALID_PAYLOAD"
  | "TOO_LARGE"
  | "STORAGE_UNAVAILABLE"
  | "RATE_LIMITED"
  | "LOGIN_BLOCKED"
  | "NETWORK"
  | "UNKNOWN";

/** Customer-facing Khmer copy. The server never sends translated strings. */
const MESSAGE_KH: Record<SupportErrorCode, string> = {
  SIGN_IN_REQUIRED: "សូមចូលគណនីជាមុនសិន ដើម្បីឆាតជាមួយក្រុមជំនួយ។",
  SUPPORT_DAILY_LIMIT: "អ្នកបានប្រើសិទ្ធិឆាតសម្រាប់ថ្ងៃនេះរួចហើយ។",
  SESSION_CLOSED: "ការឆាតនេះត្រូវបានបិទ។ សាររបស់អ្នកមិនបានផ្ញើទេ។",
  SESSION_NOT_FOUND: "ការឆាតនេះលែងមានទៀត។ សូមចាប់ផ្ដើមឆាតថ្មី។",
  EMPTY_MESSAGE: "សូមសរសេរសារជាមុនសិន។",
  UNSUPPORTED_TYPE: "ប្រភេទឯកសារនេះមិនអនុញ្ញាតទេ។",
  INVALID_PAYLOAD: "ឯកសារនេះមិនត្រឹមត្រូវទេ។",
  TOO_LARGE: "ឯកសារធំពេក។ សូមបញ្ជូនឯកសារតូចជាងនេះ។",
  STORAGE_UNAVAILABLE: "ប្រព័ន្ធរក្សាទុកមិនដំណើរការមួយរយៈ។ សូមព្យាយាមម្ដងទៀត ឬទាក់ទងតាម Telegram។",
  RATE_LIMITED: "អ្នកផ្ញើញឹកញាប់ពេក។ សូមចាំបន្តិច។",
  LOGIN_BLOCKED: "គណនីនេះត្រូវបានផ្អាក។",
  NETWORK: "ការតភ្ជាប់មិនស្ថិតស្ថេរ។ សូមព្យាយាមម្ដងទៀត។",
  UNKNOWN: "មានបញ្ហាបន្តិចបន្តួច។ សូមព្យាយាមម្ដងទៀត។",
};

export class SupportChatError extends Error {
  code: SupportErrorCode;
  status: number;
  retryAfter: number;
  quota: SupportQuota | null;

  constructor(code: SupportErrorCode, status: number, quota?: SupportQuota | null, retryAfter?: number) {
    super(MESSAGE_KH[code] ?? MESSAGE_KH.UNKNOWN);
    this.name = "SupportChatError";
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter ?? 0;
    this.quota = quota ?? null;
    // Required for `instanceof` to survive the ES5 downlevel of `extends Error`.
    Object.setPrototypeOf(this, SupportChatError.prototype);
  }
}

function asCode(value: unknown): SupportErrorCode {
  const known: SupportErrorCode[] = [
    "SIGN_IN_REQUIRED",
    "SUPPORT_DAILY_LIMIT",
    "SESSION_CLOSED",
    "SESSION_NOT_FOUND",
    "EMPTY_MESSAGE",
    "UNSUPPORTED_TYPE",
    "INVALID_PAYLOAD",
    "TOO_LARGE",
    "STORAGE_UNAVAILABLE",
    "RATE_LIMITED",
    "LOGIN_BLOCKED",
  ];
  return known.indexOf(value as SupportErrorCode) >= 0 ? (value as SupportErrorCode) : "UNKNOWN";
}

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      credentials: "include",
      headers: deviceHeaders(),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SupportChatError("NETWORK", 0);
  }

  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const retryHeader = Number(response.headers.get("Retry-After") ?? 0);
    const retryAfter = Number.isFinite(retryHeader) && retryHeader > 0 ? retryHeader : Number(payload.retryAfter ?? 0) || 0;
    throw new SupportChatError(
      asCode(payload.code),
      response.status,
      (payload.quota as SupportQuota | undefined) ?? null,
      retryAfter,
    );
  }

  return payload as T;
}

export function fetchSupportState() {
  return request<SupportState>("/api/support/chat/state");
}

/** Opening while a chat is already open resumes it and costs nothing. */
export function openSupportChat(input?: { topic?: string; orderRef?: string | null }) {
  return request<{ session: SupportSessionView; resumed: boolean }>("/api/support/chat/open", "POST", {
    topic: input?.topic ?? "",
    orderRef: input?.orderRef ?? "",
  });
}

export function pollSupportChat(sessionId: string) {
  return request<{ session: SupportSessionView }>(`/api/support/chat/${encodeURIComponent(sessionId)}`);
}

export function sendSupportText(sessionId: string, text: string) {
  return request<{ session: SupportSessionView }>("/api/support/chat/message", "POST", { sessionId, text });
}

export function sendSupportMedia(input: {
  sessionId: string;
  kind: "image" | "voice";
  dataUrl: string;
  contentType: string;
}) {
  return request<{ session: SupportSessionView }>("/api/support/chat/upload", "POST", input);
}

export function closeSupportChat(sessionId: string) {
  return request<{ closed: boolean; quota: SupportQuota }>("/api/support/chat/close", "POST", { sessionId });
}

/* Client-side mirrors of the server limits so we can refuse before uploading. */
export const supportImageMaxBytes = 4 * 1024 * 1024;
export const supportAudioMaxBytes = 3 * 1024 * 1024;
export const supportImageTypes = ["image/jpeg", "image/png", "image/webp"];
export const supportAudioTypes = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"];
export const supportTextMaxLength = 2000;

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new SupportChatError("INVALID_PAYLOAD", 0));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new SupportChatError("INVALID_PAYLOAD", 0));
    };
    reader.readAsDataURL(blob);
  });
}

/** Strips the codec suffix browsers append, e.g. `audio/webm;codecs=opus`. */
export function baseMimeType(value: string) {
  return (value || "").split(";")[0].trim().toLowerCase();
}
