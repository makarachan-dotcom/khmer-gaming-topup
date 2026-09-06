# Manus AI task — ship the E2EE `/chat` page + Telegram admin bot to `main`

Copy everything below the line into Manus AI. It owns `git`; it must commit and
push. Nothing has been pushed for you.

---

You are working in the repository `khmer-gaming-topup` (ZURS storefront: React 19
+ Vite 7 + Tailwind 4 + wouter on the client, Express + tRPC 11 + drizzle-orm
(MySQL) on the server, pnpm 10.4.1, Node >= 22 < 25).

A complete working tree is attached as `khmer-gaming-topup-support-chat.zip`.
**Task: apply it to the repo, verify it, commit it, and push to `main`.**

## 1. Apply the archive

1. Extract the zip into a temp folder.
2. Copy its contents over the repo working tree, overwriting existing files.
   Do **not** copy `node_modules`, `.git`, `dist`, or `.env*`.
3. Delete `client/src/components/SupportChat.tsx` if it still exists — the old
   floating chat panel is intentionally removed and replaced by a real page.
4. `pnpm install`

**Do not run `npm install liquid-gooey` or `npm install thinking-orbs`.** Those
packages are not published; the two effects are vendored with identical APIs at
`client/src/components/liquid-gooey.tsx` and
`client/src/components/thinking-orbs.tsx`. Keep the vendored versions.

## 2. What this changeset does

### a. Chat is now its own page (`/chat`)

- Every entry point (header mascot, purchase-history “talk to support” button,
  security page link) routes to `/chat` instead of opening an overlay.
- `/chat/security` is a plain-language explainer of the encryption model.
- Unauthenticated visitors see a Google sign-in call to action pointing at
  `/api/auth/google?returnTo=%2Fchat`. Email/OTP sign-in stays paused.

### b. End-to-end encryption

- ECDH P-256 → HKDF-SHA256 → AES-GCM 256, all in `client/src/lib/e2ee.ts`.
- Envelope format `zurs-e2ee.v1.<ivB64>.<ctB64>`; the HKDF salt is the visitor's
  serialized public key on **both** sides, so the visitor and the agent derive
  the same shared secret and nobody else can.
- The visitor generates a key pair per conversation (`localStorage`), the agent
  generates one device identity key and publishes only its public half to the
  new `support_chat_admin_keys` table.
- Server, database and Telegram only ever hold ciphertext. Sealed bodies render
  as `🔒 សារអ៊ិនគ្រីប` in previews, notifications and `/chat <ref>`.
- Both sides show a 12-hex-digit safety number derived from the two public keys.

### c. Images only — voice removed

- The voice recorder, its button, `uploadSupportChatVoice`, and
  `allowedSupportVoiceTypes` are deleted.
- `supportChat.sendAttachment` accepts `kind: z.literal("image")` plus an
  `encrypted` flag; photos are compressed, sealed in the browser, and uploaded
  as `application/octet-stream` with an `.enc` extension.
- Legacy voice messages still render in the agent console as
  `🎙️ សារជាសំឡេងចាស់`.

### d. Animations / style

- `client/src/styles/zurs-chat-page.css` — aurora background, message rise-in,
  shimmer skeletons, pulse/breathe/float/shake states, full mobile layout and a
  `prefers-reduced-motion` block that disables all of it.
- Liquid gooey effect is used **only** on the image-picker cluster (gallery
  button `morph`, camera button `melt`, trigger `move`).
- `ThinkingOrb` states: `connecting` while waiting for an agent to join,
  `listening` while waiting for a reply, `composing` for a normal reply,
  `weaving` when the agent has been typing longer than 6 s, `breathing` at idle.
- Photos fade/blur up on load; the mascot greets with “Good morning/afternoon/
  evening” then alternates to `ត្រូវការជំនួយ?` every 10 seconds.

### e. Telegram admin bot (unchanged behaviour, now encryption-aware)

Commands: `/start <code>`, `/help`, `/menu`, `/whoami`, `/stats`, `/orders [n]`,
`/order <code>`, `/users [n]`, `/user <email>`, `/tickets`, `/chats`,
`/chat <ref>`, `/reply <ref> <text>`, `/close <ref> [reason]`, `/bans`,
`/ban <ip|email> [hours] [reason]`, `/unban <banId>`, `/stop`.
New purchases push to the admin chat. `/reply` sends plaintext and is flagged as
unencrypted in the console.

### f. One chat per day

One conversation per account per Phnom Penh day. Closing a chat consumes the
slot; further attempts return `quota_exhausted` with a live countdown.

## 3. File map for review

**Added**

```
client/src/lib/e2ee.ts
client/src/pages/SupportChatPage.tsx
client/src/pages/ChatSecurity.tsx
client/src/components/SupportChatLauncher.tsx
client/src/styles/zurs-chat-page.css
client/src/components/liquid-gooey.tsx
client/src/components/thinking-orbs.tsx
client/src/components/HeaderMascot.tsx
client/src/styles/zurs-support-chat.css
server/supportChatStore.ts
server/telegramBot.ts
server/telegramRoutes.ts
server/loginAbuseGuard.ts
drizzle/0024_support_chat_telegram.sql
docs/telegram-bot-integration.md
```

**Changed**

```
client/src/lib/supportChat.ts          (rewritten — navigation + image helpers)
client/src/pages/AdminSupportChat.tsx  (rewritten — device keys + decryption)
client/src/App.tsx                     (+ /chat, /chat/security routes)
client/src/main.tsx                    (+ zurs-chat-page.css)
client/src/components/StorefrontLayout.tsx
client/src/components/DashboardLayout.tsx
client/src/pages/AppwriteLogin.tsx
client/src/pages/Account.tsx
server/routers.ts
server/uploads.ts
server/app.ts
server/db.ts
drizzle/schema.ts
drizzle/meta/_journal.json
```

**Deleted**

```
client/src/components/SupportChat.tsx
```

## 4. Database

Migration `0024_support_chat_telegram.sql` (journal index 24) creates the
support-chat and Telegram tables and includes the encryption columns:
`support_chat_sessions.customerPublicKey`, `.adminPublicKey`,
`.encryption enum('none','e2ee')`, `support_chat_messages.encrypted`, plus the
`support_chat_admin_keys` table.

Run `pnpm db:migrate` against staging first. If `0024` was already applied in an
earlier deploy, apply the added columns manually instead of re-running it.

## 5. Environment variables

```
TELEGRAM_BOT_TOKEN=          # rotate the token first — see the warning below
TELEGRAM_WEBHOOK_SECRET=     # random string, used in the webhook path
TELEGRAM_ADMIN_CHAT_IDS=6401809092
TELEGRAM_BOT_ADMIN_CODE=     # code required by /start
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
```

> **Security:** the previous bot token was shared in a chat message and must be
> treated as compromised. Revoke it with `/revoke` in @BotFather, generate a new
> one, and put the new value in the server environment only. Never commit it.

After deploy, register the webhook: `POST /api/telegram/register/:secret`.
Health check: `GET /api/telegram/health`.

## 6. Verify before pushing

```bash
pnpm install
pnpm check          # see the known tsconfig issue below
pnpm test
pnpm build
```

**Known pre-existing failure, not caused by this changeset.** `pnpm check`
reports:

```
error TS2688: Cannot find type definition file for 'node'.
error TS2688: Cannot find type definition file for 'vite/client'.
tsconfig.json(16,5): error TS5102: Option 'baseUrl' has been removed.
```

Fix it in a **separate commit**: remove `baseUrl` from `tsconfig.json` and rely
on `"paths": { "@/*": ["./client/src/*"], "@shared/*": ["./shared/*"] }`, and
make sure `@types/node` is installed. Then re-run `pnpm check` and make sure the
new files are clean.

## 7. Manual QA

1. Signed out, click the header mascot → lands on `/chat` with a Google CTA.
2. Sign in with Google → returns to `/chat`.
3. Start a chat → Telegram admin chat receives a new-chat notification with the
   lock placeholder, not the text.
4. In `/admin/support-chat`, the key banner is green; the visitor's message is
   readable there and the safety numbers match on both screens.
5. Send a photo → it appears on both sides; the stored object is `.enc` and is
   not viewable directly from storage.
6. Confirm there is no voice button anywhere in the composer.
7. Agent types → visitor sees the orb switch to `composing`, then `weaving`
   after ~6 s.
8. Close the chat → the visitor sees the closed panel with a countdown, and a
   second attempt the same day is refused.
9. Reload `/chat` → history still decrypts (same browser).
10. `/chat/security` explains the model and links back.
11. Enable “reduce motion” in the OS → animations stop, layout intact.

## 8. Commit and push

```bash
git checkout main
git pull --ff-only
git add -A
git commit -m "feat(support): E2EE /chat page, image-only composer, gooey picker + orb states"
git push origin main
```

If `main` is protected, open a PR from `feat/e2ee-support-chat` with this file as
the description and merge it once checks pass. Report the commit SHA, the
migration result, and anything you had to change to make `pnpm check` pass.
