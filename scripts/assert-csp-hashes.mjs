import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const EXPECTED = [
  "'sha256-V7QpbdJNwHdtWxcMBy53J1v1bu5cwuf9xTr3hEyCDd0='",
  "'sha256-RNVq7KCFgdPTgiE2ccaasel0NNygecV5GIjMuAplKl8='",
  "'sha256-/A4iLe8qmlxaNjrdqCmaLpw29lK0pp9QMdV7p1No5Mg='",
  "'sha256-+2fpB4RRSi59XpvbtzRVb6BWOSv9U5x2j39nSlGychE='",
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
