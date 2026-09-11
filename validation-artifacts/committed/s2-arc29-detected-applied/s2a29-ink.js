// s2-arc29 leg 2 — the INK measurement, and the divergent-value case.
//
// Leg 1 (s2a29-lc.js) measured element rects and found header-right ==
// value-right, delta 0 on every row at both viewports.  That refutes the
// premise as #273 words it ("a header and the values under it never share
// an edge") — the BOXES share an edge, because a grid item stretches to
// its track.  What differs is the INK inside the box: the header's text is
// laid out at the start of a 112 px track while the value's text is laid
// out at its end.  This leg measures the text rect (Range over the node's
// contents), not the element rect, and re-measures the tracks on a
// DIVERGENT fixture — leg 1's fixture happens to render identical strings
// in both columns on every row, so the two `auto` tracks coincidentally
// matched and the column-width defect could not appear.
//
//   node s2a29-ink.js <outDir> <expectSha> [base]
const L = require("../s2-audit-1/audit-lib.js");
const { fs, path } = L;

const OUT = process.argv[2];
const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3005";
const FIX = { lat: "39.71466", lng: "-104.94071", way: "39508704" };

fs.mkdirSync(OUT, { recursive: true });
const { log } = L.mkLog(OUT);
const rows = [];
const rec = (o) => {
  rows.push(o);
  fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 2));
};
const info = (t, id, d) => { rec({ tag: t, id, ok: null, detail: d }); log(`[${t}] info ${id} — ${d}`); };
const check = (t, id, ok, d) => { rec({ tag: t, id, ok, detail: d }); log(`[${t}] ${ok ? "PASS" : "FAIL"} ${id} — ${d}`); };

// Ink rect: the text's own box, via a Range over the node contents.
const INK = () => {
  const blk = document.querySelector(".dva");
  if (!blk) return null;
  const grid = blk.querySelector(".dva-grid");
  const ink = (el) => {
    if (!el) return null;
    const r = document.createRange();
    // The cell's OWN text only.  Since the reserved provenance slot landed
    // (2026-09-11), selectNodeContents(el) would span the value AND the
    // slot beneath it and report the whole cell as "ink" — which is not
    // what the alignment acceptance is about.
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3);
    if (!own.length) {
      const b0 = el.getBoundingClientRect();
      return {
        text: "",
        boxL: Math.round(b0.left * 10) / 10, boxR: Math.round(b0.right * 10) / 10, boxW: Math.round(b0.width * 10) / 10,
        inkL: null, inkR: null, inkW: 0,
      };
    }
    r.setStartBefore(own[0]);
    r.setEndAfter(own[own.length - 1]);
    const t = r.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    return {
      text: own.map((n) => n.textContent.trim()).join("").trim(),
      boxL: Math.round(b.left * 10) / 10, boxR: Math.round(b.right * 10) / 10, boxW: Math.round(b.width * 10) / 10,
      inkL: Math.round(t.left * 10) / 10, inkR: Math.round(t.right * 10) / 10, inkW: Math.round(t.width * 10) / 10,
    };
  };
  // See s2a29-lc.js: #273 moved the headers into .dva-head.  Support both
  // shapes explicitly rather than letting the filter return nothing.
  const direct = Array.from(grid.children);
  const headWrap = grid.querySelector(".dva-head");
  const heads = (headWrap
    ? Array.from(headWrap.children)
    : direct.filter((e) => !e.classList.contains("contents"))
  ).map(ink);
  const gridRows = direct
    .filter(
      (e) => e.classList.contains("contents") && !e.classList.contains("dva-head"),
    )
    .map((w) => {
      const s = Array.from(w.children);
      return { label: ink(s[0]), detected: ink(s[1]), applied: ink(s[2]) };
    });
  return { heads, rows: gridRows, tracks: getComputedStyle(grid).gridTemplateColumns, blockW: Math.round(blk.getBoundingClientRect().width * 10) / 10 };
};

const drive = async (page) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 10000 });
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", { name: /Or enter coordinates manually|Hide coordinate/i });
  if (await manual.count()) {
    const txt = await manual.first().textContent();
    if (/Or enter/i.test(txt || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();
  for (let i = 0; i < 60; i++) {
    if (await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).count()) break;
    await page.waitForTimeout(500);
  }
  await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).first().click();
  await page.waitForTimeout(1500);
  await dlg.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(1200);
};

const report = async (page, tag, phase) => {
  const m = await page.evaluate(INK);
  if (!m) { info(tag, `${phase}`, "no block"); return null; }
  info(tag, `${phase} tracks`, `"${m.tracks}" · block w ${m.blockW}`);
  for (const h of m.heads) if (h && h.text) info(tag, `${phase} head "${h.text}"`, `box ${h.boxL}–${h.boxR} (w ${h.boxW}) · INK ${h.inkL}–${h.inkR} (w ${h.inkW})`);
  for (const r of m.rows) {
    info(tag, `${phase} row "${r.label.text}"`, `detected "${r.detected.text}" box ${r.detected.boxL}–${r.detected.boxR} INK ${r.detected.inkL}–${r.detected.inkR} | applied "${r.applied.text}" box ${r.applied.boxL}–${r.applied.boxR} INK ${r.applied.inkL}–${r.applied.inkR}`);
  }
  const det = m.heads.find((h) => h && /detected/i.test(h.text));
  const app = m.heads.find((h) => h && /applied/i.test(h.text));
  // Fail loudly rather than skipping: an earlier revision of this probe
  // silently produced no heads after the markup moved, which quietly
  // dropped the one assertion the leg exists for.
  check(tag, `${phase} both headers were found`, !!(det && app), `heads: ${m.heads.map((h) => (h ? `"${h.text}"` : "null")).join(", ") || "(none)"}`);
  if (det && app) {
    const dd = m.rows.map((r) => Math.round((r.detected.inkR - det.inkR) * 10) / 10);
    const ad = m.rows.map((r) => Math.round((r.applied.inkR - app.inkR) * 10) / 10);
    check(tag, `${phase} INK header-right == value-right (DETECTED)`, dd.every((x) => Math.abs(x) <= 1), `per-row ink delta ${dd.join(", ")} px (header ink right ${det.inkR})`);
    check(tag, `${phase} INK header-right == value-right (APPLIED)`, ad.every((x) => Math.abs(x) <= 1), `per-row ink delta ${ad.join(", ")} px (header ink right ${app.inkR})`);
  }
  const dW = [...new Set(m.rows.map((r) => r.detected.boxW))];
  const aW = [...new Set(m.rows.map((r) => r.applied.boxW))];
  check(tag, `${phase} the two value tracks share one width`, dW.length === 1 && aW.length === 1 && dW[0] === aW[0], `detected track ${dW.join("/")} · applied track ${aW.join("/")}`);
  return m;
};

async function run(vp) {
  const tag = `${vp.width}x${vp.height}`;
  const browser = await L.chromium.launch();
  const page = await browser.newPage({ viewport: vp });
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });
  await drive(page);

  await report(page, tag, "A identical-values");

  // ── divergent case: make applied differ from detected in the widest row.
  // Road type select in the shoulder form's Road step.
  const sel = page.locator("#sh-road-type");
  if (await sel.count()) {
    const before = await sel.inputValue();
    const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => ({ v: o.value, l: o.textContent.trim() })));
    const want = opts.find((o) => /freeway/i.test(o.l)) || opts.find((o) => o.v !== before);
    if (want) {
      await sel.selectOption(want.v);
      await page.waitForTimeout(1200);
      info(tag, "B applied road type changed", `${before} → ${want.v} ("${want.l}")`);
      await report(page, tag, "B divergent-values");
      await L.shot(page, OUT, `${tag}-divergent`, true);
    }
  } else info(tag, "B", "no #sh-road-type select — divergent case not exercised");

  await browser.close();
}

(async () => {
  await L.shaGate(log, EXPECT);
  log(`base ${BASE} · fixture ${FIX.lat},${FIX.lng} way ${FIX.way}`);
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    try { await run(vp); } catch (e) { log(`ERR ${vp.width}: ${e.stack}`); }
  }
  const f = rows.filter((r) => r.ok === false);
  log(`\n=== ${rows.filter((r) => r.ok === true).length} pass · ${f.length} fail ===`);
  for (const x of f) log(`FAIL [${x.tag}] ${x.id} — ${x.detail}`);
})();
