// s2-arc29 live check — the detected-vs-applied block (#273 layout, #274
// confidence, #275 stale lanes cell).  This is THE LEG THE AUDIT NEVER TOOK:
// s2-audit-1/findings.md:196 records #235 Surface A under "Could not measure"
// because audit-walk.js opens the picker, measures the dialog, cancels it and
// then pins manually (audit-walk.js:114-131, :56-61, :137) — so the block,
// which mounts only behind a confirmed road, never rendered in that walk.
//
// This harness drives the picker to a REAL road detection on the fixture the
// audit itself names (E Bayaud 39.71466,-104.94071, way 39508704, detected
// 85°), then measures the mounted block.
//
//   node s2a29-lc.js <outDir> <expectSha> [base] [healthz]
//
// Legs, per viewport (1440x1000 and 380x800):
//   P   picker driven to a confirmed road: open → manual coords → detection →
//       pick way 39508704 → Save & Close.  Records the candidate list, which
//       way was picked, and that the block mounted.  No pick = no figures.
//   D1  the block's geometry, per row: label / DETECTED header / detected
//       value / APPLIED header / applied value rects, the grid's RESOLVED
//       track widths, and the header-vs-value right-edge delta that #273's
//       acceptance is written against.
//   D2  every text node in the block: className, tr-* role (or none),
//       computed size / weight / colour / text-align.  The #226 role census
//       and the register question (#273 defect 2).
//   D3  which rows rendered and which did not, with the reason (#274/#275
//       need to know what this fixture exercises).
//   D4  the #214 disclosure sentence, byte-exact, as the contract check.
//   L   the #275 leg: edit lanes in the form, then re-read the Detected
//       lanes cell.  Records what it says before and after the relay clear.
//
// Nothing here changes product code; this is measurement only.
const L = require("../s2-audit-1/audit-lib.js");
const { fs, path } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3005";
const HEALTHZ =
  process.argv[5] ||
  "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";

const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704", bearing: 85 };
const VIEWPORTS = [
  { width: 1440, height: 1000 },
  { width: 380, height: 800 },
];

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => {
  rows.push(o);
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 2));
};
const check = (tag, id, ok, detail) => {
  rec({ tag, id, ok, detail });
  log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`);
};
const info = (tag, id, detail) => {
  rec({ tag, id, ok: null, detail });
  log(`[${tag}] info ${id} — ${detail}`);
};

// ── in-page probe: the block's visual grid ────────────────────────────────
// .dva-grid's row wrappers are `display: contents`, so the real grid items
// are the spans INSIDE them.  Walk to the spans, never to the wrappers.
const BLOCK = () => {
  const blk = document.querySelector(".dva");
  if (!blk) return null;
  const grid = blk.querySelector(".dva-grid");
  const r = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const c = getComputedStyle(el);
    return {
      text: (el.textContent || "").trim(),
      left: Math.round(b.left * 10) / 10,
      right: Math.round(b.right * 10) / 10,
      top: Math.round(b.top * 10) / 10,
      bottom: Math.round(b.bottom * 10) / 10,
      w: Math.round(b.width * 10) / 10,
      h: Math.round(b.height * 10) / 10,
      cls: (el.className || "").toString().trim(),
      align: c.textAlign,
      size: c.fontSize,
      weight: c.fontWeight,
      color: c.color,
      family: c.fontFamily.split(",")[0].replace(/["']/g, ""),
      variant: c.fontVariantNumeric,
    };
  };
  // Header cells: the three direct children before the row wrappers.
  // Headers live in .dva-head since #273; before that they were bare
  // children of .dva-grid.  Handle both so the committed record re-runs
  // against either shape — and never silently produce an empty head list.
  const direct = Array.from(grid.children);
  const headWrap = grid.querySelector(".dva-head");
  const heads = headWrap
    ? Array.from(headWrap.children)
    : direct.filter((e) => !e.classList.contains("contents"));
  const wrappers = direct.filter(
    (e) => e.classList.contains("contents") && !e.classList.contains("dva-head"),
  );
  const gridRows = wrappers.map((w) => {
    const spans = Array.from(w.children);
    return { label: r(spans[0]), detected: r(spans[1]), applied: r(spans[2]) };
  });
  const gc = getComputedStyle(grid);
  return {
    block: r(blk),
    section: r(blk.querySelector(".tr-section")),
    provTop: r(blk.querySelector(".tr-prov")),
    provBottom: r(blk.querySelectorAll(".tr-prov")[1]),
    heads: heads.map(r),
    rows: gridRows,
    tracks: gc.gridTemplateColumns,
    colGap: gc.columnGap,
    rowGap: gc.rowGap,
    alignItems: gc.alignItems,
    // every text-bearing element inside the block, for the role census
    nodes: Array.from(blk.querySelectorAll("*"))
      .filter((e) =>
        Array.from(e.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent.trim(),
        ),
      )
      .map(r),
  };
};

const openPicker = async (page) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 10000 });
};

// Drive the picker to a confirmed road.  Returns {picked, candidates, label}.
const confirmRoad = async (page, tag) => {
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", {
    name: /Or enter coordinates manually|Hide coordinate/i,
  });
  if (await manual.count()) {
    const txt = await manual.first().textContent();
    if (/Or enter/i.test(txt || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();

  // Detection is an Overpass round trip; #256 says a first scan can refuse.
  // Wait for either candidates or a settled no-road state; never fake.
  let candidates = [];
  for (let i = 0; i < 60; i++) {
    candidates = await dlg
      .locator("button", { hasText: /way \d+/ })
      .allTextContents()
      .catch(() => []);
    if (candidates.length) break;
    await page.waitForTimeout(500);
  }
  info(tag, "P candidates", `${candidates.length}: ${candidates.map((c) => c.replace(/\s+/g, " ").trim()).join(" | ")}`);
  if (!candidates.length) return { picked: null, candidates, label: null };

  const want = dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) });
  const haveFixture = (await want.count()) > 0;
  const target = haveFixture ? want.first() : dlg.locator("button", { hasText: /way \d+/ }).first();
  const label = (await target.textContent()).replace(/\s+/g, " ").trim();
  await target.click();
  await page.waitForTimeout(1500);

  const save = dlg.getByRole("button", { name: "Save & Close" });
  const disabled = await save.isDisabled();
  info(tag, "P save-state", `Save & Close disabled=${disabled} after picking "${label}"`);
  if (disabled) return { picked: null, candidates, label };
  await save.click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 10000 });
  return { picked: haveFixture ? FIX.way : "other", candidates, label };
};

async function run(vp) {
  const tag = `${vp.width}x${vp.height}`;
  const T = (n) => `${tag}-${n}`;
  const browser = await L.chromium.launch();
  const page = await browser.newPage({ viewport: vp });
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });

  const kind = await page
    .locator("select")
    .first()
    .inputValue()
    .catch(() => "?");
  info(tag, "P kind", `scenario kind on load: ${kind}`);

  await openPicker(page);
  await L.shot(page, OUT, T("picker-open"));
  const pick = await confirmRoad(page, tag);
  if (!pick.picked) {
    check(tag, "P confirmed-road", false, `no road confirmed (candidates ${pick.candidates.length}) — block cannot mount; figures NOT taken`);
    await browser.close();
    return false;
  }
  check(tag, "P confirmed-road", true, `picked "${pick.label}" (fixture way ${FIX.way}: ${pick.picked === FIX.way})`);

  await page.waitForTimeout(1500);
  await L.shot(page, OUT, T("after-save"), true);

  const b = await page.evaluate(BLOCK);
  if (!b) {
    check(tag, "D1 mounted", false, "the .dva block did not mount after a confirmed road");
    await browser.close();
    return false;
  }
  check(tag, "D1 mounted", true, `.dva ${b.block.w}×${b.block.h} at ${b.block.left},${b.block.top}`);

  // ── D1: geometry ──
  info(tag, "D1 tracks", `grid-template-columns resolved "${b.tracks}" · column-gap ${b.colGap} · row-gap ${b.rowGap} · align-items ${b.alignItems}`);
  info(tag, "D1 heads", b.heads.map((h, i) => `[${i}] "${h.text || "(spacer)"}" ${h.w}×${h.h} L${h.left} R${h.right} align=${h.align}`).join(" ; "));

  const det = b.heads.find((h) => /detected/i.test(h.text));
  const app = b.heads.find((h) => /applied/i.test(h.text));
  for (const r of b.rows) {
    info(tag, `D1 row "${r.label.text}"`, `label L${r.label.left} R${r.label.right} align=${r.label.align} | detected "${r.detected.text}" L${r.detected.left} R${r.detected.right} align=${r.detected.align} | applied "${r.applied.text}" L${r.applied.left} R${r.applied.right} align=${r.applied.align}`);
  }
  // the acceptance figure #273 is written against
  if (det && app) {
    const dDelta = b.rows.map((r) => Math.round((r.detected.right - det.right) * 10) / 10);
    const aDelta = b.rows.map((r) => Math.round((r.applied.right - app.right) * 10) / 10);
    check(tag, "D1 header-right == value-right (DETECTED)", dDelta.every((d) => Math.abs(d) <= 1), `per-row delta ${dDelta.join(", ")} (header R${det.right})`);
    check(tag, "D1 header-right == value-right (APPLIED)", aDelta.every((d) => Math.abs(d) <= 1), `per-row delta ${aDelta.join(", ")} (header R${app.right})`);
    const dW = b.rows.map((r) => r.detected.w), aW = b.rows.map((r) => r.applied.w);
    info(tag, "D1 value-track widths", `detected col widths ${[...new Set(dW)].join("/")} · applied col widths ${[...new Set(aW)].join("/")}`);
  }
  const labelLefts = [...new Set(b.rows.map((r) => r.label.left))];
  check(tag, "D1 labels share one left edge", labelLefts.length === 1, `lefts ${labelLefts.join(", ")}`);

  // ── D2: type census / register ──
  const census = {};
  for (const n of b.nodes) {
    const k = `${n.size}/${n.weight}/${n.family}/${n.color}`;
    census[k] = (census[k] || 0) + 1;
  }
  info(tag, "D2 type tuples", `${Object.keys(census).length} distinct (size/weight/family/colour): ${Object.entries(census).map(([k, v]) => `${k}×${v}`).join(" ; ")}`);
  const roleless = b.nodes.filter((n) => !/tr-(section|prov|field|step)/.test(n.cls));
  info(tag, "D2 nodes off the tr-* roles", `${roleless.length}: ${roleless.map((n) => `"${n.text.slice(0, 28)}"[${n.cls.slice(0, 60) || "(no class)"}] ${n.size}/${n.weight}`).join(" ; ")}`);
  if (det && app) {
    const pair = b.rows[0];
    info(tag, "D2 register", `detected colour ${pair.detected.color} weight ${pair.detected.weight} · applied colour ${pair.applied.color} weight ${pair.applied.weight} · numerals detected="${pair.detected.variant}" applied="${pair.applied.variant}"`);
  }

  // ── D3: which rows rendered ──
  info(tag, "D3 rows rendered", `${b.rows.length}: ${b.rows.map((r) => `${r.label.text}="${r.detected.text}"→"${r.applied.text}"`).join(" ; ")}`);

  // ── D4: the #214 contract sentence, byte-exact ──
  const SENT_GEOM = "road geometry governs the drawing — the typed bearing sets the travel-direction sign only";
  const SENT_MANUAL = "no road geometry on file — the typed bearing drives the drawing";
  const bottom = b.provBottom ? b.provBottom.text : "(absent)";
  check(tag, "D4 #214 sentence byte-identical", bottom === SENT_GEOM || bottom === SENT_MANUAL, `"${bottom}"`);
  info(tag, "D4 provenance line", `top "${b.provTop ? b.provTop.text : "(absent)"}"`);

  // ── L: the #275 leg — edit lanes, re-read the Detected lanes cell ──
  const laneRowBefore = b.rows.find((r) => /lanes/i.test(r.label.text));
  if (laneRowBefore) {
    info(tag, "L before", `Detected lanes "${laneRowBefore.detected.text}" · Applied "${laneRowBefore.applied.text}"`);
    // the shoulder form's lanes chips
    const chips = page.locator("#rail-step-road, .setup-panel").getByRole("button", { name: /^[1-4]$/ });
    const n = await chips.count();
    if (n) {
      const cur = laneRowBefore.applied.text.trim();
      const want = cur === "2" ? "3" : "2";
      const target = chips.filter({ hasText: new RegExp(`^${want}$`) }).first();
      if (await target.count()) {
        await target.click();
        await page.waitForTimeout(1200);
        const after = await page.evaluate(BLOCK);
        const laneRowAfter = after && after.rows.find((r) => /lanes/i.test(r.label.text));
        if (laneRowAfter) {
          info(tag, "L after", `clicked lanes=${want} — Detected lanes now "${laneRowAfter.detected.text}" · Applied "${laneRowAfter.applied.text}"`);
          check(tag, "L #275 detected cell after the relay clear", laneRowAfter.detected.text !== laneRowBefore.detected.text || /overr|was|—/i.test(laneRowAfter.detected.text), `before "${laneRowBefore.detected.text}" → after "${laneRowAfter.detected.text}" (unchanged + unmarked = the #275 defect)`);
          await L.shot(page, OUT, T("after-lane-edit"), true);
        }
      } else info(tag, "L", `no lanes chip for ${want}`);
    } else info(tag, "L", "no lanes chips found in the road step");
  } else info(tag, "L", "no lanes row on this fixture — #275 leg not exercised");

  info(tag, "pageerrors", errs.length ? errs.join(" | ") : "0");
  await browser.close();
  return true;
}

(async () => {
  await L.shaGate(log, EXPECT);
  log(`base ${BASE} · fixture ${FIX.lat},${FIX.lng} way ${FIX.way}`);
  for (const vp of VIEWPORTS) {
    try {
      await run(vp);
    } catch (e) {
      log(`ERR ${vp.width}x${vp.height}: ${e.stack}`);
      rec({ tag: `${vp.width}x${vp.height}`, id: "run", ok: false, detail: `aborted: ${e.message.slice(0, 300)}` });
    }
  }
  const fails = rows.filter((r) => r.ok === false);
  log(`\n=== ${rows.filter((r) => r.ok === true).length} pass · ${fails.length} fail · ${rows.filter((r) => r.ok === null).length} info ===`);
  for (const f of fails) log(`FAIL [${f.tag}] ${f.id} — ${f.detail}`);
})();
