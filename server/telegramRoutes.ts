import type { Express, Request, Response } from "express";
import {
  banIpNow,
  formatRetryAfterKh,
  liftLoginBan,
  listActiveLoginBans,
} from "./loginAbuseGuard";
import {
  appendMessage,
  closeSupportSession,
  getSession,
  listOpenSessions,
  setAdminTyping,
  type SupportSession,
} from "./supportChat";
import {
  answerCallbackQuery,
  escapeHtml,
  isAdminChat,
  sendToChat,
  telegramConfigured,
  verifyTelegramWebhookSecret,
} from "./telegramBot";
import { rateLimitBackendConfigured, redisPipeline } from "./rateLimit";

/**
 * Telegram operator console.
 *
 * The webhook is a public URL, so authentication is layered:
 *   1. the shared secret Telegram echoes in X-Telegram-Bot-Api-Secret-Token,
 *   2. an allowlist of operator chat ids.
 * The second check is the one that matters. Anyone can find a bot and press
 * start, so without the chat-id allowlist the commands below would be open to
 * the internet. A non-operator is answered with silence, not an error, so the
 * bot does not confirm its own existence to a prober.
 *
 * The webhook always answers 200. Telegram retries non-200 responses, and a
 * retry storm on a handler that already ran would double-post replies.
 */

/** Which support chat an operator's plain-text messages are routed to. */
const replyTargetKey = (chatId: string) => `tg:reply:${chatId}`;
const replyTargetTtlSeconds = 60 * 60;
const memoryReplyTarget = new Map<string, { sessionId: string; expiresAt: number }>();

async function setReplyTarget(chatId: string, sessionId: string): Promise<void> {
  if (!rateLimitBackendConfigured) {
    memoryReplyTarget.set(chatId, { sessionId, expiresAt: Date.now() + replyTargetTtlSeconds * 1_000 });
    return;
  }
  try {
    await redisPipeline([["SET", replyTargetKey(chatId), sessionId, "EX", replyTargetTtlSeconds]]);
  } catch {
    memoryReplyTarget.set(chatId, { sessionId, expiresAt: Date.now() + replyTargetTtlSeconds * 1_000 });
  }
}

async function getReplyTarget(chatId: string): Promise<string | null> {
  if (!rateLimitBackendConfigured) {
    const entry = memoryReplyTarget.get(chatId);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
      memoryReplyTarget.delete(chatId);
      return null;
    }
    return entry.sessionId;
  }
  try {
    const [raw] = await redisPipeline([["GET", replyTargetKey(chatId)]]);
    return ((raw as { result?: string } | null)?.result as string) ?? null;
  } catch {
    return memoryReplyTarget.get(chatId)?.sessionId ?? null;
  }
}

function sessionCard(session: SupportSession): string {
  const lines = [
    `\u{1F4AC} <b>${escapeHtml(session.displayName ?? "Customer")}</b>`,
    `Email: ${escapeHtml(session.email ?? "\u2014")}`,
    `Device: ${escapeHtml(session.device ?? "\u2014")}`,
    `IP: <code>${escapeHtml(session.ip ?? "\u2014")}</code>`,
    `Topic: ${escapeHtml(session.topic)}`,
    session.orderRef ? `Order: <code>${escapeHtml(session.orderRef)}</code>` : null,
    `Status: ${session.status}`,
    `Session: <code>${session.id}</code>`,
  ].filter(Boolean);

  const recent = session.messages.slice(-6).map((message) => {
    const who = message.role === "user" ? "\u{1F464}" : message.role === "admin" ? "\u{1F6E1}\uFE0F" : "\u2139\uFE0F";
    return `${who} ${escapeHtml(message.text)}${message.mediaUrl ? `\n${escapeHtml(message.mediaUrl)}` : ""}`;
  });

  return `${lines.join("\n")}${recent.length ? `\n\n<b>Recent</b>\n${recent.join("\n")}` : ""}`;
}

function chatButtons(sessionId: string) {
  return [
    [
      { text: "\u2709\uFE0F Reply", callbackData: `sc:reply:${sessionId}` },
      { text: "\u2705 Close chat", callbackData: `sc:close:${sessionId}` },
    ],
  ];
}

const helpText = [
  "<b>ZURS operator commands</b>",
  "",
  "<b>Bans</b>",
  "/bans \u2014 list active blocks with IP and device",
  "/unban &lt;id&gt; \u2014 release a block",
  "/ban &lt;ip&gt; \u2014 block an address for 24h",
  "",
  "<b>Support chats</b>",
  "/chats \u2014 list open conversations",
  "/chat &lt;id&gt; \u2014 show one conversation",
  "/close &lt;id&gt; \u2014 close a conversation",
  "/r &lt;text&gt; \u2014 reply to the selected chat",
  "",
  "Tap <b>Reply</b> on a chat, then send plain messages to answer it.",
].join("\n");

async function bansMessage(): Promise<string> {
  const { durable, bans } = await listActiveLoginBans();
  if (!bans.length) return "\u2705 មិនមានការផ្អាកដំណើរការទេ។ (no active blocks)";
  const rows = bans.slice(0, 12).map((ban) => {
    return [
      `\u{1F6AB} <b>${escapeHtml(ban.scope)}</b> \u00b7 ${escapeHtml(ban.label)}`,
      `IP: <code>${escapeHtml(ban.ip ?? "\u2014")}</code>`,
      `Device: ${escapeHtml(ban.device ?? "\u2014")}`,
      `Email: ${escapeHtml(ban.email ?? "\u2014")}`,
      `Strikes: ${ban.strikes} \u00b7 នៅសល់ ${escapeHtml(formatRetryAfterKh(ban.retryAfterSeconds))}`,
      `<code>${escapeHtml(ban.id)}</code>`,
    ].join("\n");
  });
  const warning = durable ? "" : "\n\n\u26A0\uFE0F Redis is not configured, so blocks are per-instance only.";
  return `<b>Active blocks (${bans.length})</b>\n\n${rows.join("\n\n")}${warning}`;
}

async function handleCommand(chatId: string, text: string): Promise<void> {
  const [rawCommand, ...rest] = text.trim().split(/\s+/);
  const command = (rawCommand ?? "").split("@")[0]?.toLowerCase() ?? "";
  const argument = rest.join(" ").trim();

  if (command === "/start" || command === "/help") {
    await sendToChat(chatId, helpText);
    return;
  }

  if (command === "/bans") {
    const message = await bansMessage();
    const { bans } = await listActiveLoginBans();
    await sendToChat(
      chatId,
      message,
      bans.slice(0, 5).map((ban) => [{ text: `\u{1F513} Unban ${ban.label}`, callbackData: `ban:lift:${ban.id}` }]),
    );
    return;
  }

  if (command === "/unban") {
    if (!argument) return void (await sendToChat(chatId, "Usage: /unban &lt;id&gt;"));
    const result = await liftLoginBan({ id: argument, actorLabel: `telegram:${chatId}` });
    await sendToChat(
      chatId,
      result.lifted
        ? `\u2705 បានដោះបែន <code>${escapeHtml(argument)}</code>`
        : `\u26A0\uFE0F មិនមានការផ្អាកនេះទេ: <code>${escapeHtml(argument)}</code>`,
    );
    return;
  }

  if (command === "/ban") {
    if (!argument) return void (await sendToChat(chatId, "Usage: /ban &lt;ip&gt;"));
    const result = await banIpNow({ ip: argument, actorLabel: `telegram:${chatId}` });
    await sendToChat(
      chatId,
      result.blocked
        ? `\u{1F6AB} បានផ្អាក <code>${escapeHtml(argument)}</code> រយៈពេល 24 ម៉ោង`
        : `\u26A0\uFE0F IP មិនត្រឹមត្រូវ: <code>${escapeHtml(argument)}</code>`,
    );
    return;
  }

  if (command === "/chats") {
    const sessions = await listOpenSessions();
    if (!sessions.length) return void (await sendToChat(chatId, "\u2705 មិនមានការជជែកបើកចំទេ។"));
    for (let index = 0; index < Math.min(sessions.length, 5); index += 1) {
      const session = sessions[index];
      if (session) await sendToChat(chatId, sessionCard(session), chatButtons(session.id));
    }
    return;
  }

  if (command === "/chat") {
    const session = argument ? await getSession(argument) : null;
    if (!session) return void (await sendToChat(chatId, "\u26A0\uFE0F រកមិនឃើញការជជែកនេះ។"));
    await setReplyTarget(chatId, session.id);
    await sendToChat(chatId, sessionCard(session), chatButtons(session.id));
    return;
  }

  if (command === "/close") {
    const target = argument || (await getReplyTarget(chatId));
    if (!target) return void (await sendToChat(chatId, "Usage: /close &lt;id&gt;"));
    const result = await closeSupportSession({ sessionId: target, closedBy: `telegram:${chatId}` });
    await sendToChat(
      chatId,
      result.closed
        ? `\u2705 បិទការជជែក <code>${escapeHtml(target)}</code>\nការជជែកនេះគឺត 1 ដងក្នុងថ្ងៃរបស់អតិថិជន។`
        : "\u26A0\uFE0F ការជជែកនេះបិទរួចហើយ ឬរកមិនឃើញ។",
    );
    return;
  }

  if (command === "/r") {
    const target = await getReplyTarget(chatId);
    if (!target) return void (await sendToChat(chatId, "\u26A0\uFE0F ជ្រើសការជជែកមួយជាមុន (/chats)"));
    if (!argument) return void (await sendToChat(chatId, "Usage: /r &lt;text&gt;"));
    const updated = await appendMessage({ sessionId: target, role: "admin", kind: "text", text: argument });
    await sendToChat(chatId, updated ? "\u2705 បានផ្ញើ" : "\u26A0\uFE0F ការជជែកបិទរួចហើយ។");
    return;
  }

  // Plain text with a selected chat is treated as a reply, which is how an
  // operator actually wants to work on a phone.
  const target = await getReplyTarget(chatId);
  if (target && !text.startsWith("/")) {
    await setAdminTyping(target, 0);
    const updated = await appendMessage({ sessionId: target, role: "admin", kind: "text", text });
    await sendToChat(chatId, updated ? "\u2705 បានផ្ញើ" : "\u26A0\uFE0F ការជជែកបិទរួចហើយ។");
    return;
  }

  await sendToChat(chatId, helpText);
}

async function handleCallback(chatId: string, callbackId: string, data: string): Promise<void> {
  const [namespace, action, ...idParts] = data.split(":");
  const id = idParts.join(":");

  if (namespace === "ban" && action === "lift" && id) {
    const result = await liftLoginBan({ id, actorLabel: `telegram:${chatId}` });
    await answerCallbackQuery(callbackId, result.lifted ? "Unbanned" : "Not found");
    await sendToChat(
      chatId,
      result.lifted ? `\u2705 បានដោះបែន <code>${escapeHtml(id)}</code>` : "\u26A0\uFE0F មិនឃើញការផ្អាកនេះ។",
    );
    return;
  }

  if (namespace === "sc" && action === "reply" && id) {
    await setReplyTarget(chatId, id);
    // Show the customer a typing indicator immediately, so they know a human
    // picked the conversation up before the first words arrive.
    await setAdminTyping(id, 60);
    await answerCallbackQuery(callbackId, "Reply mode on");
    await sendToChat(chatId, `\u2709\uFE0F កំពុងឆ្លើយតប <code>${escapeHtml(id)}</code>\nសូមផ្ញើសារជាអក្សរធម្មតា។`);
    return;
  }

  if (namespace === "sc" && action === "close" && id) {
    const result = await closeSupportSession({ sessionId: id, closedBy: `telegram:${chatId}` });
    await answerCallbackQuery(callbackId, result.closed ? "Chat closed" : "Already closed");
    await sendToChat(
      chatId,
      result.closed
        ? `\u2705 បិទការជជែក <code>${escapeHtml(id)}</code>`
        : "\u26A0\uFE0F ការជជែកនេះបិទរួចហើយ។",
    );
    return;
  }

  await answerCallbackQuery(callbackId);
}

export function registerTelegramRoutes(app: Express) {
  app.get("/api/webhooks/telegram/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.json({ configured: telegramConfigured() });
  });

  app.post("/api/webhooks/telegram", async (req: Request, res: Response) => {
    // Always 200. Telegram retries anything else, and a retry would re-run a
    // handler that already posted its reply.
    const acknowledge = () => res.status(200).json({ ok: true });

    if (!verifyTelegramWebhookSecret(req.header("x-telegram-bot-api-secret-token"))) {
      console.warn("[telegram] rejected update with bad secret");
      return acknowledge();
    }

    try {
      const update = req.body as {
        message?: { chat?: { id?: number }; text?: string };
        callback_query?: { id?: string; data?: string; message?: { chat?: { id?: number } } };
      };

      const callback = update.callback_query;
      if (callback?.id && callback.data) {
        const chatId = String(callback.message?.chat?.id ?? "");
        if (!isAdminChat(chatId)) return acknowledge();
        await handleCallback(chatId, callback.id, callback.data);
        return acknowledge();
      }

      const message = update.message;
      if (message?.text) {
        const chatId = String(message.chat?.id ?? "");
        // Silence, not an error: never confirm the bot exists to a prober.
        if (!isAdminChat(chatId)) return acknowledge();
        await handleCommand(chatId, message.text);
      }
      return acknowledge();
    } catch (error) {
      console.error("[telegram] update failed", error);
      return acknowledge();
    }
  });
}

export function resetTelegramReplyTargetsForTests() {
  memoryReplyTarget.clear();
}
