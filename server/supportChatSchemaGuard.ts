/**
 * Additive schema guard for the live-support chat tables.
 *
 * `0024_support_chat_telegram.sql` creates its tables with
 * `CREATE TABLE IF NOT EXISTS`, so adding the end-to-end encryption columns to
 * that already-applied file changed nothing on a database that had run it: the
 * columns were never created, and every support-chat query then failed with an
 * unknown column, which is what took the widget offline. `0026_support_chat_e2ee.sql`
 * adds them properly, but a deploy does not always get to run migrations (no
 * DATABASE_URL at build time, cached build, hand-rolled host), so the server
 * repairs the gap itself before the first support-chat query.
 *
 * Everything here is additive and safe to run repeatedly. When the repair is
 * impossible (missing tables, no ALTER privilege) the guard returns `null`, and
 * every caller already treats `null` like a missing database by falling back to
 * the in-memory store -- so the chat degrades instead of breaking.
 */
import { sql } from "drizzle-orm";
import { getDb } from "./db";

type SupportDb = NonNullable<Awaited<ReturnType<typeof getDb>>>;

/** Columns introduced after 0024 had already shipped. */
const ADDITIVE_STATEMENTS: Array<{ label: string; ddl: string }> = [
  {
    label: "support_chat_sessions.customerPublicKey",
    ddl: "ALTER TABLE `support_chat_sessions` ADD COLUMN `customerPublicKey` text",
  },
  {
    label: "support_chat_sessions.adminPublicKey",
    ddl: "ALTER TABLE `support_chat_sessions` ADD COLUMN `adminPublicKey` text",
  },
  {
    label: "support_chat_sessions.encryption",
    ddl: "ALTER TABLE `support_chat_sessions` ADD COLUMN `encryption` enum('none','e2ee') NOT NULL DEFAULT 'none'",
  },
  {
    label: "support_chat_messages.encrypted",
    ddl: "ALTER TABLE `support_chat_messages` ADD COLUMN `encrypted` boolean NOT NULL DEFAULT false",
  },
  {
    label: "support_chat_admin_keys",
    ddl: [
      "CREATE TABLE IF NOT EXISTS `support_chat_admin_keys` (",
      "  `adminUserId` int NOT NULL,",
      "  `adminName` varchar(140),",
      "  `publicKeyJwk` text NOT NULL,",
      "  `isActive` boolean NOT NULL DEFAULT true,",
      "  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,",
      "  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,",
      "  CONSTRAINT `support_chat_admin_keys_adminUserId` PRIMARY KEY(`adminUserId`)",
      ")",
    ].join("\n"),
  },
];

/** MySQL codes that mean "this piece is already in place". */
const ALREADY_APPLIED = ["ER_DUP_FIELDNAME", "ER_TABLE_EXISTS_ERROR", "ER_DUP_KEYNAME"];

const RETRY_AFTER_MS = 60_000;

let ready = false;
let attempt: Promise<boolean> | null = null;
let lastAttemptAt = 0;
let warned = false;

function errorCode(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : "";
}

async function repair(db: SupportDb): Promise<void> {
  for (const statement of ADDITIVE_STATEMENTS) {
    try {
      await db.execute(sql.raw(statement.ddl));
      console.log(`[SupportChat] schema repaired: ${statement.label}`);
    } catch (error) {
      // A duplicate column is the happy path on an up-to-date database.
      if (!ALREADY_APPLIED.includes(errorCode(error))) throw error;
    }
  }
}

/**
 * Database handle whose support-chat schema is known to be usable, or `null`
 * when it cannot be made usable. Runs the repair at most once per process, and
 * re-tries at most once a minute after a failure.
 */
export async function getSupportDb(): Promise<SupportDb | null> {
  const db = await getDb();
  if (!db) return null;
  if (ready) return db;

  const startedAt = Date.now();
  let pending = attempt;
  if (!pending) {
    if (startedAt - lastAttemptAt < RETRY_AFTER_MS) return null;
    lastAttemptAt = startedAt;
    pending = repair(db)
      .then(() => {
        ready = true;
        return true;
      })
      .catch((error) => {
        if (!warned) {
          warned = true;
          console.warn("[SupportChat] schema repair failed; falling back to the in-memory store:", error);
        }
        return false;
      });
    attempt = pending;
  }

  const healthy = await pending;
  if (attempt === pending) attempt = null;
  return healthy ? db : null;
}

/** Test hook: forget what the guard learned about the schema. */
export function resetSupportChatSchemaGuardForTests(): void {
  ready = false;
  attempt = null;
  lastAttemptAt = 0;
  warned = false;
}
