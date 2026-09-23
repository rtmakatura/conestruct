// #289 fidelity audit — map every measured node to its Part 2 rule and
// print the deltas.  Input: capture.json (probe.cjs).  Output: markdown.
//
// Spec values are Part 2's (#281 comment 1), with the arc's recorded
// rulings applied where they override a number (R7 nav 52, R9 fact floor
// 48, ruling 180's 19 px step question below 520).  A property the spec
// does not state is not diffed.

const fs = require("fs");
const cap = JSON.parse(fs.readFileSync(__dirname + "/capture.json", "utf8"));

const hex = (c) => {
  const m = /rgba?\((\d+), (\d+), (\d+)(?:, ([\d.]+))?\)/.exec(c || "");
  if (!m) return c;
  const h = "#" + [m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, "0")).join("");
  return m[4] !== undefined && +m[4] !== 1 ? `${h}@${m[4]}` : h;
};
const px = (s) => parseFloat(s);
const fam = (f) => (/Mono/i.test(f) ? "mono" : /Inter/i.test(f) ? "sans" : f);
const em = (ls, size) => (ls === "normal" ? 0 : Math.round((px(ls) / px(size)) * 100) / 100);

// ---------------------------------------------------------------- TEXT
// cause: "token" = a Direction A class carrying the wrong value;
//        "old"   = a pre-redesign class or Tailwind utility styling it;
//        "missing" = no declaration — the body's 16 px / inherited value.
const T = [];
const t = (rule, name, match, spec, cause) => T.push({ rule, name, match, spec, cause });
const has = (x, re) => re.test(x.el) || re.test(x.chain);
// Class-only view of an element: test ids ([where-confirm]) must never
// satisfy a class pattern (they did: "confirm" matched rule 133).
const cls = (x) => " " + x.el.replace(/\[.*?\]/g, "").replace(/#[\w-]+/, "").split(".").slice(1).join(" ") + " ";
const parent = (x) => x.chain.split(" > ").slice(-2)[0] || "";

// Symbols first (rules 17–18): mono 12.5/1, fixed hue per glyph.
const GLYPH = { "✓": "#4fd787", "▲": "#f4c020", "⚠": "#f4c020", "◌": "#93a0b0", "×": "#ff7a7a", i: "#34a9e8" };
const WRONG_GLYPH = { "○": "◌", "✕": "×", "ℹ": "i", "⌁": null, "▸": null, "›": null };
// A glyph written inside a provenance sentence ("⚠ OSM · inferred", rule
// 138) is part of that sentence, not a free-standing symbol.
t("17–18", "symbol", (x) => /^(✓|▲|⚠|◌|×|i|○|✕|ℹ)$/.test(x.text) && !/tr-prov/.test(parent(x)), null, null);
t("6 / 138", "glyph inside provenance", (x) => /^(⚠|▲)$/.test(x.text) && /tr-prov/.test(parent(x)),
  { family: "mono", size: 10.5, color: "#f4c020" }, "token");

// Rule 53's "none" variant words the strip in #93a0b0; every other
// variant in #eaf0f7 (rule 51).
t("51 / 53", "verdict word (none variant)", (x) => /status-bar\.idle/.test(parent(x)) && /^span$/.test(x.el),
  { family: "mono", size: 11, weight: 500, ls: 0.14, color: "#93a0b0", transform: "uppercase" }, "old");
t("51", "verdict word", (x) => /status-bar/.test(parent(x)) && /^span$/.test(x.el),
  { family: "mono", size: 11, weight: 500, ls: 0.14, color: "#eaf0f7", transform: "uppercase" }, "old");
t("52", "verdict pill", (x) => / pill /.test(cls(x)),
  { family: "mono", size: 9.5, weight: 500, ls: 0.14, transform: "uppercase" }, "old");
// The strip's expandable check list: rules 50–55 give the strip a symbol,
// a word and a pill — nothing that opens.
t("50–55", "strip disclosure (check list)", (x) => has(x, /check-list|disclosure-caret/),
  null, "extra");
t("52", "verdict pill", (x) => /pill/.test(x.el),
  { family: "mono", size: 9.5, weight: 500, ls: 0.14, transform: "uppercase" }, "old");
t("3", "section header", (x) => /tr-section|ny-title/.test(x.el),
  { family: "mono", size: 10, lh: 1.2, weight: 500, ls: 0.18, color: "#eaf0f7", transform: "uppercase" }, "token");
t("81 / 3q", "hero cell label (quiet header)", (x) => /span\.k$/.test(x.el),
  { family: "mono", size: 10, lh: 1.2, weight: 500, ls: 0.18, color: "#93a0b0", transform: "uppercase" }, "old");
t("4", "step index", (x) => /tr-step/.test(x.el) && has(x, /a-head/),
  { family: "mono", size: 10, lh: 1.2, weight: 400, ls: 0.12, color: "#93a0b0", transform: "none" }, "token");
t("11", "citation", (x) => /ny-cite/.test(x.el),
  { family: "mono", size: 9.5, ls: 0.06, color: "#93a0b0" }, "token");
t("73", "NEEDS YOU count", (x) => /ny-count/.test(x.el),
  { family: "mono", size: 11, weight: 500, color: "#eaf0f7" }, "token");
t("88", "disclosure count", (x) => /disc-count/.test(x.el),
  { family: "mono", size: 11, color: "#c8d1dd" }, "token");
t("88", "disclosure name", (x) => /disc-name/.test(x.el),
  { family: "sans", size: 13, weight: 500, color: "#eaf0f7" }, "token");
t("88", "disclosure caret", (x) => /disc-caret/.test(x.el),
  { family: "mono", size: 12, color: "#93a0b0" }, "missing");
t("58 / 134", "fact link", (x) => /a-lk/.test(x.el),
  { family: "mono", size: 9.5, ls: 0.14, color: "#34a9e8", transform: "uppercase" }, "token");
t("133 on", "ledger action (recommended, on)", (x) => / is-on /.test(cls(x)) && / act /.test(cls(x)) && !/@0\.3/.test(hex(x.color)),
  { family: "mono", size: 9.5, ls: 0.14, color: "#34a9e8", transform: "uppercase" }, "token");
t("133 disabled", "ledger action (disabled)", (x) => / act /.test(cls(x)) && /@0\.3/.test(hex(x.color)),
  { family: "mono", size: 9.5, ls: 0.14, color: "#c8d1dd (at opacity .45)", transform: "uppercase" }, "token");
t("133", "ledger action", (x) => /^button/.test(x.el) && (/ (act|act-btn|confirm) /.test(cls(x)) || (/ ghost /.test(cls(x)) && has(x, /jbar-suggest/))),
  { family: "mono", size: 9.5, ls: 0.14, color: "#c8d1dd", transform: "uppercase" }, "token");
t("132", "ghost (download buttons, zip)", (x) => /dl-btn/.test(x.el) || (/button/.test(x.el) && has(x, /dl-all/)),
  { family: "sans", size: 13, weight: 500, color: "#eaf0f7" }, "old");
t("10", "generated numeral (card)", (x) => /^b$/.test(x.el) && has(x, /dl-card/),
  { family: "mono", weight: 500, color: "#ff8a2e" }, "old");
t("85 / 6", "card caption", (x) => has(x, /dl-card/) && /qty|font-mono/.test(x.el) && !/dl-btn/.test(x.chain),
  { family: "mono", size: 10.5, lh: 1.5, color: "#93a0b0", transform: "none" }, "old");
t("135 / 5", "toggle chip (flat)", (x) => /a-chip-flat/.test(x.el),
  { family: "sans", size: 12.5, weight: 500, color: "#eaf0f7" }, "token");
t("6", "suggestion line", (x) => has(x, /jbar-suggest/) && /^(span|div|b\.sugg-name|span\.font-mono)/.test(x.el) && !/sugg-glyph/.test(x.el),
  { family: "mono", size: 10.5, weight: 400, color: "#93a0b0" }, "old");
t("6", "schedule-window line", (x) => has(x, /sched-window/) && !/glyph/.test(x.el),
  { family: "mono", size: 10.5, color: "#93a0b0" }, "old");
t("8", "setup value separator", (x) => x.text === "·" && has(x, /setup-values/),
  { family: "sans", size: 13.5, color: "#c8d1dd" }, "token");
t("131", "primary XL (Generate)", (x) => /generate-btn/.test(x.el),
  { family: "sans", size: 17.5, weight: 600, color: "#0c1622", transform: "none" }, "old");
t("130", "primary", (x) => /a-pri|button\.pri/.test(x.el),
  { family: "sans", size: 15.5, weight: 600, color: "#0c1622" }, "token");
t("7", "step question", (x) => /tr-question/.test(x.el),
  { family: "sans", size: 22, size380: 19, lh: 1.25, weight: 600, color: "#eaf0f7" }, "token");
t("9", "item body", (x) => /ny-body/.test(x.el),
  { family: "sans", size: 13.5, lh: 1.5, color: "#eaf0f7" }, "token");
t("5", "field label", (x) => /tr-field|label/.test(x.el) || /a-chip/.test(x.chain.split(" > ").slice(-2)[0] || "") && /tr-field/.test(x.el),
  { family: "sans", size: 12.5, lh: 1.4, weight: 500, color: "#eaf0f7" }, "token");
t("85 / 5", "download card title", (x) => /^h3$/.test(x.el) && has(x, /dl-card|top/),
  { family: "sans", size: 12.5, lh: 1.4, weight: 500, color: "#eaf0f7" }, "old");
// Rule 82 before rule 6: the case-ID line is provenance role AT #eaf0f7.
t("82", "hero case-id line", (x) => /caseid/.test(x.el),
  { family: "mono", size: 10.5, color: "#eaf0f7" }, "token");
// Rule 138: amber provenance marks a guess — the hue is the spec's own.
t("6 / 138", "provenance (amber guess)", (x) => /is-amber/.test(x.el) || /is-amber/.test(x.chain.split(" > ").slice(-2)[0] || ""),
  { family: "mono", size: 10.5, lh: 1.5, weight: 400, color: "#f4c020", transform: "none", decoration: "none" }, "token");
t("6", "provenance", (x) => /tr-prov|sc-evidence|sc-result|sc-time|sugg-reason|honesty|span\.fmt/.test(x.el) ||
    (/^span$/.test(x.el) && /tr-prov/.test(x.chain.split(" > ").slice(-2)[0] || "")),
  { family: "mono", size: 10.5, lh: 1.5, weight: 400, color: "#93a0b0", transform: "none", decoration: "none" }, "token");
t("95.4", "panel status row", (x) => /a-panel-status/.test(x.el),
  { family: "mono", size: 10.5, color: "#93a0b0" }, "missing");
t("93", "panel was / now", (x) => /a-val/.test(x.el) && has(x, /a-panel-row/),
  { family: "mono", size: 12.5 }, "missing");
t("8", "body value", (x) => /a-val|wb-named/.test(x.el),
  { family: "sans", size: 13.5, lh: 1.45, weight: 400, color: "#c8d1dd" }, "token");
t("10", "hero numeral", (x) => /div\.num/.test(x.el),
  { family: "mono", size: 62, size380: 42, weight: 500, color: "#ff8a2e" }, "token");
t("82", "hero geometry row", (x) => has(x, /hero-meta/) && !/caseid/.test(x.el) && !/tr-prov/.test(x.el),
  { family: "mono", size: 11, color: "#c8d1dd" }, "token");
t("82", "hero case-id line", (x) => /caseid/.test(x.el),
  { family: "mono", size: 10.5, color: "#eaf0f7" }, "token");
t("100", "stale ribbon", (x) => /stale-ribbon/.test(x.el),
  { family: "sans", size: 13.5, lh: 1.45, color: "#c8d1dd" }, "token");
t("98", "working band verb", (x) => /wb-verb/.test(x.el),
  { family: "mono", size: 10, ls: 0.16, color: "#a9dcf8", transform: "uppercase" }, "token");
t("98", "working band lock", (x) => /wb-lock/.test(x.el),
  { family: "mono", size: 9.5, ls: 0.12, color: "#f4c020", transform: "uppercase" }, "token");
t("22", "wordmark", (x) => /^span/.test(x.el) && /^conestruct$/.test(x.text) && has(x, /(^|> )nav/),
  { family: "sans", size: 14.5, weight: 600, ls: -0.01, color: "#eaf0f7" }, "old");
t("22", "wordmark period", (x) => x.text === "." && has(x, /(^|> )nav/),
  { family: "sans", size: 14.5, weight: 600, color: "#ff8a2e" }, "old");
t("22 / 23", "nav text", (x) => has(x, /(^|> )nav/),
  { family: "mono", size: 10, ls: 0.16, color: "#93a0b0", transform: "uppercase" }, "old");
t("30", "footer (unchanged)", (x) => has(x, /(^|> )footer/), null, "skip");
t("29", "draft notice", (x) => /Draft|engineering reference/.test(x.text),
  { family: "mono", size: 10.5, lh: 1.5, color: "#93a0b0", transform: "none" }, "old");
t("116 / 130", "Generate reason line", (x) => /cta-reason/.test(x.chain),
  { family: "mono", size: 10.5, color: "#93a0b0", transform: "none" }, "old");

function diffText(x, spec, w) {
  const d = [];
  const size = w === "380" && spec.size380 ? spec.size380 : spec.size;
  if (spec.family && fam(x.family) !== spec.family) d.push(["family", spec.family, fam(x.family)]);
  if (size && Math.abs(px(x.size) - size) > 0.05) d.push(["size", `${size}px`, x.size]);
  if (spec.weight && +x.weight !== spec.weight) d.push(["weight", spec.weight, x.weight]);
  if (spec.lh) {
    const want = Math.round(spec.lh * (size || px(x.size)) * 100) / 100;
    if (Math.abs(px(x.lineHeight) - want) > 0.3) d.push(["line-height", `${want}px (${spec.lh})`, x.lineHeight]);
  }
  if (spec.ls !== undefined) {
    const got = em(x.letterSpacing, x.size);
    if (Math.abs(got - spec.ls) > 0.005) d.push(["letter-spacing", `${spec.ls}em`, `${got}em`]);
  }
  if (spec.color && hex(x.color) !== spec.color) d.push(["colour", spec.color, hex(x.color)]);
  if (spec.transform && x.transform !== spec.transform) d.push(["transform", spec.transform, x.transform]);
  if (spec.decoration && x.decoration !== spec.decoration) d.push(["decoration", spec.decoration, x.decoration]);
  return d;
}

// ---------------------------------------------------------------- BOXES
const B = [];
const b = (rule, name, match, spec, cause) => B.push({ rule, name, match, spec, cause });
b("24", "column width", (x) => /^main\b/.test(x.el), { contentW: 880, contentW380: "100% (16/14 pad)" }, "old");
// Rule 24 states the 1440 padding; the 380 value is rule 160's.
b("24 / 160", "page padding", (x) => /^main\b/.test(x.el), { padding: "26px 40px 0px 40px", padding380: "16px 14px 16px 14px" }, "old");
b("21 / R7", "nav height", (x) => /^nav\b/.test(x.el), { h: 52, bg: "#16232f" }, "old");
b("50 / 53 none", "verdict strip — none", (x) => /status-bar\.idle/.test(x.el),
  { padding: "13px 16px 13px 16px", colGap: 12, borderT: "1px solid #223345", borderL: "1px solid #223345", bg: "#101c29" }, "old");
b("50 / 53 ready", "verdict strip — ready", (x) => /status-bar\.pass/.test(x.el),
  { padding: "13px 16px 13px 16px", colGap: 12, borderT: "1px solid #2d6b4d", borderL: "1px solid #2d6b4d", bg: "#112620" }, "old");
b("50 / 53 flag", "verdict strip — flag", (x) => /status-bar\.caution/.test(x.el),
  { padding: "13px 16px 13px 16px", colGap: 12, borderT: "1px solid #6b5a18", borderL: "1px solid #6b5a18", bg: "#221e10" }, "old");
b("52", "verdict pill", (x) => /pill/.test(x.el), { padding: "6px 10px 6px 10px", borderT: "1px" }, "old");
b("26", "strip → first band", (x) => /section\.zone(?!\.results)/.test(x.el) && /status-slot/.test(x.prev || ""), { gapToPrev: 18 }, "token");
b("27", "verdict → setup line", (x) => /section\.zone\.results/.test(x.el), { gapToPrevOneOf: [14] }, "old");
b("27", "setup → NEEDS YOU", (x) => /needs-you/.test(x.el) && /results-head-slot/.test(x.prev || ""), { gapToPrev: 16 }, "token");
b("27", "NEEDS YOU → hero", (x) => /results-stale|^div$/.test(x.el) && /needs-you|stale-ribbon/.test(x.prev || ""), { gapToPrev: 14 }, "old");
b("56", "fact line", (x) => /a-fact\b/.test(x.el),
  { padding: "13px 16px 13px 16px", colGap: 14, colGap380: null, bg: "#16232f", borderT: "1px solid #2c3e53", minH: 48, grid: "20px", grid380: "18px" }, "token");
b("61", "open band", (x) => /section\.a-open(?!\.is-revising)/.test(x.el), { bg: "#101c29", borderT: "1px solid #2c3e53" }, "token");
b("61", "open band (revising)", (x) => /a-open\.is-revising/.test(x.el), { bg: "#101c29", borderT: "1px solid #34a9e8" }, "token");
b("62", "band header", (x) => /a-head/.test(x.el), { padding: "14px 16px 14px 16px", colGap: 14, borderB: "1px solid #223345" }, "token");
b("63", "band body", (x) => /a-body/.test(x.el), { padding: "18px 16px 18px 16px" }, "token");
b("67", "move row", (x) => /a-move(?!s)(?!\.is-current)/.test(x.el), { padding: "10px 0px 10px 0px", colGap: 12 }, "token");
b("69", "move row (current)", (x) => /a-move\.is-current/.test(x.el), { padding: "10px 8px 10px 8px", bg: "#34a9e8@0.07" }, "token");
b("114 / 164", "find row", (x) => /a-findrow/.test(x.el), { grid: "1fr 132px", grid380: "1 tracks", colGap: 12, colGap380: null }, "token");
b("114", "FIND primary", (x) => /where-open-picker/.test(x.el), { h: 44, w: 132, h380: 48 }, "token");
b("115", "WHERE confirm primary", (x) => /where-confirm\]/.test(x.el), { h: 56, h380: 48, marginTop: 14 }, "token");
b("116", "WHAT grid", (x) => /a-grid/.test(x.el) && !/panel/.test(x.chain), { colGap: 14, tracks: 3, tracks380: 1 }, "token");
b("116", "field cell", (x) => /a-cell/.test(x.el), { rowGap: 6 }, "token");
b("136", "field", (x) => /a-fld/.test(x.el), { h: 44, bg: "#16232f", borderT: "1px solid #2c3e53", padding: "0px 12px 0px 12px" }, "token");
b("135", "kind chip", (x) => /a-chip\[kind-chip/.test(x.el), { padding: "12px 13px 12px 13px", minH: 44, rowGap: 4, borderT: "1px solid #2c3e53" }, "token");
b("116 / 131", "generate frame", (x) => /a-genframe/.test(x.el), { padding: "18px 16px 18px 16px", bg: "#101c29", borderT: "1px solid #2c3e53" }, "token");
// Rule 131: .pri.xl is "used only for GENERATE PLAN in S3 and the generate
// frame at 380" — so 66 px at both widths.
b("131", "Generate primary", (x) => /generate-btn/.test(x.el), { h: 66 }, "old");
b("133", "ledger action", (x) => /\.act(-btn)?\b/.test(x.el) && !/a-lk/.test(x.el), { minH: 32, minH380: 44, padding: "7px 11px 7px 11px" }, "token");
b("134 / 15", "fact link hit box", (x) => /a-lk/.test(x.el), { h: 32, h380: 44 }, "token");
b("72", "NEEDS YOU shell", (x) => /needs-you/.test(x.el) && /section/.test(x.el), { bg: "#101c29", borderL: "2px solid #f4c020" }, "token");
b("73", "NEEDS YOU header", (x) => /ny-head/.test(x.el), { padding: "12px 16px 12px 16px" }, "token");
b("74", "NEEDS YOU item", (x) => /^li\.ny-item(?!.*(ny-apply|ny-foot|ny-subhead))/.test(x.el), { padding: "14px 16px 14px 16px", colGap: 14, grid: "20px", grid380: "18px" }, "token");
b("78", "Apply row", (x) => /ny-apply/.test(x.el), { padding: "13px 16px 13px 16px" }, "token");
b("80", "counts hero", (x) => /div\.hero$/.test(x.el), { grid: "1fr 1fr 300px", grid380: "2 tracks" }, "old");
b("80", "hero cell", (x) => /hero-cell/.test(x.el), { padding: "20px 22px 20px 22px" }, "old");
b("84", "download row", (x) => /div\.dls/.test(x.el), { colGap: 12, render380: false }, "old");
b("84", "download card", (x) => /dl-card/.test(x.el), { padding: "14px 14px 14px 14px", minH: 142, rowGap: 7 }, "old");
b("132", "card button (ghost)", (x) => /dl-btn/.test(x.el), { h: 44 }, "old");
b("87", "disclosure row", (x) => /disc-head/.test(x.el), { minH: 48, padding: "0px 16px 0px 16px", colGap: 12 }, "token");
b("100", "stale ribbon", (x) => /stale-ribbon/.test(x.el), { padding: "11px 14px 11px 14px", bg: "#101c29", borderL: "2px solid #34a9e8" }, "token");
b("90", "before/after panel", (x) => /a-panel\[revision-panel\]/.test(x.el), { bg: "#0f1c29", borderT: "1px solid #34a9e8" }, "token");
b("92 / 95.15", "panel row", (x) => /a-panel-row(?!s)(?!\.a-panel-head-row)/.test(x.el), { grid: "1fr 92px 22px 92px", grid380: "1fr 58px 16px 96px", colGap: 10, padding: "10px 16px 10px 16px" }, "token");
b("95.4", "panel status row", (x) => /a-panel-status/.test(x.el), { minH: 44, padding: "11px 16px 11px 16px" }, "missing");
b("94 / 95.15", "APPLY", (x) => /revise-apply/.test(x.el), { w: 200, h: 44, h380: 48 }, "token");
b("169", "hero geometry cell at 380", (x) => /hero-meta/.test(x.el), { render380: false }, "old");
b("121", "S7 body grid", (x) => /a-body/.test(x.el) && /is-revising/.test(x.chain), { grid: "240px 1fr", colGap: 26 }, "missing");

function diffBox(x, s, w) {
  const d = [];
  const n = w === "380";
  const P = (k) => (n && s[k + "380"] !== undefined ? s[k + "380"] : s[k]);
  const borderPart = (which) => {
    const seg = x.border.split(" | ");
    const pick = which === "T" ? seg[0] : which === "L" ? seg[1].replace(/^L /, "") : seg[2].replace(/^B /, "");
    const [wd, st, ...col] = pick.split(" ");
    return { wd, st, col: hex(col.join(" ")) };
  };
  if (P("padding") && x.padding !== P("padding")) d.push(["padding", P("padding"), x.padding]);
  const cg = n && s.colGap380 !== undefined ? s.colGap380 : s.colGap;
  if (cg !== undefined && cg !== null) {
    const g = x.gap.split(" ")[1];
    if (px(g) !== cg) d.push(["column-gap", `${cg}px`, g]);
  }
  if (s.rowGap !== undefined) {
    const g = x.gap.split(" ")[0];
    if (px(g) !== s.rowGap) d.push(["row-gap", `${s.rowGap}px`, g]);
  }
  if (s.bg && hex(x.bg) !== s.bg) d.push(["background", s.bg, hex(x.bg)]);
  for (const [k, part] of [["borderT", "T"], ["borderL", "L"], ["borderB", "B"]]) {
    if (!s[k]) continue;
    const bp = borderPart(part);
    const [wd, st, col] = s[k].split(" ");
    const got = [bp.wd, st ? bp.st : null, col ? bp.col : null].filter(Boolean).join(" ");
    const want = [wd, st, col].filter(Boolean).join(" ");
    if (got !== want) d.push([`border-${{ T: "top", L: "left", B: "bottom" }[part]}`, want, got]);
  }
  if (P("h") !== undefined && Math.abs(x.h - P("h")) > 0.5) d.push(["height", `${P("h")}px`, `${x.h}px`]);
  if (s.w !== undefined && !n && Math.abs(x.w - s.w) > 0.5) d.push(["width", `${s.w}px`, `${x.w}px`]);
  if (P("minH") !== undefined && px(x.minHeight) !== P("minH") && x.h < P("minH")) d.push(["min-height", `${P("minH")}px`, `${x.minHeight} (h ${x.h})`]);
  if (s.gapToPrev !== undefined && x.gapToPrev !== null && Math.abs(x.gapToPrev - s.gapToPrev) > 0.5)
    d.push(["gap above", `${s.gapToPrev}px`, `${x.gapToPrev}px (after ${x.prev})`]);
  if (s.gapToPrevOneOf && x.gapToPrev !== null && !s.gapToPrevOneOf.some((g) => Math.abs(x.gapToPrev - g) <= 0.5))
    d.push(["gap above", `${s.gapToPrevOneOf.join("/")}px`, `${x.gapToPrev}px (after ${x.prev})`]);
  if (s.contentW !== undefined) {
    const [pt, pr, pb, pl] = x.padding.split(" ").map(px);
    const content = Math.round((x.w - pl - pr) * 100) / 100;
    if (!n && content !== s.contentW) d.push(["column width", `${s.contentW}px`, `${content}px`]);
  }
  if (P("grid") && P("grid") !== x.grid) {
    if (P("grid") === "20px" || P("grid") === "18px") {
      const lead = P("grid");
      const tracks = x.grid.split(" ").length;
      const want = lead === "20px" ? 3 : 2;
      if (!x.grid.startsWith(lead) || tracks !== want)
        d.push(["grid", lead === "20px" ? "20px / 1fr / auto" : "18px / 1fr (rule 166/167)", x.grid]);
    } else if (/tracks/.test(P("grid"))) {
      const tr = x.grid.split(" ").length;
      if (+P("grid")[0] !== tr) d.push(["grid", P("grid"), `${tr} tracks`]);
    } else {
      const want = P("grid").split(" ");
      const got = x.grid === "none" ? [] : x.grid.split(" ");
      const ok =
        want.length === got.length &&
        want.every((v, i) => /fr/.test(v) || Math.abs(px(v) - px(got[i])) <= 0.5);
      if (!ok) d.push(["grid", P("grid"), x.grid]);
    }
  }
  if (s.tracks !== undefined) {
    const tr = x.grid === "none" ? 1 : x.grid.split(" ").length;
    const want = n ? s.tracks380 : s.tracks;
    if (tr !== want) d.push(["grid tracks", want, tr]);
  }
  if (s.marginTop !== undefined && !n && px(x.margin.split(" ")[0]) !== s.marginTop && x.gapToPrev !== s.marginTop)
    d.push(["gap above", `${s.marginTop}px`, `${x.gapToPrev}px`]);
  if (s.render380 === false && n) d.push(["renders at 380", "no (rule 168)", "yes"]);
  return d;
}

// ---------------------------------------------------------------- RUN
const rows = new Map();
const unmapped = new Map();
// One row per (cause, rule, property, spec, measured): the elements that
// share a delta are one fix, so they are one row.
const add = (_key, row) => {
  const key = [row.cause, row.rule, row.prop, row.spec, row.got].join("¦");
  if (!rows.has(key)) rows.set(key, { ...row, els: new Set(), where: new Set() });
  rows.get(key).els.add(row.el);
  rows.get(key).where.add(row.at);
};
// States, compacted: "S1–S7 @1440+380" when every capture shows it.
const ALL = ["S1", "S2", "S3", "S5", "S7"];
const compact = (set) => {
  const by = { 1440: [], 380: [] };
  for (const a of set) {
    const [s, w] = a.split("@");
    by[w].push(s);
  }
  const f = (l) => (l.length === ALL.length ? "all" : l.sort().join(" "));
  if (f(by[1440]) === f(by[380])) return `${f(by[1440])} · both widths`;
  return [by[1440].length ? `${f(by[1440])} @1440` : null, by[380].length ? `${f(by[380])} @380` : null].filter(Boolean).join(" · ");
};
const causeOf = (spec, x, prop) => {
  if (spec.cause === "missing" || (prop !== "family" && px(x.size) === 16 && spec.cause !== "old")) return "missing";
  return spec.cause;
};

for (const [w, wd] of Object.entries(cap.widths)) {
  for (const [state, d] of Object.entries(wd.states)) {
    const at = `${state}@${w}`;
    if (d.scrollW > d.innerW)
      add(`overflow ${w}`, { cause: "old", rule: "32 / 173", el: "page", prop: "horizontal scroll", spec: `scrollWidth ${d.innerW}`, got: `${d.scrollW}`, at });
    for (const x of d.texts) {
      const s = T.find((r) => r.match(x));
      const key0 = x.el.replace(/\[.*?\]/g, "").replace(/#[\w-]+/, "").replace(/\.(min-h|min-w|max-w|text|tracking|leading)-[^.]*/g, "");
      if (!s) {
        const k = key0 + " " + x.text.slice(0, 24);
        if (!unmapped.has(k)) unmapped.set(k, { el: key0, text: x.text, style: `${fam(x.family)} ${x.size}/${x.lineHeight} ${x.weight} ${hex(x.color)} ${x.transform}`, where: new Set() });
        unmapped.get(k).where.add(at);
        continue;
      }
      if (s.cause === "skip") continue;
      if (s.cause === "extra") {
        const k = "extra " + key0 + " " + x.text.slice(0, 24);
        if (!unmapped.has(k)) unmapped.set(k, { el: `${key0} (rule ${s.rule}: not in the component)`, text: x.text, style: `${fam(x.family)} ${x.size}/${x.lineHeight} ${x.weight} ${hex(x.color)} ${x.transform}`, where: new Set() });
        unmapped.get(k).where.add(at);
        continue;
      }
      if (s.rule === "17–18") {
        const want = WRONG_GLYPH[x.text] !== undefined ? WRONG_GLYPH[x.text] : x.text;
        const deltas = [];
        if (WRONG_GLYPH[x.text]) deltas.push(["glyph", want, x.text]);
        if (fam(x.family) !== "mono") deltas.push(["family", "mono", fam(x.family)]);
        if (Math.abs(px(x.size) - 12.5) > 0.05) deltas.push(["size", "12.5px", x.size]);
        if (GLYPH[want] && hex(x.color) !== GLYPH[want]) deltas.push(["colour", GLYPH[want], hex(x.color)]);
        for (const [prop, sp, got] of deltas)
          add(`g ${key0} ${x.text} ${prop} ${got}`, {
            cause: prop === "glyph" ? "token" : px(x.size) === 16 ? "missing" : /a-sym|status-glyph|ny-glyph/.test(x.el) ? "token" : "old",
            rule: "17–18", el: `${key0} "${x.text}"`, prop, spec: sp, got, at,
          });
        continue;
      }
      for (const [prop, sp, got] of diffText(x, s.spec, w))
        add(`t ${s.rule} ${key0} ${prop} ${got}`, {
          cause: causeOf(s, x, prop), rule: s.rule, el: `${s.name} — ${key0}`, prop, spec: sp, got, at, sample: x.text,
        });
    }
    // Rule 27's first gap, measured between the two boxes themselves: the
    // sr-only announcement region sits between them in the DOM, so the
    // sibling reading is 0 px and says nothing about the page.
    const ss = d.boxes.find((x) => /^div\.status-slot/.test(x.el));
    const rh = d.boxes.find((x) => /results-head-slot/.test(x.el));
    if (state === "S5" && ss && rh) {
      const g = Math.round((rh.top - (ss.top + ss.h)) * 100) / 100;
      if (Math.abs(g - 14) > 0.5)
        add("", { cause: "old", rule: "27", el: "verdict strip → setup fact line", prop: "gap", spec: "14px", got: `${g}px`, at });
    }
    for (const x of d.boxes) {
      if (/results\.results-stack/.test(x.el) && /sr-only/.test(x.prev || "")) continue;
      for (const s of B.filter((r) => r.match(x))) {
        const key0 = x.el.replace(/\[.*?\]/g, "").replace(/\.(min-h|min-w|max-w|text|tracking|leading|px|pt|pb|pl|py|mb)-[^.]*/g, "");
        for (const [prop, sp, got] of diffBox(x, s.spec, w))
          add(`b ${s.rule} ${s.name} ${prop} ${got}`, {
            cause: s.cause, rule: s.rule, el: `${s.name} — ${key0}`, prop, spec: sp, got, at,
          });
      }
    }
  }
}

const CAUSE = {
  token: "A · wrong token (a Direction A class with the wrong value)",
  old: "B · inherited old-page style",
  missing: "C · missing rule (nothing declared; the body's 16 px or a browser default shows through)",
};
const order = ["token", "old", "missing"];
let out = "";
let n = 0;
for (const c of order) {
  const list = [...rows.values()].filter((r) => r.cause === c).sort((a, z) => String(a.rule).localeCompare(String(z.rule), undefined, { numeric: true }));
  out += `\n### ${CAUSE[c]} — ${list.length} rows\n\n| # | element | Part 2 rule | property | spec | measured | delta | states |\n|---|---|---|---|---|---|---|---|\n`;
  for (const r of list) {
    n += 1;
    const els = [...r.els].map((e) => e.replace(/\|/g, "/")).join("<br>");
    const num = (v) => parseFloat(String(v));
    const delta =
      !Number.isNaN(num(r.spec)) && !Number.isNaN(num(r.got)) && /px|em/.test(String(r.spec))
        ? `${num(r.got) - num(r.spec) > 0 ? "+" : ""}${Math.round((num(r.got) - num(r.spec)) * 100) / 100}${/em/.test(r.spec) ? "em" : "px"}`
        : "≠";
    out += `| ${n} | ${els} | ${r.rule} | ${r.prop} | ${r.spec} | ${String(r.got).replace(/\|/g, "/")} | ${delta} | ${compact(r.where)} |\n`;
  }
}
out += `\n### Unmapped text nodes — no Part 2 rule names them (${unmapped.size})\n\n| element | text | measured | where |\n|---|---|---|---|\n`;
for (const u of [...unmapped.values()].sort((a, z) => a.el.localeCompare(z.el)))
  out += `| ${u.el} | ${u.text.slice(0, 50).replace(/\|/g, "/")} | ${u.style} | ${compact(u.where)} |\n`;
fs.writeFileSync(__dirname + "/deltas.md", out);
const counts = order.map((c) => `${c}=${[...rows.values()].filter((r) => r.cause === c).length}`).join(" ");
console.log(`deltas: ${rows.size} (${counts}); unmapped texts: ${unmapped.size}`);
for (const [w, wd] of Object.entries(cap.widths))
  for (const [s, d] of Object.entries(wd.states))
    console.log(`${s}@${w}: scrollW ${d.scrollW} / ${d.innerW} · settled ${d.settled} · body ${d.bodyFont}`);
