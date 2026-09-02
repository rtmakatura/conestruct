/** s2-arc13 prod live checks (Refs #229) — READ-ONLY, sha-gated in its own output.
 *
 *  Prologue: UTC timestamp, BASE, the live /healthz JSON verbatim,
 *  `git rev-parse origin/main` (after a fetch), and a PASS/FAIL gate that
 *  the healthz sha equals origin/main.  The run ABORTS if the gate fails.
 *
 *   A1  POST the Lakewood-control scenario (tests/fixtures/tiering/
 *       control-lakewood.json, 35 mph shoulder) to the public audit proxy;
 *       sections.taper.source cites Table 6B-4 for L and Table 6B-3 for
 *       the L/3 ratio, both under Sec 6B.08; values unchanged (L 163, L/3 54).
 *   A2  the same through /api/render/audit-pdf: the served PDF's text
 *       carries both cites (pypdfium2 via `uv run`, U+2011 normalised).
 *   B1  GET /landing (redirect not followed) answers a permanent redirect
 *       whose Location is /sandbox.
 *   B2  GET /landing followed lands on the sandbox title; the archived
 *       copy ("~90 sec", "100% MUTCD-cited") is not served.
 *
 *  No saves, no DB writes.  Output: <OUT_DIR>/s2a13-lc-prod.md (+ the
 *  served audit JSON and PDF).  Run from anywhere:
 *    node validation-artifacts/committed/s2-arc13-demo-fixes/s2a13-lc-prod.js
 *  OUT_DIR defaults to outS2A13Prod beside this file.
 */
const { execSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..", "..", "..");
const OUT = path.join(__dirname, process.env.OUT_DIR || "outS2A13Prod");
fs.mkdirSync(OUT, { recursive: true });
const BASE = "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push("- `" + stamp + "` " + msg);
  console.log(stamp + " " + msg);
}
function assert(name, cond, extra) {
  if (!cond) failures++;
  log((cond ? "**PASS**" : "**FAIL**") + " — " + name + (extra ? " (" + extra + ")" : ""));
}
function writeMd() {
  fs.writeFileSync(
    path.join(OUT, "s2a13-lc-prod.md"),
    "# s2-arc13 prod live checks (Refs #229)\n\n" + lines.join("\n") + "\n",
  );
}
function req(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const headers = { "user-agent": "s2a13-lc-prod/readonly" };
    if (data) {
      headers["content-type"] = "application/json";
      headers["content-length"] = data.length;
    }
    const r = https.request(
      { method, hostname: u.hostname, path: u.pathname + u.search, headers },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }),
        );
      },
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}

(async () => {
  log("run start (UTC): " + new Date().toISOString());
  log("BASE: " + BASE);
  const hz = await req("GET", HEALTHZ);
  const hzText = hz.body.toString("utf8").trim();
  log("healthz (HTTP " + hz.status + "): " + hzText);
  execSync("git fetch --quiet", { cwd: ROOT });
  const om = execSync("git rev-parse origin/main", { cwd: ROOT }).toString().trim();
  log("git rev-parse origin/main: " + om);
  const hzSha = JSON.parse(hzText).sha;
  assert("GATE — healthz sha == origin/main", hzSha === om, hzSha + " vs " + om);
  if (hzSha !== om) {
    log("ABORT: gate failed");
    writeMd();
    process.exit(2);
  }

  // A1 — served audit JSON
  const fx = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tests/fixtures/tiering/control-lakewood.json"), "utf8"),
  );
  const scenario = fx.scenario || fx;
  const a = await req("POST", BASE + "/api/render/audit", { scenario });
  fs.writeFileSync(path.join(OUT, "audit-control-lakewood.json"), a.body);
  let taper = {};
  try {
    taper = JSON.parse(a.body.toString("utf8")).sections.taper;
  } catch (e) {
    /* asserted below */
  }
  const src = taper.source || "";
  assert("A1. /api/render/audit serves the Lakewood control", a.status === 200, "HTTP " + a.status);
  assert(
    "A1. taper.source cites Table 6B-4 for L",
    src.includes("Sec 6B.08, Table 6B-4 (taper length L)"),
    JSON.stringify(src),
  );
  assert(
    "A1. taper.source cites Table 6B-3 for the L/3 ratio",
    src.includes("Shoulder closures use L/3 per Sec 6B.08 (Table 6B-3)"),
  );
  assert(
    "A1. exactly one 6B-3 and one 6B-4 in the sentence",
    (src.match(/6B-3/g) || []).length === 1 && (src.match(/6B-4/g) || []).length === 1,
  );
  assert(
    "A1. values unchanged — L 163 ft, L/3 54 ft",
    taper.L_full_ft === 163 && taper.L_required_ft === 54,
    "L_full_ft=" + taper.L_full_ft + " L_required_ft=" + taper.L_required_ft,
  );

  // A2 — served audit PDF text
  const p = await req("POST", BASE + "/api/render/audit-pdf", { scenario });
  const pdfPath = path.join(OUT, "audit-control-lakewood.pdf");
  fs.writeFileSync(pdfPath, p.body);
  assert("A2. /api/render/audit-pdf serves", p.status === 200, "HTTP " + p.status + ", " + p.body.length + " bytes");
  let pdfText = "";
  try {
    const py =
      "import sys,pypdfium2 as m;d=m.PdfDocument(sys.argv[1]);" +
      "sys.stdout.reconfigure(encoding='utf-8');" +
      "print(chr(10).join(p.get_textpage().get_text_range() for p in d))";
    pdfText = execSync('uv run python -c "' + py + '" "' + pdfPath + '"', { cwd: ROOT }).toString("utf8");
  } catch (e) {
    log("A2 text extraction failed: " + String(e).slice(0, 200));
  }
  const norm = pdfText.replace(/‑/g, "-").replace(/\s+/g, " ");
  assert("A2. audit PDF carries the 6B-4 formula cite", norm.includes("Table 6B-4 (taper length L)"));
  assert("A2. audit PDF carries the 6B-3 ratio cite", norm.includes("L/3 per Sec 6B.08 (Table 6B-3)"));

  // B1 — /landing redirect, not followed
  const b = await req("GET", BASE + "/landing");
  assert(
    "B1. GET /landing answers a permanent redirect (301 or 308)",
    b.status === 301 || b.status === 308,
    "HTTP " + b.status,
  );
  const loc = b.headers.location || "";
  assert(
    "B1. Location is /sandbox",
    /^(https?:\/\/www\.conestruct\.com)?\/sandbox\/?$/.test(loc),
    "Location=" + loc,
  );

  // B2 — followed
  const target = loc.startsWith("http") ? loc : BASE + (loc || "/landing");
  const c = await req("GET", target);
  const html = c.body.toString("utf8");
  const title = (html.match(/<title>(.*?)<\/title>/s) || ["", ""])[1].trim();
  assert(
    "B2. following the redirect lands on the sandbox",
    c.status === 200 && /Sandbox/.test(title),
    "HTTP " + c.status + ", title=" + JSON.stringify(title),
  );
  assert("B2. the archived copy is not served", !/100% MUTCD-cited|~90 sec/.test(html));

  log(failures === 0 ? "ALL PASS" : "DONE — failures: " + failures);
  writeMd();
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  log("CRASH: " + (e && e.stack ? e.stack : e));
  writeMd();
  process.exit(3);
});
