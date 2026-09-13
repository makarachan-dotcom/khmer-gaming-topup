/**
 * Support-chat client helpers.
 *
 * Live support now lives on its own page (`/chat`) instead of a floating
 * panel, so every entry point (header mascot, purchase history row, login
 * screen) hands its intent to `openSupportChat()`. That stores the intent and
 * routes the visitor to `/chat`, where the encrypted conversation opens with
 * the topic and order already filled in.
 */

export const SUPPORT_CHAT_OPEN_EVENT = "zurs:open-support-chat";

/** Dedicated chat page. */
export const SUPPORT_CHAT_PATH = "/chat";
/** "How is this encrypted?" explainer linked from the chat header. */
export const SUPPORT_CHAT_SECURITY_PATH = "/chat/security";

const INTENT_STORAGE_KEY = "zurs:support-chat-intent";

export type SupportChatTopic = "order" | "payment" | "account" | "report" | "other";

export type SupportChatOpenIntent = {
  topic?: SupportChatTopic;
  /** Purchase ID (trackingCode) when the chat is opened from purchase history. */
  orderTrackingCode?: string;
  /** Pre-filled first message. */
  message?: string;
  subject?: string;
};

function storeIntent(intent: SupportChatOpenIntent) {
  try {
    if (!intent || Object.keys(intent).length === 0) {
      window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(INTENT_STORAGE_KEY, JSON.stringify(intent));
  } catch {
    /* private mode — the chat simply opens without a pre-fill */
  }
}

/** Reads (and clears) whatever the visitor clicked to get here. */
export function takeSupportChatIntent(): SupportChatOpenIntent {
  try {
    const raw = window.sessionStorage.getItem(INTENT_STORAGE_KEY);
    window.sessionStorage.removeItem(INTENT_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SupportChatOpenIntent;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Sends the visitor to the chat page.
 *
 * `SupportChatLauncher` (mounted once in the storefront layout) answers the
 * event with a client-side route change and calls `preventDefault()`. If no
 * launcher is mounted — e.g. an admin screen — we fall back to a full page
 * navigation so the button always works.
 */
export function openSupportChat(intent: SupportChatOpenIntent = {}) {
  if (typeof window === "undefined") return;
  storeIntent(intent);
  const event = new CustomEvent<SupportChatOpenIntent>(SUPPORT_CHAT_OPEN_EVENT, { detail: intent, cancelable: true });
  const handled = !window.dispatchEvent(event);
  if (handled) return;
  if (window.location.pathname !== SUPPORT_CHAT_PATH) window.location.assign(SUPPORT_CHAT_PATH);
}

export const supportChatTopics: { id: SupportChatTopic; label: string; hint: string; emoji: string }[] = [
  { id: "order", label: "បញ្ហាការបញ្ជាទិញ", hint: "កញ្ចប់មិនចូល ឬចូលខុស", emoji: "🎮" },
  { id: "payment", label: "បញ្ហាការទូទាត់", hint: "បង់រួច តែមិនទាន់ដំណើរការ", emoji: "💳" },
  { id: "account", label: "គណនី និងការចូល", hint: "ចូលមិនបាន ឬត្រូវបានផ្អាក", emoji: "🔐" },
  { id: "report", label: "រាយការណ៍បញ្ហា", hint: "បញ្ហាបច្ចេកទេស ឬការបោកប្រាស់", emoji: "🚨" },
  { id: "other", label: "ផ្សេងៗ", hint: "សំណួរទូទៅ", emoji: "💬" },
];

export function supportChatTopicLabel(topic: string) {
  return supportChatTopics.find((item) => item.id === topic)?.label ?? "ជំនួយ";
}

/**
 * Time-of-day greeting for the header mascot, in the visitor's own clock.
 * The storefront serves Cambodia, so the Khmer line leads and the English line
 * ("Good morning" / "Good afternoon") is what the request asked to show.
 */
export function mascotGreeting(now: Date = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return { en: "Good morning", kh: "អរុណសួស្តី", icon: "🌅" };
  if (hour < 17) return { en: "Good afternoon", kh: "ទិវាសួស្តី", icon: "☀️" };
  if (hour < 21) return { en: "Good evening", kh: "សាយណ្ហសួស្តី", icon: "🌇" };
  return { en: "Good night", kh: "រាត្រីសួស្តី", icon: "🌙" };
}

export const MASCOT_HELP_TEXT = "ត្រូវការជំនួយ?";

/** Reads a File/Blob as a base64 data URL for the upload mutations. */
export function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("មិនអាចអានឯកសារបានទេ"));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

/**
 * Downscales a picked photo so a phone camera shot still fits the upload cap,
 * and returns the raw bytes so they can be sealed before they ever leave the
 * device.
 */
export async function compressImageToBytes(
  file: File,
  maxEdge = 1600,
  quality = 0.82,
): Promise<{ bytes: ArrayBuffer; contentType: string; width: number; height: number }> {
  const fallbackType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    return { bytes: await file.arrayBuffer(), contentType: fallbackType, width: 0, height: 0 };
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas unavailable");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("encode failed");
    return { bytes: await blob.arrayBuffer(), contentType: "image/jpeg", width, height };
  } catch {
    return { bytes: await file.arrayBuffer(), contentType: fallbackType, width: 0, height: 0 };
  }
}

export function formatClock(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString("km-KH", { hour: "2-digit", minute: "2-digit" });
}

export function formatCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  if (hours > 0) return `${hours} ម៉ោង ${minutes} នាទី`;
  const secs = safe % 60;
  return `${minutes} នាទី ${secs} វិនាទី`;
}
