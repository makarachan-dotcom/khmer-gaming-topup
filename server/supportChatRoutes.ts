import type { Express, Request, Response } from "express";
import { nanoid } from "nanoid";
import { sdk } from "./_core/sdk";
import { getUserByOpenId } from "./db";
import { readZursSession } from "./zursSession";
import { clientIpFromRequest, consumeRateLimit, rateLimitBuckets, sendRateLimited } from "./rateLimit";
import { describeRequestDevice } from "./deviceInsight";
import { storagePut } from "./storage";
import {
  appendMessage,
  closeSupportSession,
  getActiveSessionForUser,
  getSession,
  openSupportSession,
  supportDailyLimit,
  supportQuotaState,
  type SupportSession,
} from "./supportChat";
import { escapeHtml, notifyAdmins, notifyAdminsPhoto, notifyAdminsVoice } from "./telegramBot";

/**
 * Customer-facing support chat API.
 *
 * Two things here are deliberate and worth keeping.
 *
 * A banned visitor MUST be able to reach these endpoints. The whole point of
 * putting a chat on the lock screen is that someone wrongly caught by a shared
 * carrier address can ask a human to release them. `ipBanGuard` therefore
 * exempts `/api/support/`, and the quota below is what stops that exemption
 * from becoming a spam hole.
 *
 * Uploads are re-encoded through our own storage rather than passed through as
 * a URL. A customer-supplied URL forwarded to Telegram would let anyone use the
 * bot as a request proxy against internal addresses.
 */

const maxImageBytes = 4 * 1024 * 1024;
const maxAudioBytes = 3 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedAudioTypes = new Set(["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"]);

type Actor = { id: number; email: string | null; displayName: string | null; role: string | null };

function secureHeaders(res: Response) {
  res.setHeader("Cache-Control", "no-store, private, max-age=0");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

/** Resolves the signed-in customer. Support chat is never anonymous: the quota
 *  is per person, so an unauthenticated chat would be uncountable. */
async function resolveActor(req: Request): Promise<Actor | null> {
  const shape = (value: unknown): Actor | null => {
    const row = value as { id?: unknown; email?: unknown; displayName?: unknown; name?: unknown; role?: unknown } | null;
    if (!row || typeof row.id !== "number") return null;
    return {
      id: row.id,
      email: typeof row.email === "string" ? row.email : null,
      displayName:
        (typeof row.displayName === "string" && row.displayName) ||
        (typeof row.name === "string" && row.name) ||
        null,
      role: typeof row.role === "string" ? row.role : null,
    };
  };

  try {
    const authed = shape(await sdk.authenticateRequest(req));
    if (authed) return authed;
  } catch {
    /* fall through to the cookie session */
  }
  const openId = await readZursSession(req);
  if (!openId) return null;
  return shape(await getUserByOpenId(openId));
}

function publicSession(session: SupportSession) {
  const typing = session.adminTypingUntil ? Date.parse(session.adminTypingUntil) > Date.now() : false;
  return {
    id: session.id,
    status: session.status,
    topic: session.topic,
    orderRef: session.orderRef,
    openedAt: session.openedAt,
    closedAt: session.closedAt,
    adminTyping: typing,
    messages: session.messages.map((message) => ({
      id: message.id,
      role: message.role,
      kind: message.kind,
      text: message.text,
      mediaUrl: message.mediaUrl,
      at: message.at,
    })),
  };
}

function actorLine(actor: Actor, session: SupportSession) {
  return [
    `<b>${escapeHtml(actor.displayName ?? "Customer")}</b>`,
    escapeHtml(actor.email ?? "no email"),
    session.device ? escapeHtml(session.device) : null,
    session.ip ? `<code>${escapeHtml(session.ip)}</code>` : null,
  ]
    .filter(Boolean)
    .join(" \u00b7 ");
}

function decodeDataUrl(dataUrl: unknown, contentType: string): Buffer | null {
  if (typeof dataUrl !== "string") return null;
  const parts = dataUrl.split(",", 2);
  const header = parts[0];
  const encoded = parts[1];
  if (!header || !encoded) return null;
  if (!header.startsWith(`data:${contentType};base64`)) return null;
  try {
    return Buffer.from(encoded, "base64");
  } catch {
    return null;
  }
}

export function registerSupportChatRoutes(app: Express) {
  /** Widget bootstrap: how many chats are left today, and is one already open. */
  app.get("/api/support/chat/state", async (req, res) => {
    secureHeaders(res);
    const actor = await resolveActor(req);
    if (!actor) return res.status(200).json({ authenticated: false, limit: supportDailyLimit });

    const probe = await consumeRateLimit({
      bucket: rateLimitBuckets.supportChatPoll,
      identifier: String(actor.id),
      mode: "lenient",
    });
    if (!probe.allowed) return sendRateLimited(res, probe.retryAfterSeconds);

    const [session, quota] = await Promise.all([getActiveSessionForUser(actor.id), supportQuotaState(actor.id)]);
    return res.json({
      authenticated: true,
      quota,
      session: session ? publicSession(session) : null,
    });
  });

  /** Opens a conversation, or resumes the one already open. */
  app.post("/api/support/chat/open", async (req, res) => {
    secureHeaders(res);
    const actor = await resolveActor(req);
    if (!actor) return res.status(401).json({ code: "SIGN_IN_REQUIRED" });

    const limit = await consumeRateLimit({
      bucket: rateLimitBuckets.supportChatOpen,
      identifier: String(actor.id),
      mode: "strict",
    });
    if (!limit.allowed) return sendRateLimited(res, limit.retryAfterSeconds);

    const topicRaw = typeof req.body?.topic === "string" ? req.body.topic.trim() : "";
    const orderRef = typeof req.body?.orderRef === "string" ? req.body.orderRef.trim() : null;
    const device = describeRequestDevice(req).label;

    const result = await openSupportSession({
      userId: actor.id,
      email: actor.email,
      displayName: actor.displayName,
      topic: topicRaw || "ជំនួយទូទៅ",
      orderRef: orderRef || null,
      ip: clientIpFromRequest(req),
      device,
    });

    if (!result.ok) {
      // A store we cannot write to has to say so. Answering 200 with a session
      // id that was never persisted is what produced "chat not found" on the
      // very next request, with no way for the customer to recover.
      if (result.reason === "storage") {
        return res.status(503).json({
          code: "STORAGE_UNAVAILABLE",
          message: "ប្រព័ន្ធឆាតមិនអាចរក្សាទុកបានទេ។ សូមទាក់ទងតាម Telegram ជាបណ្ដោះអាសន្ន។",
        });
      }
      return res.status(429).json({
        code: "SUPPORT_DAILY_LIMIT",
        quota: result.quota,
        message:
          "អ្នកបានប្រើការជជែកជំនួយសម្រាប់ថ្ងៃនេះរួចហើយ។ សូមព្យាយាមម្តងទៀតនៅថ្ងៃស្អែក។",
      });
    }

    if (!result.resumed) {
      // Ring the operator's phone. Fire-and-forget: a Telegram outage must not
      // stop the customer from opening a chat.
      void notifyAdmins(
        [
          "\u{1F4AC} <b>ការជជែកជំនួយថ្មី</b>",
          actorLine(actor, result.session),
          `Topic: ${escapeHtml(result.session.topic)}`,
          result.session.orderRef ? `Order: <code>${escapeHtml(result.session.orderRef)}</code>` : null,
          `Session: <code>${result.session.id}</code>`,
        ]
          .filter(Boolean)
          .join("\n"),
        [
          [
            { text: "\u2709\uFE0F Reply", callbackData: `sc:reply:${result.session.id}` },
            { text: "\u2705 Close chat", callbackData: `sc:close:${result.session.id}` },
          ],
        ],
      );
    }

    return res.json({ session: publicSession(result.session), resumed: result.resumed });
  });

  /** Poll for operator replies. */
  app.get("/api/support/chat/:id", async (req, res) => {
    secureHeaders(res);
    const actor = await resolveActor(req);
    if (!actor) return res.status(401).json({ code: "SIGN_IN_REQUIRED" });

    const probe = await consumeRateLimit({
      bucket: rateLimitBuckets.supportChatPoll,
      identifier: String(actor.id),
      mode: "lenient",
    });
    if (!probe.allowed) return sendRateLimited(res, probe.retryAfterSeconds);

    const session = await getSession(String(req.params.id ?? ""));
    // Ownership check, not just existence: session ids are short.
    if (!session || session.userId !== actor.id) return res.status(404).json({ code: "SESSION_NOT_FOUND" });
    return res.json({ session: publicSession(session) });
  });

  /** Send a text message. */
  app.post("/api/support/chat/message", async (req, res) => {
    secureHeaders(res);
    const actor = await resolveActor(req);
    if (!actor) return res.status(401).json({ code: "SIGN_IN_REQUIRED" });

    const limit = await consumeRateLimit({
      bucket: rateLimitBuckets.supportChatSend,
      identifier: String(actor.id),
      mode: "strict",
    });
    if (!limit.allowed) return sendRateLimited(res, limit.retryAfterSeconds);

    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    if (!text) return res.status(400).json({ code: "EMPTY_MESSAGE" });

    const session = await getSession(String(req.body?.sessionId ?? ""));
    if (!session || session.userId !== actor.id) return res.status(404).json({ code: "SESSION_NOT_FOUND" });
    if (session.status === "closed") {
      // This is the "respond not delivered" case: the chat is over, so the
      // message is refused rather than silently dropped.
      return res.status(409).json({ code: "SESSION_CLOSED", message: "ការជជែកនេះត្រូវបានបិទរួចហើយ។" });
    }

    const updated = await appendMessage({ sessionId: session.id, role: "user", kind: "text", text });
    if (!updated) return res.status(409).json({ code: "SESSION_CLOSED" });

    void notifyAdmins(
      `\u{1F4AC} ${actorLine(actor, session)}\n<code>${session.id}</code>\n\n${escapeHtml(text)}`,
      [
        [
          { text: "\u2709\uFE0F Reply", callbackData: `sc:reply:${session.id}` },
          { text: "\u2705 Close chat", callbackData: `sc:close:${session.id}` },
        ],
      ],
    );

    return res.json({ session: publicSession(updated) });
  });

  /** Send an image or a voice note. */
  app.post("/api/support/chat/upload", async (req, res) => {
    secureHeaders(res);
    const actor = await resolveActor(req);
    if (!actor) return res.status(401).json({ code: "SIGN_IN_REQUIRED" });

    const limit = await consumeRateLimit({
      bucket: rateLimitBuckets.supportChatUpload,
      identifier: String(actor.id),
      mode: "strict",
    });
    if (!limit.allowed) return sendRateLimited(res, limit.retryAfterSeconds);

    const session = await getSession(String(req.body?.sessionId ?? ""));
    if (!session || session.userId !== actor.id) return res.status(404).json({ code: "SESSION_NOT_FOUND" });
    if (session.status === "closed") return res.status(409).json({ code: "SESSION_CLOSED" });

    const kind = req.body?.kind === "voice" ? "voice" : "image";
    const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
    const allowed = kind === "voice" ? allowedAudioTypes : allowedImageTypes;
    if (!allowed.has(contentType)) return res.status(400).json({ code: "UNSUPPORTED_TYPE" });

    const bytes = decodeDataUrl(req.body?.dataUrl, contentType);
    if (!bytes || bytes.length === 0) return res.status(400).json({ code: "INVALID_PAYLOAD" });
    const cap = kind === "voice" ? maxAudioBytes : maxImageBytes;
    if (bytes.length > cap) return res.status(413).json({ code: "TOO_LARGE" });

    const extension = contentType.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
    let stored: { url: string };
    try {
      stored = await storagePut(
        `support-chat/${session.id}/${kind}-${nanoid(8)}.${extension}`,
        bytes,
        contentType,
      );
    } catch {
      return res.status(503).json({ code: "STORAGE_UNAVAILABLE" });
    }

    const caption = kind === "voice" ? "\u{1F3A4} សម្លេង" : "\u{1F5BC}\uFE0F រូបភាព";
    const updated = await appendMessage({
      sessionId: session.id,
      role: "user",
      kind,
      text: caption,
      mediaUrl: stored.url,
    });
    if (!updated) return res.status(409).json({ code: "SESSION_CLOSED" });

    const header = `${actorLine(actor, session)}\n<code>${session.id}</code>`;
    if (kind === "voice") void notifyAdminsVoice(stored.url, header);
    else void notifyAdminsPhoto(stored.url, header);

    return res.json({ session: publicSession(updated) });
  });

  /** A customer may end their own chat. This charges the daily allowance, the
   *  same as an operator closing it, so it cannot be used to farm extra slots. */
  app.post("/api/support/chat/close", async (req, res) => {
    secureHeaders(res);
    const actor = await resolveActor(req);
    if (!actor) return res.status(401).json({ code: "SIGN_IN_REQUIRED" });

    const session = await getSession(String(req.body?.sessionId ?? ""));
    if (!session || session.userId !== actor.id) return res.status(404).json({ code: "SESSION_NOT_FOUND" });

    const result = await closeSupportSession({ sessionId: session.id, closedBy: "customer" });
    if (result.closed) {
      void notifyAdmins(
        `\u{1F512} ការជជែកបានបិទដោយអតិថិជន\n${actorLine(actor, session)}\n<code>${session.id}</code>`,
      );
    }
    const quota = await supportQuotaState(actor.id);
    return res.json({ closed: result.closed, quota });
  });
}
