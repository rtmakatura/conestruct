/**
 * Arc 16 coda re-verification (Refs #200) — one check: axe on the
 * PRE-PIN generator page (the state that carried the color-contrast
 * FAIL) must come back clean. READ-ONLY: no pin, no generate, no saves.
 *
 * Also measures (not asserts) the quiet band's computed style + the
 * effective contrast, Rule 13/12 style, so the log carries the number.
 *
 * Run from repo root:
 *   EXPECTED_SHA=$(git rev-parse origin/main) \
 *   NODE_PATH=conestruct/site/node_modules node coda-recheck.js
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
const OUT = path.join(__dirname, "out16");
fs.mkdirSync(OUT, { recursive: true });

const SITE = "https://www.conestruct.com/sandbox";
const EXPECTED_SHA = process.env.EXPECTED_SHA || "";

const lines = [];
let failures = 0;
function log(msg) {
  const stamp = new Date().toISOString();
  lines.push(`- \`${stamp}\` ${msg}`);
  console.log(`${stamp} ${msg}`);
}
function assert(name, cond, extra = "") {
  if (cond) log(`**PASS** — ${name}${extra ? ` (${extra})` : ""}`);
  else {
    failures++;
    log(`**FAIL** — ${name}${extra ? ` (${extra})` : ""}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1800 } });
  const page = await ctx.newPage();

  // ── Gate ──────────────────────────────────────────────────────────
  const hz = await (
    await page.request.get(
      "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz",
    )
  ).json();
  log(`healthz sha: ${hz.sha}`);
  log(`expected (git rev-parse origin/main): ${EXPECTED_SHA}`);
  await page.goto(SITE, { waitUntil: "networkidle" });
  const chunkUrls = await page.evaluate(() =>
    Array.from(document.querySelectorAll("script[src]"))
      .map((s) => s.src)
      .filter((s) => s.includes("/_next/static")),
  );
  let servedSha = null;
  for (const u of chunkUrls) {
    const txt = await (await page.request.get(u)).text();
    const m = txt.match(new RegExp(`${EXPECTED_SHA.slice(0, 7)}[0-9a-f]{33}`));
    if (m) {
      servedSha = m[0];
      break;
    }
  }
  log(`served bundle sha: ${servedSha}`);
  if (hz.sha !== EXPECTED_SHA || servedSha !== EXPECTED_SHA) {
    log("**ABORT** — build gate mismatch (runner: pause and retry if mid-propagation)");
    process.exit(2);
  }
  assert("gate. healthz == origin/main == served bundle", true, hz.sha.slice(0, 7));

  // ── The quiet band, measured ──────────────────────────────────────
  const quiet = page
    .getByText(/drop a site pin for a jurisdiction suggestion/i)
    .first();
  await quiet.waitFor({ timeout: 15000 });
  const measured = await quiet.evaluate((el) => {
    const strip = el.closest(".jbar-suggest");
    const cs = getComputedStyle(strip);
    const bgEl = strip.closest(".jctl");
    const lum = (rgb) => {
      const c = rgb
        .map((v) => v / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const parse = (s) => (s.match(/\d+/g) || []).slice(0, 3).map(Number);
    const fg = parse(getComputedStyle(el).color);
    const bg = parse(getComputedStyle(bgEl).backgroundColor);
    const alpha = parseFloat(cs.opacity);
    const eff = fg.map((v, i) => Math.round(alpha * v + (1 - alpha) * bg[i]));
    const [hi, lo] = [lum(eff), lum(bg)].sort((a, b) => b - a);
    return {
      color: getComputedStyle(el).color,
      opacity: cs.opacity,
      bg: getComputedStyle(bgEl).backgroundColor,
      ratio: ((hi + 0.05) / (lo + 0.05)).toFixed(3),
    };
  });
  log(
    `quiet band measured: color=${measured.color} opacity=${measured.opacity} ` +
      `bg=${measured.bg} → effective contrast ${measured.ratio}:1`,
  );
  assert(
    "1. quiet band effective contrast ≥ 4.5:1 (computed in-page)",
    parseFloat(measured.ratio) >= 4.5,
    `${measured.ratio}:1`,
  );

  // ── The one check: axe on the pre-pin page ────────────────────────
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
    }),
  );
  const compact = res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map((n) => n.target.join(" ")),
  }));
  fs.writeFileSync(
    path.join(OUT, "coda-axe-generator.json"),
    JSON.stringify(compact, null, 2),
  );
  assert(
    "2. axe zero violations — pre-pin generator page (the FAIL state)",
    compact.length === 0,
    compact.length ? `${compact.length} finding(s) — coda-axe-generator.json` : "0",
  );

  await browser.close();
  fs.writeFileSync(
    path.join(OUT, "coda-assertions-raw.md"),
    `# Arc 16 coda re-verification — raw log\n\n${lines.join("\n")}\n\nFailures: ${failures}\n`,
  );
  console.log(`\nDone. Failures: ${failures}`);
  process.exit(failures === 0 ? 0 : 1);
})();
