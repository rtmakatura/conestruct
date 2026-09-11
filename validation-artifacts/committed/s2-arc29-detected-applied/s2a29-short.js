// s2-arc29 leg 4 — the SHORT-value measurement, the row-height measurement,
// and the per-column marker census.  Investigating the three prod defects
// found by hand-check on 7d3eef3:
//
//   D1  the #274 marker renders on its own line, so Road type / Divided are
//       two lines tall while Bearing / Lanes are one — rows no longer share
//       a height and the marker's left edge matches nothing (P6, P1).
//   D2  only the DETECTED value is marked, while the APPLIED value inherits
//       the same inference and reads as measured.
//   D3  the acceptance measured ink-RIGHT equality on a DIVERGENT fixture
//       with LONG values.  With short values the header ink is WIDER than
//       the value ink, so right-alignment makes the right edges coincide
//       trivially while the header overhangs to the left.  This leg reports
//       ink LEFT and RIGHT for both, per row, so the overhang is a number.
//
//   node s2a29-short.js <outDir> <expectSha> [base]
//
// Nothing here changes product code; this is measurement only.
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

// Ink + box for every cell, plus row geometry and marker presence per column.
const PROBE = () => {
  const blk = document.querySelector(".dva");
  if (!blk) return null;
  const grid = blk.querySelector(".dva-grid");
  const m = (el) => {
    if (!el) return null;
    const r = document.createRange();
    // Ink of the cell's OWN text only — not the marker's — so a marker can
    // never be mistaken for the value when measuring alignment.
    const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3);
    let ink = null;
    if (own.length) {
      r.setStartBefore(own[0]);
      r.setEndAfter(own[own.length - 1]);
      const t = r.getBoundingClientRect();
      ink = { l: Math.round(t.left * 10) / 10, r: Math.round(t.right * 10) / 10, w: Math.round(t.width * 10) / 10 };
    }
    const b = el.getBoundingClientRect();
    const mk = el.querySelector(".tr-prov");
    let mkR = null;
    if (mk) {
      const mb = mk.getBoundingClientRect();
      mkR = {
        text: mk.textContent.trim(),
        l: Math.round(mb.left * 10) / 10,
        r: Math.round(mb.right * 10) / 10,
        top: Math.round(mb.top * 10) / 10,
        h: Math.round(mb.height * 10) / 10,
        display: getComputedStyle(mk).display,
      };
    }
    return {
      text: own.map((n) => n.textContent.trim()).join("").trim(),
      boxL: Math.round(b.left * 10) / 10,
      boxR: Math.round(b.right * 10) / 10,
      boxW: Math.round(b.width * 10) / 10,
      top: Math.round(b.top * 10) / 10,
      h: Math.round(b.height * 10) / 10,
      ink,
      marker: mkR,
      rule: `${getComputedStyle(el).borderBottomWidth} ${getComputedStyle(el).borderBottomStyle} ${getComputedStyle(el).borderBottomColor}`,
      slots: el.querySelectorAll(".dva-slot").length,
      slotText: (el.querySelector(".dva-slot") || {}).textContent
        ? el.querySelector(".dva-slot").textContent.trim()
        : "",
    };
  };
  const headWrap = grid.querySelector(".dva-head");
  const heads = (headWrap ? Array.from(headWrap.children) : []).map(m);
  const gridRows = Array.from(grid.children)
    .filter((e) => e.classList.contains("contents") && !e.classList.contains("dva-head"))
    .map((w) => {
      const s = Array.from(w.children);
      return { label: m(s[0]), detected: m(s[1]), applied: m(s[2]) };
    });
  return {
    heads,
    rows: gridRows,
    tracks: getComputedStyle(grid).gridTemplateColumns,
    rowGap: getComputedStyle(grid).rowGap,
    blockH: Math.round(blk.getBoundingClientRect().height * 10) / 10,
  };
};

const drive = async (page) => {
  await page.getByRole("button", { name: "Pick Location on Map" }).click();
  await page.waitForSelector("[role=dialog]", { timeout: 10000 });
  const dlg = page.locator("[role=dialog]");
  const manual = dlg.getByRole("button", { name: /Or enter coordinates manually|Hide coordinate/i });
  if (await manual.count()) {
    const t = await manual.first().textContent();
    if (/Or enter/i.test(t || "")) await manual.first().click();
  }
  await dlg.getByLabel("Latitude").fill(FIX.lat);
  await dlg.getByLabel("Longitude").fill(FIX.lng);
  await dlg.getByLabel("Longitude").blur();
  for (let i = 0; i < 60; i++) {
    if (await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).count()) break;
    await page.waitForTimeout(500);
  }
  await dlg.locator("button", { hasText: new RegExp(`way ${FIX.way}`) }).first().click();
  await page.waitForTimeout(1400);
  await dlg.getByRole("button", { name: "Save & Close" }).click();
  await page.waitForSelector("[role=dialog]", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(1100);
};

const report = async (page, tag, phase) => {
  const p = await page.evaluate(PROBE);
  if (!p) { info(tag, phase, "no block"); return null; }
  info(tag, `${phase} tracks`, `"${p.tracks}" · row-gap ${p.rowGap} · block h ${p.blockH}`);

  const det = p.heads.find((h) => h && /detected/i.test(h.text));
  const app = p.heads.find((h) => h && /applied/i.test(h.text));
  check(tag, `${phase} both headers found`, !!(det && app), p.heads.map((h) => `"${h ? h.text : "?"}"`).join(", "));
  if (det) info(tag, `${phase} head DETECTED`, `box ${det.boxL}–${det.boxR} (w ${det.boxW}) · INK ${det.ink.l}–${det.ink.r} (w ${det.ink.w})`);
  if (app) info(tag, `${phase} head APPLIED`, `box ${app.boxL}–${app.boxR} (w ${app.boxW}) · INK ${app.ink.l}–${app.ink.r} (w ${app.ink.w})`);

  // ── D3: ink LEFT and RIGHT, per row, both columns ──
  for (const r of p.rows) {
    const d = r.detected, a = r.applied;
    info(
      tag,
      `${phase} INK "${r.label.text}"`,
      `detected "${d.text}" ink ${d.ink ? `${d.ink.l}–${d.ink.r} (w ${d.ink.w})` : "—"} | applied "${a.text}" ink ${a.ink ? `${a.ink.l}–${a.ink.r} (w ${a.ink.w})` : "—"}`,
    );
    if (det && d.ink) {
      const overL = Math.round((d.ink.l - det.ink.l) * 10) / 10;
      const dR = Math.round((d.ink.r - det.ink.r) * 10) / 10;
      info(tag, `${phase} D3 detected "${r.label.text}"`, `ink-right delta ${dR} px · header ink LEFT overhangs the value by ${overL} px`);
    }
    if (app && a.ink) {
      const overL = Math.round((a.ink.l - app.ink.l) * 10) / 10;
      const aR = Math.round((a.ink.r - app.ink.r) * 10) / 10;
      info(tag, `${phase} D3 applied "${r.label.text}"`, `ink-right delta ${aR} px · header ink LEFT overhangs the value by ${overL} px`);
    }
  }

  // ── D3 restated: the header BOX spans its track, and the rule spans the
  // box.  A grid item stretches to its track, so "header box == value box"
  // in the same column IS "header box == track".
  for (const [name, head, key] of [["DETECTED", det, "detected"], ["APPLIED", app, "applied"]]) {
    if (!head) continue;
    const bad = p.rows.filter((r) => Math.abs(r[key].boxL - head.boxL) > 1 || Math.abs(r[key].boxR - head.boxR) > 1);
    check(
      tag,
      `${phase} D3 ${name} header box == its track (every row)`,
      bad.length === 0,
      `header box ${head.boxL}–${head.boxR}; ${bad.length ? bad.map((r) => `"${r.label.text}" ${r[key].boxL}–${r[key].boxR}`).join(" ; ") : "all rows match"}`,
    );
    check(tag, `${phase} D3 ${name} header carries the hairline`, /^1px solid/.test(head.rule), `border-bottom: ${head.rule}`);
  }
  const dW = [...new Set(p.rows.map((r) => r.detected.boxW))];
  const aW = [...new Set(p.rows.map((r) => r.applied.boxW))];
  check(tag, `${phase} D3 the two value tracks are equal`, dW.length === 1 && aW.length === 1 && dW[0] === aW[0], `detected ${dW.join("/")} · applied ${aW.join("/")}`);

  // ── D1 restated: every value cell reserves exactly one slot ──
  const missing = [];
  for (const r of p.rows) for (const k of ["detected", "applied"]) if (r[k].slots !== 1) missing.push(`"${r.label.text}".${k}=${r[k].slots}`);
  check(tag, `${phase} D1 every value cell reserves exactly one slot`, missing.length === 0, missing.length ? missing.join(" ; ") : "all cells reserve one");

  // ── D2 restated: what each column says ──
  for (const r of p.rows) {
    info(tag, `${phase} D2 tokens "${r.label.text}"`, `detected "${r.detected.text}" → [${r.detected.slotText || "(silent)"}] | applied "${r.applied.text}" → [${r.applied.slotText || "(silent)"}]`);
  }

  // ── the 520 stack (ruling b of round 1): below the threshold the grid
  // is ONE column and each row wrapper pairs its own two equal cells.
  const oneCol = /^\s*\d+(\.\d+)?px\s*$/.test(p.tracks);
  if (tag.startsWith("380")) {
    check(tag, `${phase} 520 stack — the grid is one column at 380`, oneCol, `tracks "${p.tracks}"`);
  } else {
    check(tag, `${phase} 520 stack — the grid keeps three tracks at 1440`, !oneCol, `tracks "${p.tracks}"`);
  }

  // ── D1: do the rows share a height? ──
  const heights = p.rows.map((r) => Math.max(r.label.h, r.detected.h, r.applied.h));
  const uniq = [...new Set(heights)];
  check(
    tag,
    `${phase} D1 all rows share one height`,
    uniq.length === 1,
    p.rows.map((r, i) => `"${r.label.text}"=${heights[i]}`).join(" · ") + ` → ${uniq.length} distinct`,
  );
  const marked = p.rows.filter((r) => r.detected.marker || r.applied.marker);
  const unmarked = p.rows.filter((r) => !r.detected.marker && !r.applied.marker);
  if (marked.length && unmarked.length) {
    const mh = Math.max(...marked.map((r) => Math.max(r.label.h, r.detected.h, r.applied.h)));
    const uh = Math.max(...unmarked.map((r) => Math.max(r.label.h, r.detected.h, r.applied.h)));
    info(tag, `${phase} D1 marked vs unmarked row height`, `marked ${mh} px · unmarked ${uh} px · delta ${Math.round((mh - uh) * 10) / 10} px`);
  }

  // ── D1b: the marker's own geometry — is it on its own line? ──
  for (const r of p.rows) {
    const mk = r.detected.marker;
    if (mk) {
      const sameLine = r.detected.ink && Math.abs(mk.top - (r.detected.top)) < 4;
      info(
        tag,
        `${phase} D1b marker "${r.label.text}"`,
        `"${mk.text}" display=${mk.display} ink ${mk.l}–${mk.r} top ${mk.top} (cell top ${r.detected.top}) → ${sameLine ? "same line" : "OWN LINE"}; left edge vs value left ${r.detected.ink ? Math.round((mk.l - r.detected.ink.l) * 10) / 10 : "?"} px`,
      );
    }
  }

  // ── D2: which columns carry a marker ──
  for (const r of p.rows) {
    info(
      tag,
      `${phase} D2 "${r.label.text}"`,
      `detected "${r.detected.text}" marker=${r.detected.marker ? `"${r.detected.marker.text}"` : "none"} | applied "${r.applied.text}" marker=${r.applied.marker ? `"${r.applied.marker.text}"` : "none"}`,
    );
  }
  const asym = p.rows.filter((r) => r.detected.marker && !r.applied.marker && r.detected.text === r.applied.text);
  check(
    tag,
    `${phase} D2 no row marks one column while the other shows the SAME value unmarked`,
    asym.length === 0,
    asym.length ? asym.map((r) => `"${r.label.text}": both read "${r.detected.text}", only detected marked`).join(" ; ") : "none",
  );
  return p;
};

async function run(vp) {
  const tag = `${vp.width}x${vp.height}`;
  const browser = await L.chromium.launch();
  const page = await browser.newPage({ viewport: vp });
  await page.goto(`${BASE}/sandbox`, { waitUntil: "networkidle" });
  await drive(page);

  // A: as the hand-check saw it — all four rows, OSM's own values.
  await report(page, tag, "A as-found");
  await L.shot(page, OUT, `${tag}-as-found`, true);

  // B: SHORT values in both columns — the case the acceptance never covered.
  // "Urban arterial" is the shortest ROAD_TYPE_LABELS entry; Bearing and
  // Lanes are naturally short in both columns.
  const sel = page.locator("#sh-road-type");
  if (await sel.count()) {
    const opts = await sel.locator("option").evaluateAll((os) => os.map((o) => ({ v: o.value, l: o.textContent.trim() })));
    const shortest = opts.slice().sort((a, b) => a.l.length - b.l.length)[0];
    await sel.selectOption(shortest.v);
    await page.waitForTimeout(1100);
    info(tag, "B applied road type", `set to "${shortest.l}" (shortest of ${opts.map((o) => `"${o.l}"`).join(", ")})`);
    await report(page, tag, "B short-values");
    await L.shot(page, OUT, `${tag}-short-values`, true);
  } else info(tag, "B", "no #sh-road-type select");

  // ── axe, on the settled block state, per viewport ──
  const ax = await L.runAxe(page, OUT, `${tag}-axe`);
  const inBlock = ax.filter((v) => v.nodes.some((n) => /dva/.test(String(n.target))));
  check(
    tag,
    "axe — no violation inside the block",
    inBlock.length === 0,
    ax.length
      ? `page: ${ax.map((v) => `${v.id}x${v.nodes.length}`).join(" ; ")} — in-block: ${inBlock.length ? inBlock.map((v) => v.id).join(", ") : "none"}`
      : "0 violations page-wide",
  );

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
