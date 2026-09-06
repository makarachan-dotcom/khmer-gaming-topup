# Telegram admin bot + live support chat

Everything below ships in this repo. Nothing here needs an external service other
than Telegram itself.

## 1. What the bot can do

The bot is the admin panel in your pocket. Once paired it can:

| Command | What it does |
| --- | --- |
| `/start <code>` | Pairs the current Telegram chat with the shop (code = `TELEGRAM_BOT_ADMIN_CODE`). |
| `/help`, `/menu` | Command list / inline keyboard. |
| `/whoami` | Shows the chat id and pairing state. |
| `/stats` | Orders, pending orders, paid orders, revenue, users, sales trend. |
| `/orders [n]` | Latest orders with customer, amount and status. |
| `/order <code>` | One order by order number or tracking code, with its status log. |
| `/users [n]` | Newest members. |
| `/user <email>` | One member: role, join date, last sign-in, order count. |
| `/tickets` | Open order-support tickets. |
| `/chats` | Live support conversations (waiting / active / closed today). |
| `/chat <ref>` | Full transcript of one chat (`SC-XXXXXX`). |
| `/reply <ref> <text>` | Replies into the website chat as ZURS Support. |
| `/close <ref> [reason]` | Closes the chat (spends the customer's daily slot). |
| `/bans` | Active login bans with remaining time. |
| `/ban <ip\|email> [hours] [reason]` | Bans an IP or an email identity. |
| `/unban <banId>` | Lifts a ban. Inline "Unban" buttons do the same. |
| `/stop` | Unpairs this chat. |

Push notifications are sent to every paired admin chat when:

* a new order is created (top-up or digital service),
* a KHQR payment is reconciled (paid / delivered),
* a customer opens a support chat, sends a message, or a chat is closed,
* a login ban is created (manual or automatic).

## 2. Environment variables

```bash
# Required
TELEGRAM_BOT_TOKEN="8059194339:AAEB…"      # BotFather token — keep it secret
TELEGRAM_WEBHOOK_SECRET="a-long-random-string"

# Optional
TELEGRAM_ADMIN_CHAT_IDS="6401809092"       # extra admin chats (owner id is built in)
TELEGRAM_BOT_ADMIN_CODE="zurs-admin"       # pairing code for /start
```

The owner chat id `6401809092` is compiled in as a default, so notifications work
even before anything is configured. `TELEGRAM_ADMIN_CHAT_IDS` only adds more chats.

> ⚠️ The token above was shared in a chat message. Rotate it in BotFather
> (`/revoke` → new token) and store the new one only in the server environment.

## 3. Register the webhook

After deploying, either call the helper route once:

```bash
curl -X POST https://zurs.me/api/telegram/register/$TELEGRAM_WEBHOOK_SECRET
```

or set it manually:

```bash
curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -d "url=https://zurs.me/api/webhooks/telegram/$TELEGRAM_WEBHOOK_SECRET"
```

Routes exposed by `server/telegramRoutes.ts`:

* `POST /api/webhooks/telegram/:secret` — primary webhook (exempt from the IP-ban guard),
* `POST /api/telegram/webhook/:secret` — alias,
* `POST /api/telegram/register/:secret` — calls `setWebhook` for you,
* `GET  /api/telegram/health` — reports whether the token, secret and admin chats are configured.

Then open the bot in Telegram and send `/start zurs-admin`.

## 4. Live support chat rules

* One conversation per customer per calendar day, Asia/Phnom_Penh.
* The slot is spent when an admin **closes** the chat. After that, replies are
  refused ("not delivered") and the customer must wait until tomorrow, which
  starts a brand new chat.
* Attachments: images (jpeg/png/webp, 5 MB) and voice notes (webm/ogg/mp4/wav, 3 MB, 2 min).
* Entry points: header mascot, purchase-history row, and the paused-login panel.
* Admin surface: `/admin/support-chat` in the dashboard, or the bot.

## 5. Database

Migration `drizzle/0024_support_chat_telegram.sql` creates:

* `support_chat_sessions` — one row per conversation, unique on `(user_id, quota_day)`,
* `support_chat_messages` — transcript incl. media keys and voice duration,
* `telegram_admin_chats` — paired Telegram chats.

Run `pnpm db:migrate` (or `pnpm db:push`) after deploying. If the database is
unreachable the store falls back to memory so support still works, but history is
not durable — `state.durable === false` tells you that.

---

## v2 — end-to-end encrypted chat (`/chat`)

The support widget is no longer a floating panel. Clicking any chat entry point
(header mascot, purchase-history button, `/chat/security` link) navigates to the
dedicated page `/chat`. Everything the visitor types there is sealed **inside
the browser** before it is sent, so the database, the API and this Telegram bot
only ever hold ciphertext.

### Crypto model

| Step | Detail |
| --- | --- |
| Key agreement | ECDH, curve P-256, non-extractable private keys |
| Key derivation | HKDF-SHA256, salt = the visitor's serialized public key |
| Message cipher | AES-GCM 256, fresh 12-byte IV per message |
| Envelope | `zurs-e2ee.v1.<iv-base64>.<ciphertext-base64>` |
| Visitor keys | One key pair per conversation, held in `localStorage` (`zurs:e2ee:chat:<ref>`) |
| Agent keys | One device identity key (`zurs:e2ee:admin-identity`); only the public half is published to `support_chat_admin_keys` |

Images are encrypted the same way: the browser compresses the photo, seals the
bytes, and uploads them as `application/octet-stream` with an `.enc` extension.
Storage never sees a viewable image.

### What the bot shows now

- Purchase notifications are unchanged (orders are not encrypted).
- New-chat and new-message notifications replace the body with
  `🔒 សារអ៊ិនគ្រីប — មើលនៅផ្ទាំងគ្រប់គ្រង`.
- `/chats` previews show the same lock placeholder for sealed conversations.
- `/chat <ref>` renders the transcript metadata (who, when, kind) but **cannot**
  render sealed text or photos. Open `/admin/support-chat` to read them.
- `/reply <ref> <text>` still works, but the message is sent **unencrypted** and
  is flagged in the agent console as “មិនបានអ៊ិនគ្រីប”. Use it for short
  logistics only; anything sensitive should go through the admin console.
- `/close <ref> [reason]` is unchanged and still consumes the visitor's daily
  chat slot.

### Agent setup (one time per browser)

1. Open `/admin/support-chat`. A device identity key is generated and its public
   half is published automatically.
2. The banner turns green (“កូនសោនៅឧបករណ៍នេះ”) when the published key matches
   the local one.
3. On a second browser the banner turns amber; press **បញ្ចូរមកឧបករណ៍នេះ** to
   take over. New chats seal to the new key — conversations sealed to the old
   key stay unreadable, which is the expected property of end-to-end encryption.

### Voice removed

The voice recorder and its upload helper (`uploadSupportChatVoice`) were
deleted; `supportChat.sendAttachment` now accepts `kind: "image"` only. Messages
recorded before this change still exist and render in the agent console as
`🎙️ សារជាសំឡេងចាស់`.

### Rate limit

Unchanged: one conversation per account per Phnom Penh day. Closing a chat (from
the console or `/close`) consumes the slot, and further attempts get
`quota_exhausted` with the countdown to reset.
