/**
 * Telegram control channel.
 *
 * The bot is an *operator* surface: it mirrors what the admin panel shows and
 * lets an owner ban, unban and answer support chats from their phone. It is
 * deliberately not a customer surface.
 *
 * Three rules shape everything below.
 *
 * 1. The token never appears in the repository. It is read from
 *    TELEGRAM_BOT_TOKEN at call time so a rotation only needs a redeploy.
 * 2. Every inbound update is authenticated twice: the shared secret in the
 *    webhook header, and an allowlist of chat ids. Anyone can find a bot and
 *    press start, so the chat id check is what actually protects the commands.
 * 3. Nothing here may ever throw into a caller. A Telegram outage must not fail
 *    a payment or block a support reply, so every send is fire-and-forget and
 *    swallows its own errors.
 */

const API_ROOT = "https://api.telegram.org";
const REQUEST_TIMEOUT_MS = 4_000;

export type TelegramSendResult = { ok: boolean; messageId?: number };

function token(): string | null {
  const value = process.env.TELEGRAM_BOT_TOKEN?.trim();
  return value && value.length > 20 ? value : null;
}

/** Chat ids allowed to issue commands. Without this the bot is read-only. */
function adminChatIds(): string[] {
  return (process.env.TELEGRAM_ADMIN_CHAT_IDS ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => /^-?\d+$/.test(entry));
}

export const telegramConfigured = () => Boolean(token()) && adminChatIds().length > 0;

export function isAdminChat(chatId: string | number | undefined | null): boolean {
  if (chatId === undefined || chatId === null) return false;
  return adminChatIds().includes(String(chatId));
}

/**
 * Verifies the webhook shared secret. Telegram echoes back whatever we set with
 * setWebhook, so a mismatch means the request did not come from Telegram.
 * Compared in constant time to avoid leaking the secret a byte at a time.
 */
export function verifyTelegramWebhookSecret(headerValue: string | undefined): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const received = headerValue?.trim() ?? "";
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let index = 0; index < expected.length; index += 1) {
    diff |= expected.charCodeAt(index) ^ received.charCodeAt(index);
  }
  return diff === 0;
}

/** Telegram's HTML parse mode only needs these three escaped. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function call(method: string, payload: Record<string, unknown>): Promise<TelegramSendResult> {
  const secret = token();
  if (!secret) return { ok: false };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_ROOT}/bot${secret}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false };
    const body = (await response.json()) as { ok?: boolean; result?: { message_id?: number } };
    return { ok: Boolean(body.ok), messageId: body.result?.message_id };
  } catch {
    // Deliberately silent. Callers are payment and support paths that must not
    // fail because Telegram is unreachable.
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}

export type InlineButton = { text: string; callbackData: string };

function keyboard(buttons: InlineButton[][] | undefined) {
  if (!buttons?.length) return undefined;
  return {
    inline_keyboard: buttons.map((row) =>
      row.map((button) => ({ text: button.text, callback_data: button.callbackData.slice(0, 64) })),
    ),
  };
}

export async function sendToChat(
  chatId: string | number,
  html: string,
  buttons?: InlineButton[][],
): Promise<TelegramSendResult> {
  return call("sendMessage", {
    chat_id: chatId,
    text: html.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(buttons),
  });
}

/** Broadcasts to every configured operator. Used for bans and new purchases. */
export async function notifyAdmins(html: string, buttons?: InlineButton[][]): Promise<void> {
  const ids = adminChatIds();
  if (!ids.length) return;
  await Promise.all(ids.map((chatId) => sendToChat(chatId, html, buttons)));
}

export async function sendPhotoToChat(chatId: string | number, imageUrl: string, caption: string): Promise<void> {
  await call("sendPhoto", { chat_id: chatId, photo: imageUrl, caption: caption.slice(0, 1024), parse_mode: "HTML" });
}

export async function sendVoiceToChat(chatId: string | number, audioUrl: string, caption: string): Promise<void> {
  // sendVoice expects OGG/Opus. Anything else (a browser webm recording) is
  // sent as a generic audio file so the operator can still play it.
  const method = audioUrl.endsWith(".ogg") ? "sendVoice" : "sendAudio";
  const key = method === "sendVoice" ? "voice" : "audio";
  await call(method, { chat_id: chatId, [key]: audioUrl, caption: caption.slice(0, 1024), parse_mode: "HTML" });
}

export async function notifyAdminsPhoto(imageUrl: string, caption: string): Promise<void> {
  await Promise.all(adminChatIds().map((chatId) => sendPhotoToChat(chatId, imageUrl, caption)));
}

export async function notifyAdminsVoice(audioUrl: string, caption: string): Promise<void> {
  await Promise.all(adminChatIds().map((chatId) => sendVoiceToChat(chatId, audioUrl, caption)));
}

/** Clears the spinner on an inline button press. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await call("answerCallbackQuery", { callback_query_id: callbackQueryId, text: text?.slice(0, 200) });
}

export async function editMessageText(
  chatId: string | number,
  messageId: number,
  html: string,
  buttons?: InlineButton[][],
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html.slice(0, 4096),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: keyboard(buttons),
  });
}
