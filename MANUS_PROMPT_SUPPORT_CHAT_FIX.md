# Manus prompt — fix live support chat ("connect chat" fails)

Copy everything below into Manus AI. It applies the patch and pushes to `main`.

---

You are working in the `khmer-gaming-topup` repository. Apply the attached zip
`khmer-gaming-topup-support-chat-fix.zip` over the working tree (it is the full
project; keep `node_modules`, `.git`, `.env*` untouched), then commit and push to
`main`.

## Bug being fixed

Opening a support chat on `zurs.me/chat` failed for every visitor. The API threw
on each request:

```
Failed query: select `id`, `reference`, ... `customerPublicKey`, `adminPublicKey`,
`encryption`, ... from `support_chat_sessions` where ...
```

Cause: `drizzle/0024_support_chat_telegram.sql` creates its tables with
`CREATE TABLE IF NOT EXISTS`. The end-to-end-encryption columns were added
*inside* that file after it had already been applied to the production database,
so the statement became a no-op and the columns were never created. The ORM kept
selecting them, so every support-chat query failed.

## Changes in this patch

**Added**

- `server/supportChatSchemaGuard.ts` — `getSupportDb()` runs the additive DDL
  once per process (tolerating `ER_DUP_FIELDNAME` / `ER_TABLE_EXISTS_ERROR`), so
  the server repairs the schema itself even if migrations never run. If the
  repair is impossible (missing tables, no `ALTER` privilege) it returns `null`
  and the store's existing in-memory fallback keeps the chat usable instead of
  returning a 500.
- `drizzle/0026_support_chat_e2ee.sql` — real `ALTER TABLE ... ADD COLUMN`
  statements for `support_chat_sessions.customerPublicKey`, `.adminPublicKey`,
  `.encryption`, `support_chat_messages.encrypted`, plus
  `CREATE TABLE IF NOT EXISTS support_chat_admin_keys`.

**Changed**

- `server/supportChatStore.ts` — all 12 `await getDb()` call sites now use
  `await getSupportDb()`.
- `drizzle/0024_support_chat_telegram.sql` — reverted to its original
  (pre-encryption) shape so it matches what production already applied; the new
  columns live in `0026` only. Do not re-add them here.
- `drizzle/meta/_journal.json` — registers `0026_support_chat_e2ee` as `idx: 26`.
- `scripts/migrate-production.mjs` — applies `0026` additively before the normal
  drizzle run and records its hash, following the same pattern already used for
  the Live Spin migrations.

## Database

`pnpm build` runs `scripts/migrate-production.mjs`, so a normal deploy applies
`0026`. To apply it by hand instead:

```bash
pnpm db:migrate
```

Or directly, if you prefer SQL (safe to re-run; ignore duplicate-column errors):

```sql
ALTER TABLE `support_chat_sessions` ADD COLUMN `customerPublicKey` text;
ALTER TABLE `support_chat_sessions` ADD COLUMN `adminPublicKey` text;
ALTER TABLE `support_chat_sessions` ADD COLUMN `encryption` enum('none','e2ee') NOT NULL DEFAULT 'none';
ALTER TABLE `support_chat_messages` ADD COLUMN `encrypted` boolean NOT NULL DEFAULT false;
```

Do **not** run `drizzle-kit generate` for these columns — `0026` and the schema
guard already own them, and a generated duplicate would abort the migration run.

## Verify

```bash
pnpm install
pnpm test
pnpm build
```

Known pre-existing failure, unrelated to this patch — do not "fix" it here:

```
error TS2688: Cannot find type definition file for 'node'.
error TS2688: Cannot find type definition file for 'vite/client'.
tsconfig.json(16,5): error TS5102: Option 'baseUrl' has been removed.
```

## Manual QA after deploy

1. Sign in, open `/chat`, pick a topic, send a first message — the chat opens
   instead of showing "ការជជែកមិនអាចភ្ជាប់បានទេ".
2. Server logs show `[SupportChat] schema repaired: ...` once (or nothing, if the
   migration got there first).
3. Send an image; confirm it appears and the Telegram bot notifies the admin
   chat.
4. Open `/admin/support-chat` in the browser the team answers from and publish
   the device key, so the header switches from `HTTPS ប៉ុណ្ណោះ` to
   `អ៊ិនគ្រីបចុងដល់ចុង`.
5. Reply from Telegram with `/reply <ref> <text>` and confirm delivery.

## Commit

```bash
git checkout main
git add -A
git commit -m "fix(support): add missing E2EE columns so live chat can connect"
git push origin main
```

If `main` is protected, push `fix/support-chat-e2ee-columns` and open a PR.
