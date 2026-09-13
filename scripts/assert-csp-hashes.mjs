import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED = [
  "'sha256-DlJZr1MoWzXsIPXL6OzXbGc4tt7yeGWrGKNtl3senyQ='",
  "'sha256-RNVq7KCFgdPTgiE2ccaasel0NNygecV5GIjMuAplKl8='",
  "'sha256-/A4iLe8qmlxaNjrdqCmaLpw29lK0pp9QMdV7p1No5Mg='",
  "'sha256-4u7hi3T6ri73I65/MsKxA/avQMYE7H0RqMs3IH7UL8s='",
];

function inlineScriptBodies(html) {
  const bodies = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    if (/\bsrc\s*=/i.test(match[1] ?? "")) continue;
    bodies.push(match[2] ?? "");
  }
  return bodies;
}

function cspSha256(source) {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`;
}

const htmlPath = resolve(process.cwd(), "dist/public/index.html");
const html = readFileSync(htmlPath, "utf8");
const got = inlineScriptBodies(html).map(cspSha256);
if (JSON.stringify(got) !== JSON.stringify(EXPECTED)) {
  console.error("CSP inline script hashes drifted after vite build.");
  console.error({ expected: EXPECTED, got });
  process.exit(1);
}
