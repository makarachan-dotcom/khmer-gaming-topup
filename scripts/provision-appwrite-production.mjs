const endpoint = process.env.APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
const databaseId = process.env.APPWRITE_DATABASE_ID || "zurs_store";
const collectionId = "zurs_records";

if (process.env.APPWRITE_PROVISION_CONFIRM !== "ZURS_STORE") {
  throw new Error("Set APPWRITE_PROVISION_CONFIRM=ZURS_STORE before provisioning Appwrite production storage.");
}
if (!endpoint || !projectId || !apiKey) {
  throw new Error("APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, and APPWRITE_API_KEY are required.");
}

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
  await request("POST", "/databases", { databaseId, name: "ZURS STORE Records", enabled: true });
  console.log(`Created enabled database ${databaseId}.`);
} else {
  await request("PUT", `/databases/${databaseId}`, { name: "ZURS STORE Records", enabled: true });
  console.log(`Enabled existing database ${databaseId}.`);
}

if (!await request("GET", `/databases/${databaseId}/collections/${collectionId}`)) {
  await request("POST", `/databases/${databaseId}/collections`, {
    collectionId,
    name: "ZURS Store Records",
    permissions: [],
    documentSecurity: true,
    enabled: true,
  });
  console.log(`Created enabled collection ${collectionId}.`);
} else {
  await request("PUT", `/databases/${databaseId}/collections/${collectionId}`, {
    name: "ZURS Store Records",
    permissions: [],
    documentSecurity: true,
    enabled: true,
  });
  console.log(`Enabled existing collection ${collectionId}.`);
}

const attributes = [
  ["sourceTable", 80, true],
  ["sourceId", 160, true],
  ["payload", 65535, true],
];

for (const [key, size, required] of attributes) {
  const result = await request("POST", `/databases/${databaseId}/collections/${collectionId}/attributes/string`, { key, size, required, array: false });
  if (!result?.conflict) console.log(`Requested ${key} attribute.`);
}

const timestamp = await request("POST", `/databases/${databaseId}/collections/${collectionId}/attributes/datetime`, { key: "sourceUpdatedAt", required: false, array: false });
if (!timestamp?.conflict) console.log("Requested sourceUpdatedAt attribute.");

console.log("Appwrite production storage provisioning request complete.");
