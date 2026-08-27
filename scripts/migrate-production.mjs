import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";

const migrationsFolder = path.resolve("drizzle");
const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, "meta", "_journal.json"), "utf8"));
const liveSpinMigration = journal.entries.find((entry) => entry.tag === "0017_livespin_fairness");

if (!liveSpinMigration) {
  throw new Error("Live Spin migration metadata is missing.");
}

const liveSpinSqlPath = path.join(migrationsFolder, `${liveSpinMigration.tag}.sql`);
const liveSpinSql = fs.readFileSync(liveSpinSqlPath, "utf8");
const liveSpinHash = crypto.createHash("sha256").update(liveSpinSql).digest("hex");
const statements = liveSpinSql
  .split("--> statement-breakpoint")
  .map((statement) => statement.trim())
  .filter(Boolean);

const requiredLiveSpinTables = [
  "live_spin_audit_logs",
  "live_spin_entries",
  "live_spin_events",
  "live_spin_prize_tiers",
  "live_spin_qualified_orders",
  "live_spin_results",
  "live_spin_tickets",
];

function fail(message) {
  console.error(`Production migration aborted safely: ${message}`);
  process.exitCode = 1;
}

async function tableExists(connection, tableName) {
  const [rows] = await connection.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1",
    [tableName],
  );
  return rows.length > 0;
}

async function bootstrapExistingDatabase(connection) {
  const coreSchemaExists = await tableExists(connection, "game_packages");
  const existingLiveSpinTables = [];
  for (const tableName of requiredLiveSpinTables) {
    if (await tableExists(connection, tableName)) existingLiveSpinTables.push(tableName);
  }

  await connection.query(
    "CREATE TABLE IF NOT EXISTS `__drizzle_migrations` (`id` serial PRIMARY KEY, `hash` text NOT NULL, `created_at` bigint)",
  );
  const [migrationRows] = await connection.query(
    "SELECT `created_at` FROM `__drizzle_migrations` ORDER BY `created_at` DESC LIMIT 1",
  );

  if (migrationRows.length > 0) return { bootstrapped: false };
  if (!coreSchemaExists) return { bootstrapped: false };

  if (existingLiveSpinTables.length > 0) {
    throw new Error(
      `existing application schema has no migration history and a partial Live Spin schema is present (${existingLiveSpinTables.join(", ")}). No automatic change was made.`,
    );
  }

  console.log("Existing application schema detected without Drizzle history; applying Live Spin migration only.");
  for (const statement of statements) {
    await connection.query(statement);
  }
  await connection.query(
    "INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES (?, ?)",
    [liveSpinHash, liveSpinMigration.when],
  );
  console.log("Live Spin migration applied and recorded as the production schema baseline.");
  return { bootstrapped: true };
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL unavailable; migration skipped in safe read-only mode.");
    return;
  }

  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const { bootstrapped } = await bootstrapExistingDatabase(connection);
    if (bootstrapped) return;
  } finally {
    await connection.end();
  }

  const pool = mysql.createPool(process.env.DATABASE_URL);
  try {
    await migrate(drizzle(pool), { migrationsFolder });
    console.log("Drizzle migrations completed.");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : "unknown migration failure");
});
