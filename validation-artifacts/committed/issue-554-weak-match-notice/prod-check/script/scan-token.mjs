// The token scan for the #549 production check (copied from ../../../ux-map-window-tidy/prod-check/script/scan-token.mjs, this line only changed): every file under the given
// folders, read as bytes, searched for the gate token's value and for the
// gate header's name.  PNG crops are searched the same way (their bytes,
// text chunks included).  Prints and writes counts only; the token is read
// from <main>/conestruct/site/.env.local and never printed or written.
//   node scan-token.mjs <main checkout> <out json> <folder> [<folder> ...]
// The out file is written after the scan; run it twice to scan the out file.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, OUT, ...FOLDERS] = process.argv.slice(2);
const m = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8").match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
if (!m || m[1].length < 8) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
const require = createRequire(path.join(MAIN, "package.json"));
const { GATE_HEADER } = require(path.join(MAIN, "scripts/gate.cjs"));
const token = Buffer.from(m[1], "utf8");
const header = Buffer.from(GATE_HEADER, "utf8");

function files(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...files(f));
    else out.push(f);
  }
  return out;
}
const result = { ranAt: new Date().toISOString(), folders: [], filesScanned: 0, tokenHits: 0, headerNameHits: 0, filesWithHits: [] };
for (const [i, dir] of FOLDERS.entries()) {
  const list = files(dir);
  let tokenHits = 0;
  let headerHits = 0;
  for (const f of list) {
    const bytes = fs.readFileSync(f);
    const lower = Buffer.from(bytes.toString("latin1").toLowerCase(), "latin1");
    const t = bytes.includes(token);
    const h = lower.includes(header);
    if (t) tokenHits += 1;
    if (h) headerHits += 1;
    if (t || h) result.filesWithHits.push(`${path.relative(dir, f).replace(/\\/g, "/")} (${t ? "token" : ""}${t && h ? ", " : ""}${h ? "header name" : ""})`);
  }
  result.folders.push({ folder: `folder ${i + 1}: ${path.basename(dir)}`, files: list.length, png: list.filter((f) => f.endsWith(".png")).length, tokenHits, headerNameHits: headerHits });
  result.filesScanned += list.length;
  result.tokenHits += tokenHits;
  result.headerNameHits += headerHits;
}
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 1)}\n`, "utf8");
console.log(`token scan: ${result.filesScanned} files in ${FOLDERS.length} folders, token hits ${result.tokenHits}, header-name hits ${result.headerNameHits}`);
