const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || "zurs_store";
const collectionId = "zurs_records";
const excludedTables = new Set(["game_products", "game_packages", "smm_services", "smm_tiers"]);

if (!endpoint || !projectId || !apiKey) throw new Error("Appwrite credentials are required.");

const headers = { "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey };
const listResponse = await fetch(`${endpoint}/databases/${databaseId}/collections/${collectionId}/documents?limit=100&total=false`, { headers, signal: AbortSignal.timeout(20_000) });
if (!listResponse.ok) throw new Error(`Unable to list staging records: HTTP ${listResponse.status}`);
const { documents = [] } = await listResponse.json();
let deleted = 0;

for (const document of documents) {
  if (!excludedTables.has(document.sourceTable)) continue;
  const response = await fetch(`${endpoint}/databases/${databaseId}/collections/${collectionId}/documents/${document.$id}`, { method: "DELETE", headers, signal: AbortSignal.timeout(20_000) });
  if (!response.ok && response.status !== 404) throw new Error(`Unable to delete ${document.sourceTable}:${document.sourceId}: HTTP ${response.status}`);
  deleted += 1;
}

console.log(`Removed ${deleted} non-provider catalog records from private Appwrite staging.`);
