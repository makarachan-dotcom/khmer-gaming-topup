import crypto from "node:crypto";
import mysql from "mysql2/promise";

const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || "zurs_store";
const collectionId = "zurs_records";
const sourceUrl = process.env.DATABASE_URL;

if (!endpoint || !projectId || !apiKey || !sourceUrl) throw new Error("Appwrite credentials and DATABASE_URL are required.");

const tables = [
  // Provider catalog and SMM defaults are intentionally excluded until an authorized provider sync supplies live records.
  "users", "orders", "saved_player_ids",
  "marketplace_listings", "marketplace_verifications", "marketplace_verification_evidence", "marketplace_evidence_access_logs",
  "marketplace_fraud_reports", "marketplace_disclosure_requests", "marketplace_contacts", "welcome_email_deliveries",
  "payment_transactions", "site_content",
];

function documentId(table, id) { return crypto.createHash("sha256").update(`${table}:${id}`).digest("hex").slice(0, 32); }
function toPayload(row) { return JSON.stringify(row, (_, value) => value instanceof Date ? value.toISOString() : value); }
function sourceTimestamp(row) { const value = row.updatedAt ?? row.createdAt ?? null; return value instanceof Date ? value.toISOString() : null; }

async function createRecord(table, row) {
  const sourceId = String(row.id);
  const response = await fetch(`${endpoint}/databases/${databaseId}/collections/${collectionId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
    body: JSON.stringify({ documentId: documentId(table, sourceId), data: { sourceTable: table, sourceId, payload: toPayload(row), sourceUpdatedAt: sourceTimestamp(row) } }),
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 409) return "existing";
  if (!response.ok) throw new Error(`Appwrite write failed for ${table}:${sourceId} with HTTP ${response.status}`);
  return "created";
}

const db = await mysql.createConnection(sourceUrl);
const report = { tables: {}, paymentTotal: "0" };

try {
  for (const table of tables) {
    const [rows] = await db.query(`SELECT * FROM \`${table}\``);
    let created = 0;
    let existing = 0;
    for (const row of rows) {
      const result = await createRecord(table, row);
      if (result === "created") created += 1;
      else existing += 1;
    }
    report.tables[table] = { sourceRows: rows.length, created, existing };
  }

  const [paymentRows] = await db.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payment_transactions");
  report.paymentTotal = String(paymentRows[0]?.total ?? "0");
  console.log(JSON.stringify(report, null, 2));
  console.log("Migration copy complete. The Appwrite database stays disabled; validate this report against the source before enabling any application reads.");
} finally {
  await db.end();
}

process.exit(0);
