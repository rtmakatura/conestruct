// #490 (Ryan, 2026-11-10): "Columns that sit side by side always end
// together."  This is the permanent check.  It walks the tool page through
// every WHERE state and content variant at each size and text zoom, and in
// each one measures the bottoms of the two WHERE columns (the aerial frame
// against the right column's last box, and the two column boxes), then
// walks on to a generated plan and measures every other side-by-side layout
// on the page (the Downloads cards, Your plan's columns, and any other row
// of side-by-side boxes it finds).  It lists every layout it checked, with
// its largest bottom difference, and exits 1 when any is not 0 px.  #490 C11
// / repair 1: in every state it also checks that no control or line on the
// aerial frame intersects Mapbox's logo or attribution, which the page draws
// on the frame.
//
// Run from the repo root.
//   Local (the site on :3000 against the stubbed backend, as
//   scripts/verify-generate-cls.mjs):
//     node scripts/verify-columns-end-together.mjs
//   The local backend with Overpass replayed (never live):
//     uv run --extra dev python scripts/verify-generate-cls-stub.py . "<fixture dir>;<fixture dir>" 8000
//     (validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture
//      and validation-artifacts/committed/ux-site-map/evidence/overpass-fixture)
// Env:
//   SITE    the site (default http://localhost:3000)
//   SIZES   "1024x768,1198x930,1440x900" (default): Ryan's three
//           two-column widths.  Add 390x844 for the phone (one column, so
//           its columns are not compared, but its frame's marks are): it
//           passes at 100% text; at 200% the tap question's failed bar fills
//           the 250 px frame and meets the logo (#490 rulings.md C14, a
//           known limit, so it is not in the default run)
//   ZOOMS   "1,2" (default): the text zoom factors.  2 is 200% text zoom.
//           Chromium has no text-only zoom (its font-size setting skips px
//           sizes, and page zoom shrinks the layout instead), so it is
//           emulated: every font-size in the page's stylesheets is wrapped
//           in calc(2 * (...)) (em and % sizes are left alone, as they
//           follow their parent's), and so is every px line-height.  The
//           layout's widths and heights stay as written, as with a
//           browser's text-only zoom.
//   OUT     a folder for the JSON of every reading and a crop per state
//           (optional; nothing is written without it)
//   ONLY    run only these phases (comma-separated): states, long-name,
//           two-option-side, sides-unavailable, aerial-failed, results, what
//   STUB_ROAD  /api/road-bearing answered from the recorded Colfax fixture
//           (default 1; 0 on production).  The variants below need it.
// The variants (each a route on the page, never a backend change):
//   - a 3-line road name: the road answer's name replaced by LONG_NAME;
//   - the tap's failed and none-found lines: the cross street's lookup
//     answered 500 / with no cross street; found: with the recorded cross
//     street (#469's walk);
//   - the road's sides unavailable: /api/render/corridor-geometry 500;
//   - the side question: two options (the geometry's answer with the
//     other side added), in every phase since #507 picks a lone side for
//     you, so a one-option question never opens;
//   - the aerial's failure: /api/corridor-map 500 (a note on the frame).
// #517 ruling 8 (Ryan, 2026-11-11): "Add this section's states to the
// permanent checks: band and columns, 44 px, and axe."  The `what` phase
// (after the WHERE phases, which are unchanged) confirms the recorded road
// and walks the What section: first show, a guess checked (the box's rows
// must not move), a why tip open, the jurisdiction dropdown open, the
// measured row open, File details open, work dates set with times inside
// and outside the hours, and #227's windows table open.  In each: the
// section's side-by-side grids ("About the work", the measured row's and
// File details' panels) end together (0 px), every shown control in the
// What band is at least 44 px tall, and axe-core (the site's
// node_modules) finds 0 violations in the band.  Then WHERE is reopened
// and read as the other WHERE states (#469's band height).  The repo had
// no other permanent 44 px or axe script, so they live here.
// "0 px": the difference, rounded to the nearest whole px, is 0 (CHOSEN:
// a box's edge falls on sub-pixel positions; half a px is not a visible
// step at DPR 1).
// The gate header rides only the site's own origin (scripts/gate.cjs); no
// output carries the token.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { newGatedContext, gateHeaders, isSiteRequest, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = process.env.SITE ?? "http://localhost:3000";
const SIZES = (process.env.SIZES ?? "1024x768,1198x930,1440x900").split(",").map((s) => s.split("x").map(Number));
const ZOOMS = (process.env.ZOOMS ?? "1,2").split(",").map(Number);
const OUT = process.env.OUT ?? null;
const STUB_ROAD = (process.env.STUB_ROAD ?? "1") === "1";
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
if (OUT) fs.mkdirSync(OUT, { recursive: true });
// CHOSEN: long enough to wrap to three lines in the summary row at 1440
// (measured in the run's output, "road lines").
const LONG_NAME = "East Colfax Avenue Frontage Road and Business Route 40 Westbound Access";

// ── the recorded road (scripts/verify-generate-cls.mjs, #469's walk) ──────
const FIX = JSON.parse(
  fs.readFileSync(path.join(ROOT, "validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json"), "utf8"),
);
const CROSSING = { lat: 39.7400513, lng: -104.9684525 };
const rad = (d) => (d * Math.PI) / 180;
const brg = (a, b) => {
  const y = Math.sin(rad(b.lon - a.lon)) * Math.cos(rad(b.lat));
  const x = Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) - Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};
const distM = (a, at) => Math.hypot((a.lat - at.lat) * 111320, (a.lon - at.lng) * 111320 * Math.cos(rad(at.lat)));
const COLFAX_WEST = [1547338997, 1547338998, 223788857, 600545918, 791808880];
function chain(ids) {
  const out = [];
  for (const id of ids) {
    for (const n of FIX.elements.find((e) => e.type === "way" && e.id === id).geometry) {
      const l = out[out.length - 1];
      if (!l || l.lat !== n.lat || l.lon !== n.lon) out.push(n);
    }
  }
  return out;
}
function cand(id, at, ids = null, name = null) {
  const w = FIX.elements.find((e) => e.type === "way" && e.id === id);
  const g = ids ? chain(ids) : w.geometry;
  let i = 0;
  g.forEach((n, k) => { if (distM(n, at) < distM(g[i], at)) i = k; });
  const a = g[Math.max(0, Math.min(i, g.length - 2))], b = g[Math.max(1, Math.min(i + 1, g.length - 1))];
  const s = (k) => w.tags[k] ?? null;
  return {
    way_id: String(id), highway_class: w.tags.highway, name: name ?? w.tags.name, ref: s("ref"), bearing: +brg(a, b).toFixed(2),
    snap_distance_m: +distM(g[i], at).toFixed(2), snapped_lat: g[i].lat, snapped_lng: g[i].lon, signal_distance_m: null,
    tags: { oneway: s("oneway"), maxspeed: s("maxspeed"), lanes: s("lanes"), lanes_forward: s("lanes:forward"), lanes_backward: s("lanes:backward"),
      lanes_both_ways: s("lanes:both_ways"), turn_lanes: s("turn:lanes"), turn_lanes_forward: s("turn:lanes:forward"), turn_lanes_backward: s("turn:lanes:backward") },
    geometry: g.map((n) => [n.lat, n.lon]),
  };
}
const det = (cands) => JSON.stringify({ scan_status: "ok", primary_index: 0, isUrban: true, placeName: "Denver", candidates: cands });
// The pixel of a point on a picture drawn at zoom 17 centred on the pin, in
// the picture's own (drawn) px.
function pixelOf(pt, pin, w, h) {
  const scale = 512 * 2 ** 17;
  const m = (la, ln) => { const s = Math.sin(rad(la)); return [((ln + 180) / 360) * scale, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale]; };
  const [px, py] = m(pt.lat, pt.lng), [cx, cy] = m(pin.lat, pin.lng);
  return { x: px - cx + w / 2, y: py - cy + h / 2 };
}

// ── 200% text zoom, emulated (see the header) ─────────────────────────────
function textZoomInPage(f) {
  if (f === 1) return 0;
  window.__tz ??= new WeakSet();
  const relative = /(?<![r\w])em\b|%|\bex\b|\bch\b|^(inherit|initial|unset|revert|smaller|larger)$/;
  let n = 0;
  const walk = (rules) => {
    for (const r of rules) {
      if (r.style) {
        for (const prop of ["font-size", "line-height"]) {
          const v = r.style.getPropertyValue(prop).trim();
          if (!v || v.startsWith(`calc(${f} *`)) continue;
          if (prop === "font-size" && relative.test(v)) continue;
          if (prop === "line-height" && !/px/.test(v)) continue;
          r.style.setProperty(prop, `calc(${f} * (${v}))`, r.style.getPropertyPriority(prop));
          n++;
        }
      }
      if (r.cssRules) walk(r.cssRules);
    }
  };
  for (const s of document.styleSheets) {
    if (window.__tz.has(s)) continue;
    try { walk(s.cssRules); window.__tz.add(s); } catch { /* another origin's sheet */ }
  }
  return n;
}

// ── the readings ──────────────────────────────────────────────────────────
// WHERE: the aerial column and its frame against the right column and its
// last shown box.  Bottoms in page px.
function readWhere() {
  const q = (s) => document.querySelector(s);
  const shown = (e) => { if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const bx = (e) => { if (!shown(e)) return null; const r = e.getBoundingClientRect(); return { top: +(r.top + scrollY).toFixed(2), bottom: +(r.bottom + scrollY).toFixed(2), left: +r.left.toFixed(2), right: +r.right.toFixed(2), h: +r.height.toFixed(2) }; };
  const stack = q(".wq-stack");
  const aerial = q(".wq-stack > .a-aerial");
  const frame = q("[data-testid=band-aerial-frame]");
  const side = q(".wq-stack > .wq-side");
  const last = side ? [...side.children].filter(shown).pop() ?? null : null;
  // Repair 2: in two columns the aerial column box is display: contents, so
  // the left column is its frame.
  const f = bx(frame), s = bx(side), l = bx(last);
  const a = bx(aerial) ?? f;
  // The summary row's text is one inline span: one client rect per line.
  const road = q("[data-testid=where-summary-text]");
  const lineTops = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].filter((r) => r.height > 0).map((r) => Math.round(r.top))).size; };
  return {
    twoCol: !!(a && s && s.left >= a.right - 1),
    band: bx(q("[data-testid=band-where]")), stack: bx(stack), aerial: a, frame: f, side: s,
    last: l, lastIs: last ? (last.getAttribute("data-testid") ?? last.className) : null,
    roadLines: road && shown(road) ? lineTops(road) : null,
    attrs: stack ? { card: stack.getAttribute("data-card"), edit: stack.hasAttribute("data-edit"), tap: stack.hasAttribute("data-tap") } : null,
    lines: [...document.querySelectorAll("[data-testid=band-where] .wq-line, [data-testid=band-where] .a-aerial-note, [data-testid=cross-failed], [data-testid=cross-row]")]
      .filter(shown).map((e) => e.getAttribute("data-testid") ?? e.className.split(" ").pop()),
    q: (q("[data-testid=where-questions] .nyq-q")?.innerText ?? "").trim().slice(0, 40) || null,
    overlaps: marksOverlaps(frame),
    spills: bandSpills(),
    // Amendment 4: at 519 px and under the attribution line is under the
    // frame, in flow (so it overlaps nothing by construction).
    attribution: (() => {
      const on = q("[data-testid=band-aerial-frame] [data-testid=band-aerial-attribution]");
      const under = q("[data-testid=band-aerial-attribution-under]");
      return shown(on) ? "on the frame" : shown(under) ? "under the frame" : "none";
    })(),
  };
  // #490 C11 / repair 1: no control or line on the frame intersects Mapbox's
  // logo or attribution box (rounded to whole px, so touching edges pass).
  // Repair 2: every text-bearing element in the band ends at or above the
  // band's bottom (rounded to whole px).  The kind question's Details is a
  // tooltip that floats over the page by ruling (#469 B4b), so its box is
  // not counted.
  function bandSpills() {
    const band = q("[data-testid=band-where]");
    if (!band) return [];
    const bottom = Math.round(band.getBoundingClientRect().bottom);
    const out = [];
    const walker = document.createTreeWalker(band, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      if (!t.textContent.trim()) continue;
      const e = t.parentElement;
      if (!e || !shown(e) || e.closest(".nyq-details, .nyq-tip-box [role=tooltip]")) continue;
      const rg = document.createRange();
      rg.selectNodeContents(t);
      const rs = [...rg.getClientRects()].filter((r) => r.height > 0);
      if (!rs.length) continue;
      const end = Math.round(Math.max(...rs.map((r) => r.bottom)));
      if (end > bottom) out.push(`"${t.textContent.trim().slice(0, 30)}" +${end - bottom}px`);
    }
    return [...new Set(out)];
  }
  function marksOverlaps(f) {
    if (!f) return [];
    const marks = [...f.querySelectorAll("[data-testid=band-aerial-logo], [data-testid=band-aerial-attribution]")].filter(shown);
    const others = [...f.querySelectorAll("button, a, [role=status], .a-aerial-legend, .a-aerial-note, .a-aerial-held, .a-aerial-bar, .a-aerial-mark-label, .a-aerial-zoom")]
      .filter((e) => shown(e) && !marks.some((m) => m.contains(e) || e.contains(m)));
    const r = (e) => { const b = e.getBoundingClientRect(); return { l: Math.round(b.left), t: Math.round(b.top), r: Math.round(b.right), b: Math.round(b.bottom) }; };
    const out = [];
    for (const m of marks) for (const o of others) {
      const a = r(m), c = r(o);
      if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) out.push(`${o.getAttribute("data-testid") ?? o.className.split(" ")[0]} x ${m.getAttribute("data-testid")}`);
    }
    return [...new Set(out)];
  }
}
// Every row of side-by-side columns under `root`: an element with two or
// more shown children whose tops agree (±1 px), whose spans do not overlap,
// each at least 60 px tall and 120 px wide (CHOSEN: below that it is a row
// of controls or chips, not columns), at least one of them a box (its own
// border or background).  Its bottoms, and the bottoms of each child's last
// button, if every child ends in one.
function readRows(rootSel) {
  const root = document.querySelector(rootSel);
  if (!root) return [];
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const isBox = (e) => {
    const cs = getComputedStyle(e);
    const border = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && cs[`border${s}Style`] !== "none");
    const bg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent";
    return border || bg || cs.backgroundImage !== "none";
  };
  const name = (e) => {
    const id = e.getAttribute("data-testid") ?? e.id;
    if (id) return `${e.tagName.toLowerCase()}[${id}]`;
    return `${e.tagName.toLowerCase()}${e.classList.length ? "." + [...e.classList].slice(0, 2).join(".") : ""}`;
  };
  const pathOf = (e) => { const out = []; for (let x = e; x && x !== document.body && out.length < 4; x = x.parentElement) out.unshift(name(x)); return out.join(" > "); };
  const found = [];
  for (const e of [root, ...root.querySelectorAll("*")]) {
    const kids = [...e.children].filter(shown);
    if (kids.length < 2) continue;
    const rs = kids.map((k) => k.getBoundingClientRect());
    // Group the children into rows by their top.
    const rows = [];
    kids.forEach((k, i) => {
      const row = rows.find((g) => Math.abs(g.top - rs[i].top) <= 1);
      if (row) row.items.push(i); else rows.push({ top: rs[i].top, items: [i] });
    });
    for (const row of rows) {
      if (row.items.length < 2) continue;
      const items = row.items.sort((a, b) => rs[a].left - rs[b].left);
      const apart = items.every((i, k) => k === 0 || rs[i].left >= rs[items[k - 1]].right - 1);
      if (!apart || !items.some((i) => isBox(kids[i]))) continue;
      // Tiny chips are not columns (a row of 44 px buttons is a control row).
      if (items.some((i) => rs[i].height < 60 || rs[i].width < 120)) continue;
      const bottoms = items.map((i) => +(rs[i].bottom + scrollY).toFixed(2));
      const lastBtn = items.map((i) => {
        const bs = [...kids[i].querySelectorAll("button, a.a-pri, a[role=button], a[download]")].filter(shown);
        const b = bs.pop();
        return b ? +(b.getBoundingClientRect().bottom + scrollY).toFixed(2) : null;
      });
      found.push({
        layout: pathOf(e), columns: items.map((i) => name(kids[i])),
        bottoms, diff: +(Math.max(...bottoms) - Math.min(...bottoms)).toFixed(2),
        buttons: lastBtn.every((v) => v !== null) ? lastBtn : null,
        buttonDiff: lastBtn.every((v) => v !== null) ? +(Math.max(...lastBtn) - Math.min(...lastBtn)).toFixed(2) : null,
      });
    }
  }
  return found;
}

// #517: the What section.  Each two-column grid's column ends, every
// shown control's height, and the box's rows (for "nothing moved").
//
// #520 (Ryan, 2026-11-11: "The columns check has to measure where each
// column's content actually ends, not the grid boxes"): a grid's boxes
// stretch to the row's height, so their bottoms always agree.  A column's
// end here is where its content ends: the lowest bottom of any shown,
// in-flow element inside the column's last cell (a floating tip or popup
// is a layer over the page, not column content).  The cells are found by
// class (`.a-cell`) under the grid, either straight under it or under a
// `.a-col` stack, and put in a column by their left edge; a cell that spans
// the grid's width ends every column it spans.  The last cell's own box
// bottom is reported beside it (`cellDiff`); the verdict reads `diff`.
function readWhat() {
  const band = document.querySelector("[data-testid=band-what]");
  if (!band) return null;
  const shown = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none"; };
  const floats = (e, stop) => { for (let x = e; x && x !== stop; x = x.parentElement) { const p = getComputedStyle(x).position; if (p === "absolute" || p === "fixed") return true; } return false; };
  const contentEnd = (cell) => {
    let end = -Infinity;
    for (const d of cell.querySelectorAll("*")) {
      if (!shown(d) || floats(d, cell)) continue;
      end = Math.max(end, d.getBoundingClientRect().bottom);
    }
    return end === -Infinity ? cell.getBoundingClientRect().bottom : end;
  };
  const grids = [];
  for (const [k, sec] of [["about", "[data-testid=what-about]"], ["measured", "[data-testid=what-measured-panel]"], ["files", "[data-testid=what-files-panel]"]]) {
    const host = band.querySelector(sec);
    if (!host || !shown(host)) continue;
    const g = host.querySelector(".w-grid, .w-cols");
    // A shown section with no grid is a FAIL, never a silent pass.
    if (!g || !shown(g)) { grids.push({ grid: k, twoCol: true, missing: true, diff: NaN, cellDiff: NaN }); continue; }
    const cells = [...g.querySelectorAll(":scope > .a-cell, :scope > .a-col > .a-cell")].filter(shown)
      .map((c) => ({ c, r: c.getBoundingClientRect() }));
    const lefts = [...new Set(cells.map(({ r }) => Math.round(r.left)))].sort((a, b) => a - b);
    const gr = g.getBoundingClientRect();
    const twoCol = lefts.length >= 2;
    if (!twoCol) { grids.push({ grid: k, twoCol, diff: null, cellDiff: null }); continue; }
    // Each column: its left edge to the next one's (the last to the grid's right).
    const cols = lefts.map((l, i) => ({ l, r: i + 1 < lefts.length ? lefts[i + 1] - 1 : gr.right }));
    const ends = cols.map(({ l, r }) => {
      const mine = cells.filter(({ r: b }) => b.left < r && b.right > l + 1);
      const last = mine.reduce((a, b) => (b.r.bottom > a.r.bottom ? b : a));
      return { cell: last.c.getAttribute("data-testid"), box: last.r.bottom, content: contentEnd(last.c) };
    });
    const spread = (v) => +(Math.max(...v) - Math.min(...v)).toFixed(2);
    grids.push({
      grid: k, twoCol, columns: ends.length,
      lastCells: ends.map((e) => e.cell),
      ends: ends.map((e) => +(e.content + scrollY).toFixed(2)),
      diff: spread(ends.map((e) => e.content)),
      cellDiff: spread(ends.map((e) => e.box)),
    });
  }
  const ctl = [...band.querySelectorAll("button, a[href], input, select, textarea, summary, [role=option], [role=radio], [role=button], [role=checkbox]")].filter(shown);
  const name = (e) => (e.getAttribute("aria-label") || e.innerText || e.className || e.tagName).toString().replace(/\s+/g, " ").trim().slice(0, 30);
  const under = ctl.filter((e) => e.getBoundingClientRect().height < 44).map((e) => `${name(e)} ${Math.round(e.getBoundingClientRect().height * 100) / 100}px`);
  const rows = [...band.querySelectorAll("[data-testid=what-guesses] .a-cell")].map((e) => ({ id: e.getAttribute("data-testid"), top: +(e.getBoundingClientRect().top + scrollY).toFixed(2) }));
  return { grids, controls: ctl.length, under, rows, head: document.querySelector("[data-testid=what-guesses-head]")?.innerText ?? null, bandH: +band.getBoundingClientRect().height.toFixed(2) };
}
const AXE_SRC = (() => { try { return fs.readFileSync(path.join(ROOT, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8"); } catch { return null; } })();

async function one(w, h, zoom) {
  const tag = `${w}x${h}${zoom !== 1 ? `@text${zoom * 100}` : ""}`;
  const b = await chromium.launch();
  const steps = [];
  const rows = [];
  const errors = [];
  const whatSteps = [];
  // #507 (R145-4): a lone offered side is now picked for you, so the side
  // question never opens on the recorded one-carriageway road.  Every phase
  // walks with the two-side answer (the mirrored side below) so the side
  // states stay reachable; "all" replays the backend's answer as is.
  const mode = { name: null, cross: "off", geom: "real", sides: "two", map: "real", hold: 0 };
  let outline = null;
  // Each phase on a fresh context (no plan carried over in storage).
  let ctx = null;
  let p = null;
  const open = async () => {
    if (ctx) await ctx.close().catch(() => {});
    ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p = await ctx.newPage();
    p.on("pageerror", (e) => errors.push(oneLine(e).slice(0, 160)));
    if (STUB_ROAD) {
      await p.route("**/api/road-bearing**", (r) => {
        const asked = JSON.parse(r.request().postData() ?? "null");
        if (mode.cross === "fail") return r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"check: forced failure"}' });
        const at = mode.cross === "found" ? CROSSING : { lat: asked.lat, lng: asked.lng };
        const cands = [cand(1547338997, at, COLFAX_WEST, mode.name)];
        if (mode.cross === "found") cands.push(cand(492215711, CROSSING));
        return r.fulfill({ status: 200, contentType: "application/json", body: det(cands) });
      });
    }
    await p.route("**/api/render/corridor-geometry**", async (r) => {
      if (mode.geom === "fail") return r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"check: forced failure"}' });
      if (mode.sides !== "two") return r.fallback();
      try {
        // This route carries the gate header itself (as verify-generate-cls's
        // audit hold does): only to the site's own origin.
        const own = isSiteRequest(r.request().url(), SITE) ? gateHeaders(SITE) : {};
        const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
        const body = await resp.json();
        // The recorded road is one-way here, so its own answer has one side;
        // the variant adds the other, mirrored (layout content only).
        const o = Array.isArray(body.side_options) ? body.side_options : [];
        if (o.length === 1) {
          const other = o[0].work?.side === "right" ? "left" : "right";
          o.push({ ...o[0], work: { ...o[0].work, side: other }, label: "South side · eastbound traffic" });
        }
        return r.fulfill({ status: resp.status(), contentType: "application/json", body: JSON.stringify(body) });
      } catch { return r.abort().catch(() => {}); }
    });
    await p.route("**/api/corridor-map**", (r) => (mode.map === "fail" ? r.fulfill({ status: 500, body: "check: forced failure" }) : r.fallback()));
    // Repair 2: the audit held (as verify-generate-cls.mjs holds it) so the
    // Generate outline stays on screen to be read and cropped.
    await p.route("**/api/render/audit", async (r) => {
      if (!mode.hold) return r.fallback();
      try {
        const own = isSiteRequest(r.request().url(), SITE) ? gateHeaders(SITE) : {};
        const resp = await r.fetch({ headers: { ...r.request().headers(), ...own } });
        const body = await resp.body();
        await new Promise((res) => setTimeout(res, mode.hold));
        return await r.fulfill({ status: resp.status(), headers: resp.headers(), body });
      } catch {
        await r.abort().catch(() => {});
      }
    });
  };
  const phase = async (name, fn) => {
    if (ONLY && !ONLY.has(name)) return;
    try {
      await open();
      await fn();
    } catch (e) {
      errors.push(`${name}: ${oneLine(e).slice(0, 200)}`);
      if (OUT) await p?.screenshot({ path: path.join(OUT, `${tag}-${name}-error.png`) }).catch(() => {});
    } finally {
      Object.assign(mode, { name: null, cross: "off", geom: "real", sides: "two", map: "real", hold: 0 });
    }
  };
  try {
    const zoomNow = () => p.evaluate(textZoomInPage, zoom);
    let n = 1;
    const step = async (name, wait = 1200) => {
      await p.waitForTimeout(wait);
      await zoomNow();
      await p.waitForTimeout(300);
      const s = { name, ...(await p.evaluate(readWhere)) };
      s.frameDiff = s.frame && s.last ? Math.round(Math.abs(s.frame.bottom - s.last.bottom)) : null;
      s.colDiff = s.aerial && s.side ? Math.round(Math.abs(s.aerial.bottom - s.side.bottom)) : null;
      steps.push(s);
      if (OUT) {
        s.shot = `${tag}-${String(n++).padStart(2, "0")}-${name}.png`;
        await p.locator("[data-testid=band-where]").screenshot({ path: path.join(OUT, s.shot) }).catch(() => {});
      }
      const ok = (!s.twoCol || (s.frameDiff === 0 && s.colDiff === 0)) && s.overlaps.length === 0 && s.spills.length === 0;
      const verdict = s.overlaps.length || s.spills.length ? "FAIL" : s.twoCol ? (ok ? "PASS" : "FAIL") : "ONE COLUMN";
      console.log(`${tag} ${name.padEnd(26)} ${verdict} | frame↔last ${s.frameDiff ?? "-"} px | column↔column ${s.colDiff ?? "-"} px | marks overlaps ${s.overlaps.length ? s.overlaps.join(", ") : "0"} (attribution ${s.attribution}) | past the band ${s.spills.length ? s.spills.join(", ") : "0"} | band ${s.band?.h ?? "-"} | last ${s.lastIs} | lines ${s.lines.join(",") || "-"}${s.roadLines ? ` | road lines ${s.roadLines}` : ""}`);
      return s;
    };
    const pick = (testid) => p.locator(`label.nyq-answer:has([data-testid=${testid}])`).first().click();
    const nextBtn = () => p.locator("[data-testid=where-questions] .nyq-card .nyq-foot > button:last-child").click();
    const details = () => p.locator("[data-testid=where-questions] .nyq-details-btn").first().click();
    const search = async (addr) => {
      await p.waitForTimeout(1500);
      await p.getByLabel("Address or intersection search").fill(addr);
      // #489: in Move the picker opens with the old road picked, so Save &
      // Close is enabled before this search's road answer exists; wait for
      // that answer first (a stubbed answer emits a response too).
      const roads = p.waitForResponse((r) => r.url().includes("/api/road-bearing"), { timeout: 90000 });
      await p.getByRole("button", { name: "SEARCH" }).click();
      await roads;
      await p.waitForFunction(() => {
        const d = document.querySelector("[role=dialog]");
        const save = [...(d?.querySelectorAll("button") ?? [])].find((x) => /Save (&|and) [Cc]lose/.test(x.innerText));
        return /PICK THE ROAD · \d+ FOUND|Which road/i.test(d?.innerText ?? "") || (save && !save.disabled);
      }, null, { timeout: 90000 });
      await p.waitForTimeout(1500);
      const want = p.getByRole("dialog").getByRole("radio", { name: /Colfax/ });
      if (await want.count()) {
        await want.first().click();
        await p.waitForFunction(() => [...document.querySelectorAll("[role=dialog] button")].some((x) => /Save (&|and) [Cc]lose/.test(x.innerText) && !x.disabled), null, { timeout: 5000 })
          .catch(() => { throw new Error(`search ${addr}: the Colfax road row was clicked but Save & Close stayed disabled`); });
      }
      await p.waitForTimeout(2000);
      await p.getByRole("button", { name: /Save (&|and) [Cc]lose/ }).click();
      await p.waitForSelector("[role=dialog]", { state: "detached", timeout: 30000 }).catch(() => {});
    };
    const pin = async (addr = "1550 E Colfax Ave, Denver") => {
      await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
      await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
      await zoomNow();
      await p.getByRole("button", { name: "Pick on map" }).click();
      await search(addr);
      await p.waitForSelector("[data-testid^=kind-chip-]", { state: "attached", timeout: 60000 });
      await p.waitForSelector("[data-testid=band-aerial-img]", { timeout: 60000 }).catch(() => {});
      await p.waitForTimeout(2500);
    };
    // A tap on the aerial at the recorded crossing.  The picture is drawn at
    // the canvas's layout size and may be scaled to cover its frame, so the
    // drawn px is scaled by the picture's on-screen size.
    const tapCrossing = async (how) => {
      mode.cross = how;
      const img = p.locator("[data-testid=band-aerial-img]");
      await img.scrollIntoViewIfNeeded();
      const box = await img.boundingBox();
      const drawn = await img.evaluate((e) => { const c = e.closest(".a-aerial-canvas"); return { w: c.clientWidth, h: c.clientHeight }; });
      const at = pixelOf(CROSSING, { lat: 39.739781, lng: -104.968249 }, drawn.w, drawn.h);
      await p.mouse.click(box.x + at.x * (box.width / drawn.w), box.y + at.y * (box.height / drawn.h));
      await p.waitForTimeout(3500);
      mode.cross = "off";
    };

    // ── the recorded road, every state ──
    await phase("states", async () => {
    await pin();
    await step("kind-question");
    for (const r of await p.evaluate(readRows, "body")) rows.push({ ...r, at: "WHERE open" });
    await details();
    await step("kind-details-open", 800);
    await details();
    await pick("kind-chip-near_intersection");
    await step("kind-near-intersection", 2500);
    await nextBtn();
    await p.waitForSelector("[data-testid=band-aerial-bar]", { timeout: 30000 }).catch(() => {});
    await step("tap-question", 1500);
    await tapCrossing("fail");
    await step("tap-failed", 300);
    await tapCrossing("none");
    await step("tap-none", 300);
    await tapCrossing("found");
    await step("tap-found", 300);
    await p.locator("[data-testid=cross-undo]").click().catch(() => {});
    await step("tap-undone", 2000);
    await tapCrossing("found");
    await nextBtn();
    await step("side-question", 2500);
    await pick("side-option");
    await step("side-answered", 2500);
    await p.locator(".nyq-answered .nyq-row-btn", { hasText: /kind of work/ }).first().click().catch(() => {});
    await step("kind-reopened", 1500);
    await pick("kind-chip-shoulder");
    await step("kind-changed", 2500);
    await p.locator("[data-testid=step-undo-side]").click().catch(() => {});
    await step("side-undone", 2500);
    await pick("side-option");
    await step("side-again", 2500);
    await p.locator("[data-testid=where-edit]").click();
    await step("edit-panel", 1200);
    await p.locator("#band-worklen").fill("600");
    await p.locator("#band-worklen").press("Enter");
    await step("edit-length-typed", 1200);
    await p.locator("[data-testid=where-edit-cancel]").click();
    await step("edit-cancelled", 1200);
    await p.locator("[data-testid=where-edit]").click();
    await p.locator("[data-testid=move-action-start]").click();
    await search("1600 E Colfax Ave, Denver");
    await step("edit-moved", 2500);
    await p.locator("[data-testid=where-edit-done]").click();
    await step("edit-done-side-reasked", 2000);
    await pick("side-option");
    await step("side-answered-after-move", 2500);
    await p.locator("[data-testid=where-confirm]").click();
    await p.waitForSelector("[data-testid=cell-work-type]", { timeout: 90000 }).catch(() => {});
    await p.waitForTimeout(2500);
    await zoomNow();
    for (const r of await p.evaluate(readRows, "body")) rows.push({ ...r, at: "WHAT open" });
    await p.locator("[data-testid=fact-link-where]").click().catch(() => {});
    await step("reopened-after-confirm", 1500);
    await p.locator("[data-testid=where-edit]").click().catch(() => {});
    await step("edit-after-confirm", 1200);
    await p.locator("[data-testid=where-edit-cancel]").click().catch(() => {});
    await step("cancelled-after-confirm", 1200);
    });

    // ── the variants ──
    // A 3-line road name.
    await phase("long-name", async () => {
      mode.name = LONG_NAME;
      await pin();
      await step("long-name-kind-question");
      await pick("kind-chip-near_intersection");
      await step("long-name-kind-near-intersection", 2500);
      await pick("kind-chip-shoulder");
      await nextBtn();
      await step("long-name-side-question", 2500);
      await pick("side-option");
      await step("long-name-side-answered", 2500);
      await p.locator("[data-testid=where-edit]").click();
      await step("long-name-edit-panel", 1200);
    });
    // The two-option side on its own (every phase has it since #507).
    await phase("two-option-side", async () => {
      mode.sides = "two";
      await pin();
      await pick("kind-chip-shoulder");
      await nextBtn();
      await step("two-option-side", 3000);
    });
    // The road's sides unavailable (the geometry fails).
    await phase("sides-unavailable", async () => {
      mode.geom = "fail";
      await pin();
      await pick("kind-chip-shoulder").catch(() => {});
      await nextBtn().catch(() => {});
      await step("sides-unavailable", 3000);
    });
    // The aerial's failure (a note on the frame; the card as before).
    await phase("aerial-failed", async () => {
      mode.map = "fail";
      await pin();
      await step("aerial-failed", 2000);
    });

    // ── the rest of the tool page, after a Generate ──
    await phase("results", async () => {
      // Walked as scripts/verify-generate-cls.mjs does.
      await pin("1600 E Colfax Ave, Denver");
      await pick("kind-chip-shoulder");
      await p.waitForTimeout(1200);
      await nextBtn();
      await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 });
      await p.waitForTimeout(1200);
      await pick("side-option");
      await p.waitForTimeout(1500);
      await p.locator("[data-testid=where-confirm]").click();
      await p.waitForSelector("[data-testid=cell-work-type]", { timeout: 90000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const oneWay = p.getByRole("button", { name: /^One-way$/ });
      if (await oneWay.count()) { await oneWay.first().click(); await p.waitForTimeout(2500); }
      const laneOk = p.getByRole("button", { name: "Lane count is right" });
      if (await laneOk.count()) { await laneOk.first().click(); await p.waitForTimeout(2500); }
      await p.waitForFunction(() => { const g = document.querySelector("[data-testid=generate-plan]"); return g && !g.disabled; }, null, { timeout: 120000 });
      mode.hold = 4000;
      await p.getByTestId("generate-plan").click();
      // The outline's map placeholder, while the call is held: Mapbox's marks
      // on it (C13), read and cropped.
      await p.waitForSelector("[data-testid=results-outline] .ro-map", { timeout: 30000 }).catch(() => {});
      await p.waitForTimeout(1200);
      await zoomNow();
      outline = await p.evaluate(() => {
        const m = document.querySelector("[data-testid=results-outline] .ro-map");
        return m ? { marks: !!m.querySelector("[data-testid=ro-map-marks]"), text: m.querySelector("[data-testid=ro-map-attribution]")?.textContent ?? "" } : null;
      });
      if (outline && OUT) {
        outline.shot = `${tag}-generate-outline-map.png`;
        await p.locator("[data-testid=results-outline] .ro-map").screenshot({ path: path.join(OUT, outline.shot) }).catch(() => { outline.shot = null; });
      }
      await p.waitForFunction(() => {
        const s = document.querySelector(".status-slot")?.innerText ?? "";
        return /Plan ready|VERIFIED|UNAVAILABLE|DECLINED/i.test(s) && !document.querySelector("[data-testid=results-outline]") && document.querySelector(".ref-sections");
      }, null, { timeout: 240000 });
      await p.waitForTimeout(3000);
      await zoomNow();
      await p.waitForTimeout(500);
      for (const r of await p.evaluate(readRows, "body")) rows.push({ ...r, at: "results" });
      if (OUT) await p.screenshot({ path: path.join(OUT, `${tag}-results.png`), fullPage: true }).catch(() => {});
    });

    // ── #517: the What section's states ──
    await phase("what", async () => {
      const W = "[data-testid=band-what]";
      const settled = () => p.waitForFunction((sel) => {
        const t = document.querySelector(sel)?.innerText ?? "";
        return t && !/Checking|checking your dates|◌ loading/.test(t);
      }, W, { timeout: 90000 }).catch(() => {});
      const whatStep = async (name, wait = 800) => {
        await p.waitForTimeout(wait);
        await zoomNow();
        await p.waitForTimeout(300);
        if (AXE_SRC && !(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE_SRC });
        const axe = AXE_SRC
          ? await p.evaluate(async (sel) => (await window.axe.run({ include: [[sel]] }, { resultTypes: ["violations"] })).violations.map((v) => `${v.id}(${v.nodes.length}): ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`), W)
          : ["axe-core not found"];
        const s = { name, ...(await p.evaluate(readWhat)), axe };
        whatSteps.push(s);
        if (OUT) {
          s.shot = `${tag}-what-${name}.png`;
          await p.locator(W).screenshot({ path: path.join(OUT, s.shot) }).catch(() => {});
        }
        const cols = s.grids.filter((g) => g.twoCol);
        s.ok = cols.every((g) => Math.round(g.diff) === 0) && s.under.length === 0 && s.axe.length === 0;
        console.log(`${tag} what ${name.padEnd(22)} ${s.ok ? "PASS" : "FAIL"} | columns ${cols.length ? cols.map((g) => (g.missing ? `${g.grid} GRID MISSING` : `${g.grid} content ${g.diff} px (last cells ${g.lastCells.join("/")}, boxes ${g.cellDiff} px)`)).join(", ") : "one column"} | 44 px: ${s.controls} controls, ${s.under.length} under${s.under.length ? ` (${s.under.join(", ")})` : ""} | axe ${s.axe.length}${s.axe.length ? ` (${s.axe.join("; ")})` : ""} | band ${s.bandH}${s.head ? ` | box "${s.head}"` : ""}`);
        return s;
      };
      const lb = async (id, value) => {
        await p.locator(`#${id}`).click();
        await p.waitForSelector("[role=listbox]", { timeout: 5000 });
        await p.locator(`[role=listbox] [role=option][data-value="${value}"]`).click();
        await p.waitForTimeout(1200);
      };
      await pin();
      await pick("kind-chip-shoulder");
      await p.waitForTimeout(1200);
      await nextBtn();
      await p.waitForSelector("[data-testid=side-option]", { state: "attached", timeout: 30000 });
      await p.waitForTimeout(1200);
      await pick("side-option");
      await p.waitForTimeout(1500);
      await p.locator("[data-testid=where-confirm]").click();
      await p.waitForSelector(W, { timeout: 90000 });
      await settled();
      await p.locator(W).scrollIntoViewIfNeeded();
      const first = await whatStep("first-show", 1500);
      await p.getByTestId("info-toggle-road-type").click().catch(() => p.getByTestId("info-toggle-speed").click());
      await whatStep("tip-open", 500);
      await p.keyboard.press("Escape");
      await p.locator("#what-jurisdiction").click();
      await p.waitForSelector("[role=listbox]", { timeout: 5000 });
      await whatStep("dropdown-open", 500);
      await p.keyboard.press("Escape");
      // A guess checked: the street class picked (P1: nothing moves).
      if (await p.locator("[data-testid=what-guesses] #what-street-class").count()) {
        await lb("what-street-class", "collector");
        await settled();
        const s = await whatStep("guess-checked");
        const moved = first.rows.filter((r, i) => !s.rows[i] || Math.round(s.rows[i].top - r.top) !== 0);
        if (moved.length) { s.ok = false; console.log(`${tag} what guess-checked FAIL | rows moved: ${moved.map((r) => r.id).join(", ")}`); }
      } else console.log(`${tag} what guess-checked skipped: no street class guess at this pin`);
      // The measured row the other way from its first show (it starts open
      // when a field inside needs the operator now, #517 S19).
      await p.getByTestId("what-measured-toggle").click();
      const mOpen = (await p.getByTestId("what-measured-toggle").getAttribute("aria-expanded")) === "true";
      await whatStep(mOpen ? "measured-open" : "measured-closed");
      await p.getByTestId("what-measured-toggle").click();
      await p.getByTestId("what-files-toggle").click();
      await whatStep("files-open");
      await p.getByTestId("what-files-toggle").click();
      // Work dates Mon Nov 16 to Fri Nov 20 2026, then the hours.
      await p.locator("#what-date").click();
      await p.waitForSelector("[data-testid=date-picker]");
      await whatStep("date-picker-open", 400);
      await p.locator("[data-testid=date-picker] [data-date='2026-11-16']").click();
      await p.waitForTimeout(400);
      await p.locator("[data-testid=date-picker] [data-date='2026-11-20']").click();
      await p.waitForTimeout(400);
      if (await p.locator("[data-testid=date-picker]").count()) await p.keyboard.press("Escape");
      await lb("sched-start", "9");
      await lb("sched-end", "15");
      await settled();
      await whatStep("dates-inside");
      const all = p.getByTestId("what-hours-all");
      if (await all.count()) {
        await all.click();
        await whatStep("hours-all-open");
        await all.click();
      }
      await lb("sched-start", "7");
      await lb("sched-end", "17");
      await settled();
      await whatStep("dates-outside");
      // #469: WHERE reopened after the What changes, read as the others.
      await p.locator("[data-testid=fact-link-where]").click().catch(() => {});
      await step("reopened-after-what", 1500);
    });
  } catch (e) {
    errors.push(`walk: ${oneLine(e).slice(0, 220)}`);
  } finally {
    await b.close();
  }
  return { tag, steps, rows, errors, outline, whatSteps };
}

const all = [];
let failed = false;
for (const [w, h] of SIZES) {
  for (const z of ZOOMS) {
    const r = await one(w, h, z);
    all.push(r);
    if (r.errors.length) { failed = true; console.log(`${r.tag} ERRORS ${r.errors.join(" | ")}`); }
    for (const s of r.steps) if ((s.twoCol && (s.frameDiff !== 0 || s.colDiff !== 0)) || s.overlaps.length || s.spills.length) failed = true;
    if (!r.steps.some((s) => s.twoCol)) console.log(`${r.tag} WHERE never in two columns at this size`);
    if (r.outline && !r.outline.marks) failed = true;
    if (r.whatSteps.some((s) => !s.ok)) failed = true;
    for (const row of r.rows) {
      const ok = Math.round(row.diff) === 0 && (row.buttonDiff === null || Math.round(row.buttonDiff) === 0);
      if (!ok) failed = true;
      console.log(`${r.tag} ${row.at} ${ok ? "PASS" : "FAIL"} | ${row.layout} | ${row.columns.length} columns (${row.columns.join(", ")}) | bottoms ${row.diff} px | last buttons ${row.buttonDiff ?? "n/a"} px`);
    }
  }
}
// The list of every layout checked, with its largest difference.
console.log("\nLayouts checked (largest bottom difference, px):");
const where = all.flatMap((r) => r.steps.filter((s) => s.twoCol).map((s) => Math.max(s.frameDiff ?? 0, s.colDiff ?? 0)));
const whereStates = new Set(all.flatMap((r) => r.steps.filter((s) => s.twoCol).map((s) => s.name)));
console.log(`  WHERE band: aerial ↔ right column, ${whereStates.size} states x ${all.filter((r) => r.steps.some((s) => s.twoCol)).length} two-column size/zoom runs: max ${where.length ? Math.max(...where) : "n/a"}`);
const ov = all.flatMap((r) => r.steps);
console.log(`  WHERE frame: controls and lines against Mapbox's logo and attribution, ${ov.length} readings (${all.length} size/zoom runs): ${ov.filter((s) => s.overlaps.length).length} with an overlap`);
console.log(`  WHERE band: every text-bearing element against the band's bottom, ${ov.length} readings: ${ov.filter((s) => s.spills.length).length} past it`);
for (const r of all) if (r.outline) console.log(`  Generate outline map placeholder (${r.tag}): marks ${r.outline.marks ? "drawn" : "MISSING"}, attribution "${r.outline.text}"${r.outline.shot ? `, crop ${r.outline.shot}` : ""}`);
const byLayout = new Map();
for (const r of all) for (const row of r.rows) {
  const k = `${row.layout} (${row.columns.join(", ")})`;
  const v = Math.max(row.diff, row.buttonDiff ?? 0);
  byLayout.set(k, { max: Math.max(byLayout.get(k)?.max ?? 0, v), runs: (byLayout.get(k)?.runs ?? 0) + 1 });
}
for (const [k, v] of byLayout) console.log(`  ${k}: ${v.runs} runs, max ${+v.max.toFixed(2)}`);
const ws = all.flatMap((r) => r.whatSteps);
if (ws.length) {
  const gd = ws.flatMap((s) => s.grids.filter((g) => g.twoCol).map((g) => g.diff));
  console.log(`  WHAT section (#517): ${new Set(ws.map((s) => s.name)).size} states x ${all.filter((r) => r.whatSteps.length).length} size/zoom runs, ${ws.length} readings: two-column grids, where each column's content ends (#520), max ${gd.length ? Math.max(...gd) : "n/a"} px; controls under 44 px in ${ws.filter((s) => s.under.length).length} readings; axe violations in ${ws.filter((s) => s.axe.length).length} readings`);
}
if (OUT) fs.writeFileSync(path.join(OUT, "readings.json"), JSON.stringify(all, null, 1));
console.log(failed ? "\nRESULT FAIL" : "\nRESULT PASS");
process.exit(failed ? 1 : 0);
