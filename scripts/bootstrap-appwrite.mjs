const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || "zurs_store";
const collectionId = "zurs_records";

if (!endpoint || !projectId || !apiKey) throw new Error("APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY are required.");

async function request(method, path, body) {
  const response = await fetch(`${endpoint}${path}`, {
    method,
    headers: { "Content-Type": "application/json", "X-Appwrite-Project": projectId, "X-Appwrite-Key": apiKey },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 404) return null;
  if (response.status === 409) return { conflict: true };
  if (!response.ok) throw new Error(`${method} ${path} failed with HTTP ${response.status}`);
  return response.status === 204 ? {} : response.json();
}

if (!await request("GET", `/databases/${databaseId}`)) {
  await request("POST", "/databases", { databaseId, name: "ZURS STORE Migration", enabled: false });
  console.log(`Created Appwrite database ${databaseId}.`);
} else {
  console.log(`Using existing Appwrite database ${databaseId}.`);
}

if (!await request("GET", `/databases/${databaseId}/collections/${collectionId}`)) {
  await request("POST", `/databases/${databaseId}/collections`, {
    collectionId,
    name: "ZURS Migration Records",
    permissions: [],
    documentSecurity: true,
    enabled: false,
  });
  console.log(`Created private staging collection ${collectionId}.`);
} else {
  console.log(`Using existing staging collection ${collectionId}.`);
}

const attributes = [
  ["sourceTable", 80, true],
  ["sourceId", 160, true],
  ["payload", 65535, true],
];

for (const [key, size, required] of attributes) {
  const result = await request("POST", `/databases/${databaseId}/collections/${collectionId}/attributes/string`, { key, size, required, array: false });
  if (!result?.conflict) console.log(`Requested attribute ${key}.`);
}

const timestamp = await request("POST", `/databases/${databaseId}/collections/${collectionId}/attributes/datetime`, { key: "sourceUpdatedAt", required: false, array: false });
if (!timestamp?.conflict) console.log("Requested attribute sourceUpdatedAt.");

console.log("Appwrite staging schema request complete. Keep this database disabled until record counts, payment totals, and permissions are independently verified.");
