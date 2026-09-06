#!/usr/bin/env node
// Standalone FZR Cards provider diagnostic — needs NO build, NO database.
//
// Purpose: dump the RAW provider response for BOTH working games (Free Fire, 8 Ball Pool) and the
// ID-verified games that show 0/0 (Mobile Legends, PUBG, Magic Chess, Honor of Kings, Call of Duty)
// so we can see the EXACT JSON shape / field names the offers endpoint returns for each. That is the
// only thing needed to guarantee the parser maps every package.
//
// Run (with real credentials):
//   FZR_CARDS_API_BASE_URL="https://..." FZR_CARDS_API_KEY="xxx" node diag-fzr.mjs
// or, if you have a .env file with those keys:
//   node --env-file=.env diag-fzr.mjs

const baseUrl = process.env.FZR_CARDS_API_BASE_URL;
const apiKey = process.env.FZR_CARDS_API_KEY;

if (!baseUrl || !apiKey) {
  console.error("[diag] Missing FZR_CARDS_API_BASE_URL or FZR_CARDS_API_KEY.");
  console.error('[diag] Example: FZR_CARDS_API_BASE_URL="https://api..." FZR_CARDS_API_KEY="xxx" node diag-fzr.mjs');
  process.exit(1);
}

async function fzr(path) {
  try {
    const res = await fetch(`${baseUrl}${path}`, { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text };
  } catch (err) {
    return { status: 0, json: null, text: String(err?.message ?? err) };
  }
}

function findOffers(obj) {
  if (!obj || typeof obj !== "object") return null;
  const keys = ["offers", "packages", "products", "denominations", "denoms", "list", "items", "data"];
  for (const k of keys) if (Array.isArray(obj[k])) return { key: k, arr: obj[k] };
  for (const nest of ["data", "result", "payload"]) {
    if (obj[nest] && typeof obj[nest] === "object") {
      const inner = findOffers(obj[nest]);
      if (inner) return { key: `${nest}.${inner.key}`, arr: inner.arr };
    }
  }
  return null;
}

function summarize(label, r) {
  console.log(`\n===== ${label} =====`);
  console.log(`HTTP ${r.status}`);
  if (r.json && typeof r.json === "object") {
    console.log("top-level keys:", Object.keys(r.json).join(", ") || "(none)");
    const found = findOffers(r.json);
    if (found) {
      console.log(`offers found at \"${found.key}\" -> length ${found.arr.length}`);
      if (found.arr[0] && typeof found.arr[0] === "object") {
        console.log("first offer keys:", Object.keys(found.arr[0]).join(", "));
        console.log("first offer:", JSON.stringify(found.arr[0]));
      }
    } else {
      console.log("!! NO offers array found at any common key — this is why the game imports 0.");
    }
  }
  console.log("raw (first 1800 chars):\n" + r.text.slice(0, 1800));
}

const catalog = await fzr("/api/v2/topups");
const ids = Array.isArray(catalog.json?.items) ? catalog.json.items.map((i) => i.category_id) : [];
console.log(`[diag] catalog first page returned ${ids.length} category ids.`);
const pick = (re, n = 1) => ids.filter((id) => re.test(id)).slice(0, n);

const targets = [
  ...pick(/free_fire/i, 1),          // known-working baseline
  ...pick(/8.?ball/i, 1),            // known-working baseline
  ...pick(/mobile_legends/i, 2),     // shows 0/0
  ...pick(/pubg/i, 1),               // shows 0/0
  ...pick(/magic_chess/i, 1),        // shows 0/0
  ...pick(/honor_of_kings/i, 1),     // shows 0/0
  ...pick(/call_of_duty|codm/i, 1),  // shows 0/0
];
const finalTargets = targets.length ? [...new Set(targets)] : ["free_fire_my_sg", "mobile_legends_global", "pubg_mobile_auto", "magic_chess_gogo_global", "honor_of_kings"];

for (const id of finalTargets) {
  const r = await fzr(`/api/v2/topups/offers?category_id=${encodeURIComponent(id)}&include_ui=1`);
  summarize(id, r);
}

console.log("\n[diag] Done. Copy the sections for the 0/0 games (Mobile Legends / PUBG / Magic Chess / Honor of Kings / Call of Duty)");
console.log("[diag] and share them so the offer parser can be mapped 1:1 to the real field names.");
