// s2-audit-1 — shared helpers for the design-audit walk (no product code).
// Loaded by audit-walk.js.  Playwright + axe-core resolved by absolute
// path from the main checkout (the worktree carries no node_modules).
const fs = require("fs"), path = require("path");
const ROOT = "C:/Users/rtmak/Documents/traffic-control-tool";
const { chromium } = require(ROOT + "/node_modules/playwright");
const AXE_SRC = fs.readFileSync(ROOT + "/conestruct/site/node_modules/axe-core/axe.min.js", "utf-8");
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";

function mkLog(OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };
  // A measurement row: surface · principle · verdict · what · where · measure · shot
  const rec = (r) => { rows.push(r); log(`[${r.vp}] ${r.surface} · ${r.p} · ${r.verdict}${r.what ? " — " + r.what : ""}${r.measure ? " | " + r.measure : ""}${r.shot ? " | " + r.shot : ""}`); };
  const flush = () => fs.writeFileSync(path.join(OUT, "rows.json"), JSON.stringify(rows, null, 1));
  return { log, rec, flush, rows };
}

async function shaGate(log, expect) {
  const hz = await (await fetch(HEALTHZ)).json();
  log(`healthz sha ${hz.sha} expect ${expect}`);
  if (hz.sha !== expect) { log("SHA GATE FAILED"); process.exit(2); }
  return hz.sha;
}

// ── in-page probes (serialised into page.evaluate) ──
// rect of one selector (document coords + viewport coords)
const RECT = (sel, i = 0) => {
  const el = typeof sel === "string" ? document.querySelectorAll(sel)[i] : sel; if (!el) return null;
  const b = el.getBoundingClientRect();
  return { top: Math.round(b.top + scrollY), left: Math.round(b.left), right: Math.round(b.right), bottom: Math.round(b.bottom + scrollY), w: Math.round(b.width), h: Math.round(b.height), vtop: Math.round(b.top), vbottom: Math.round(b.bottom), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100) };
};
// rects of every match of a list of selectors: {sel: [rect…]}
const RECTS = (sels) => {
  const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), left: Math.round(b.left), right: Math.round(b.right), bottom: Math.round(b.bottom + scrollY), w: Math.round(b.width), h: Math.round(b.height), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 60) }; };
  const out = {}; for (const s of sels) out[s] = Array.from(document.querySelectorAll(s)).map(r); out.__docH = document.documentElement.scrollHeight; out.__scrollY = Math.round(scrollY); return out;
};
// contrast of text nodes under a root selector: [{sel, text, fg, bg, ratio, size, weight}]
const PAIRS = (rootSel) => {
  const lum = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const parse = (rgb) => { const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return null; return { r: +m[0], g: +m[1], b: +m[2], a: m[3] === undefined ? 1 : +m[3] }; };
  const hex = (c) => "#" + [c.r, c.g, c.b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");
  const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100; };
  const effBg = (el) => { const layers = []; let e = el; while (e) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.unshift(c); if (c.a >= 1) break; } e = e.parentElement; } let out = { r: 255, g: 255, b: 255 }; for (const l of layers) out = { r: l.r * l.a + out.r * (1 - l.a), g: l.g * l.a + out.g * (1 - l.a), b: l.b * l.a + out.b * (1 - l.a) }; return hex(out); };
  const effOpacity = (el) => { let o = 1; let e = el; while (e) { o *= parseFloat(getComputedStyle(e).opacity); e = e.parentElement; } return o; };
  const root = document.querySelector(rootSel); if (!root) return [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const out = []; const seen = new Set(); let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden") continue;
    const fgc = parse(cs.color); if (!fgc) continue;
    const bg = effBg(el); const op = effOpacity(el);
    // composite the ink over the background at the effective opacity
    const bgc = parse(bg.replace(/^#(..)(..)(..)$/, (_, r, g, b) => `rgb(${parseInt(r, 16)},${parseInt(g, 16)},${parseInt(b, 16)})`));
    const a = fgc.a * op; const fg = hex({ r: fgc.r * a + bgc.r * (1 - a), g: fgc.g * a + bgc.g * (1 - a), b: fgc.b * a + bgc.b * (1 - a) });
    const cls = (el.className && typeof el.className === "string") ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    out.push({ sel: el.tagName.toLowerCase() + cls, text: t.slice(0, 40), fg, bg, opacity: Math.round(op * 100) / 100, ratio: ratio(fg, bg), size: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(",")[0] });
  }
  return out;
};
// glyph audit under a root: which of the vocabulary glyphs appear, with their colour and the word beside them
const GLYPHS = (rootSel) => {
  const root = document.querySelector(rootSel); if (!root) return [];
  const V = "▲✓×⚠◌⌁●○—→↑↓↻⤢✎›";
  const out = []; const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (t.length <= 2 && t && [...V].some((g) => t.includes(g))) { const el = n.parentElement; const cs = getComputedStyle(el); out.push({ glyph: t, color: cs.color, hidden: el.getAttribute("aria-hidden"), sibling: (el.parentElement?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 50), cls: (el.className || "").toString().slice(0, 40) }); } }
  return out;
};
// controls under a root with their hit sizes (P10)
const TARGETS = (rootSel) => {
  const root = document.querySelector(rootSel || "body"); if (!root) return [];
  return Array.from(root.querySelectorAll("button, a[href], input, select, [role=button], [role=checkbox], [role=radio], summary")).filter((e) => { const cs = getComputedStyle(e); return cs.display !== "none" && cs.visibility !== "hidden" && e.getBoundingClientRect().width > 0; }).map((e) => { const b = e.getBoundingClientRect(); return { tag: e.tagName.toLowerCase(), name: (e.getAttribute("aria-label") || e.textContent || e.value || "").trim().replace(/\s+/g, " ").slice(0, 40), cls: (e.className || "").toString().slice(0, 40), w: Math.round(b.width), h: Math.round(b.height), top: Math.round(b.top + scrollY), left: Math.round(b.left), right: Math.round(b.right), disabled: e.disabled === true || e.getAttribute("aria-disabled") === "true" }; });
};
// type roles: every text node's (size, weight, family, transform, color) tuple under a root — P5
const TYPE = (rootSel) => {
  const root = document.querySelector(rootSel); if (!root) return [];
  const tally = new Map(); const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = walker.nextNode())) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; const cs = getComputedStyle(el); if (cs.display === "none") continue; const key = `${cs.fontFamily.split(",")[0].replace(/"/g, "")}|${cs.fontSize}|${cs.fontWeight}|${cs.textTransform}|${cs.color}`; if (!tally.has(key)) tally.set(key, { key, n: 0, ex: t.slice(0, 30), tr: Array.from(el.classList).filter((c) => /^tr-/.test(c)).join(" ") }); tally.get(key).n++; }
  return Array.from(tally.values()).sort((a, b) => b.n - a.n);
};
// aria-live regions and their current text
const LIVE = () => Array.from(document.querySelectorAll("[aria-live], [role=status], [role=alert]")).map((e) => ({ sel: e.tagName.toLowerCase() + "." + (e.className || "").toString().trim().split(/\s+/).slice(0, 2).join("."), role: e.getAttribute("role"), live: e.getAttribute("aria-live"), text: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 100) }));

async function runAxe(page, OUT, name) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"] }, rules: { "target-size": { enabled: true } } });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, tags: v.tags.filter((t) => /wcag|best/.test(t)), nodes: v.nodes.map((n) => ({ target: n.target.join(" "), summary: n.failureSummary?.slice(0, 200), data: n.any?.[0]?.data ?? n.all?.[0]?.data ?? null })) }));
  });
  fs.writeFileSync(path.join(OUT, `axe-${name}.json`), JSON.stringify(res, null, 1));
  return res;
}

async function shot(page, OUT, name, full = false) { const p = path.join(OUT, name + ".png"); await page.screenshot({ path: p, fullPage: full }); return name + ".png"; }

// rect diff of a selector list across a state change: returns rows whose top/height moved
function diffRects(before, after) {
  const out = [];
  for (const sel of Object.keys(before)) {
    if (sel.startsWith("__")) continue;
    const a = before[sel], b = after[sel] || [];
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const d = { sel, i, dTop: b[i].top - a[i].top, dH: b[i].h - a[i].h, dLeft: b[i].left - a[i].left, dW: b[i].w - a[i].w, text: a[i].text };
      if (d.dTop || d.dH || d.dLeft || d.dW) out.push(d);
    }
    if (a.length !== b.length) out.push({ sel, count: `${a.length}→${b.length}` });
  }
  out.docH = (after.__docH || 0) - (before.__docH || 0);
  return out;
}

module.exports = { chromium, fs, path, ROOT, mkLog, shaGate, RECT, RECTS, PAIRS, GLYPHS, TARGETS, TYPE, LIVE, runAxe, shot, diffRects };
