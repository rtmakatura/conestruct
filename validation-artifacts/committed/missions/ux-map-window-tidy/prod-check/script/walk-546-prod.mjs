// Mission ux-map-window-tidy (#546) production check: #543, #544, #545 on
// main 20f88a9.  The real site and backend, no stubs, read-only: nothing is
// saved ("Save and close" is never pressed); the search box and the pin
// change only the page's own state.  Built from the three local walks
// (../../issue-543/walk-script/walk543.mjs, ../../issue-544/walk-script/
// walk544.mjs, ../../issue-545/walk-script/walk545.mjs: the measures, the
// tap-area probe, the close paths) and the previous production check
// (../../../ux-coords-in-search/prod-check/script/walk-541-prod.mjs: the live
// site, the sha gate, console and failed requests).
//   node walk-546-prod.mjs <main checkout> <crops dir> <extra dir> <results json> <head sha> <feat sha> [sizes]
// <head sha> is the shipped main; <feat sha> is the last site commit under
// it (#545's; the commit after it is docs only).  [sizes] is an optional
// comma list of widths (e.g. "1198") to run only those sizes.
// The gate token is read from <main>/conestruct/site/.env.local into
// GATE_BYPASS_TOKEN here and sent only by scripts/gate.cjs, to the site's
// own host; never printed, never written.
//
// Before any browser: backend healthz sha == <head sha>; the site's
// /api/version sha is <head sha> or <feat sha> (polled up to 10 min).
// Per size, one browser, five windows, each on a freshly loaded /sandbox:
//   W1  no pin -> search "Lafayette, CO" (the town notice) -> tap the map
//       under it (a pin; the notice goes) -> Escape.
//   W2  no pin -> "-104.9811, 39.7401" (the "Did you mean" choice) ->
//       "(39.7401, -104.9811)" (a pin) -> Cancel.
//   W3  "[39.7401, -104.9811]" (a pin) -> the Close button.
//   W4  an ordinary address search (the control: one /api/geocode) -> Escape.
//   W5  no pin -> Mapbox's attribution, closed and open -> Escape.
// After each close the window is opened once more on the same page to read
// its bar (nothing kept), and closed with Escape.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [MAIN, CROPS, EXTRA, RESULTS, HEAD_SHA, FEAT_SHA, ONLY] = process.argv.slice(2);
const envText = fs.readFileSync(path.join(MAIN, "conestruct/site/.env.local"), "utf8");
const tm = envText.match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
if (!tm) throw new Error("GATE_BYPASS_TOKEN not in .env.local");
process.env.GATE_BYPASS_TOKEN = tm[1];
const TOKEN = tm[1];
const require = createRequire(path.join(MAIN, "package.json"));
const { newGatedContext, guardOutput, oneLine, gateHeaders, GATE_HEADER } = require(path.join(MAIN, "scripts/gate.cjs"));
guardOutput();
const { chromium } = require("playwright");
const AXE = fs.readFileSync(path.join(MAIN, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SITE = "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const ALL_SIZES = [[1440, 900], [1198, 930], [390, 844]];
const SIZES = ONLY ? ALL_SIZES.filter(([w]) => ONLY.split(",").includes(String(w))) : ALL_SIZES;
const TOWN = "Lafayette, CO";
const COARSE = "That search found a town or area. Tap the map on the road where the work starts.";
const SWAPPED = "-104.9811, 39.7401";
const CHOICE = "Did you mean 39.7401, -104.9811?";
const ROUND = "(39.7401, -104.9811)";
const SQUARE = "[39.7401, -104.9811]";
const PIN_TEXT = "Pin at 39.7401, -104.9811";
const NO_PIN_TEXT = "No pin yet";
const ADDRESS = "E Colfax Ave & Pennsylvania St, Denver";
const EXCEPTION_REASON = "#505 (Ryan, 2026-11-10): Mapbox's logo and attribution links are Mapbox's, placed under its terms, not controls we design";
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const result = { ranAt: new Date().toISOString(), site: SITE, headSha: HEAD_SHA, featSha: FEAT_SHA, exceptionReason: EXCEPTION_REASON, sizes: [] };
const save = () => {
  const ascii = JSON.stringify(result, null, 1).replace(/[\u0080-￿]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
  fs.writeFileSync(RESULTS, `${ascii}\n`, "utf8");
};

// ---- The sha gate -------------------------------------------------------
{
  const hz = await (await fetch(HEALTHZ)).json();
  result.healthz = { status: hz.status, sha: hz.sha, equalsHead: hz.sha === HEAD_SHA };
  console.log(`healthz sha ${String(hz.sha).slice(0, 7)} equals head: ${result.healthz.equalsHead}`);
  if (!result.healthz.equalsHead) { save(); throw new Error("healthz sha is not the shipped main"); }
  const polls = [];
  let ok = false;
  for (let i = 0; i < 40 && !ok; i += 1) {
    let sha = null;
    let status = 0;
    try {
      const r = await fetch(`${SITE}/api/version`, { headers: gateHeaders(SITE), redirect: "manual", cache: "no-store" });
      status = r.status;
      if (r.ok) sha = (await r.json()).sha ?? null;
    } catch (e) {
      status = -1;
    }
    polls.push({ status, sha });
    ok = sha === HEAD_SHA || sha === FEAT_SHA;
    if (!ok) await sleep(15000);
  }
  const last = polls[polls.length - 1];
  result.served = { route: "/api/version", polls: polls.length, status: last.status, sha: last.sha, isHead: last.sha === HEAD_SHA, isFeat: last.sha === FEAT_SHA };
  console.log(`served /api/version sha ${String(last.sha).slice(0, 7)} after ${polls.length} poll(s): head ${result.served.isHead} feat ${result.served.isFeat}`);
  if (!ok) { save(); throw new Error("the served frontend is not the shipped build"); }
}

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// WCAG contrast from two computed colours (walk545).
function rgba(s) {
  const m = String(s).match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = "1"] = m[1].split(/[,\s/]+/).filter(Boolean);
  return { r: Number(r), g: Number(g), b: Number(b), a: Number(a) };
}
function lum({ r, g, b }) {
  const f = (c) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg, bg) {
  const a = rgba(fg);
  const b = rgba(bg);
  if (!a || !b || a.a !== 1 || b.a !== 1) return null;
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

// The three walks' measures in one: boxes in the dialog's own frame
// (viewport rect plus the body scroller's scrollTop), the notice and the
// floating list (walk543), the bar's mark and the 44 px tap-area check
// (walk545).
async function measure(p) {
  const m = await p.evaluate((COARSE) => {
    const dlg = document.querySelector("[data-testid=coords-bar]").closest("[role=dialog]");
    const col = dlg.querySelector(".mw-map-col");
    const scroller = col.parentElement;
    const d = dlg.getBoundingClientRect();
    const r2 = (n) => Math.round(n * 100) / 100;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r2(r.left - d.left), y: r2(r.top - d.top + scroller.scrollTop), w: r2(r.width), h: r2(r.height) };
    };
    const bar = dlg.querySelector("[data-testid=coords-bar]");
    const list = dlg.querySelector("[data-testid=search-list]");
    const search = dlg.querySelector(".mw-search");
    const map = dlg.querySelector(".picker-map, .mw-map-off");
    const mark = bar.querySelector(".mw-cbar-dot");
    const ms = getComputedStyle(mark);
    const bs = getComputedStyle(bar);
    // A token as the browser resolves it: a probe coloured with it.
    const token = (name) => {
      const probe = document.createElement("span");
      probe.style.cssText = `position:absolute;visibility:hidden;color:var(${name});`;
      bar.appendChild(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    };
    const name = (c) => (c.tagName === "INPUT" ? "search box" : `${c.tagName.toLowerCase()} "${(c.getAttribute("aria-label") || c.textContent || c.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 60)}"`);
    const isMapboxMark = (c) => !!c && (c.classList.contains("mapboxgl-ctrl-logo") || (c.tagName === "A" && !!c.closest(".mapboxgl-ctrl-attrib")));
    const shown = [...dlg.querySelectorAll("button, input, a[href], select, textarea, [role=radio], [role=button]")]
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0);
    const exceptions = shown.filter(({ c }) => isMapboxMark(c)).map(({ c, r }) => ({ what: name(c), w: r2(r.width), h: r2(r.height) }));
    const counted = shown.filter(({ c }) => !isMapboxMark(c));
    // Controls whose box is under 44 either way, each with its tap area:
    // the 44 x 44 square centred on it, one probe per CSS pixel.
    const smallBox = counted.filter(({ r }) => r.width < 44 || r.height < 44).map(({ c, r }) => {
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      let own = 0;
      let marks = 0;
      for (let dy = 0; dy < 44; dy += 1) {
        for (let dx = 0; dx < 44; dx += 1) {
          const el = document.elementFromPoint(cx - 22 + dx + 0.5, cy - 22 + dy + 0.5);
          if (el && (el === c || c.contains(el))) own += 1;
          else if (isMapboxMark(el)) marks += 1;
        }
      }
      return { what: name(c), cls: String(c.className).split(" ")[0], w: r2(r.width), h: r2(r.height), probes: 1936, reachControl: own, reachMapboxMark: marks };
    });
    const ls = getComputedStyle(list);
    const listBox = ls.display === "none" ? null : box(list);
    const note = [...dlg.querySelectorAll("p")].find((e) => e.textContent === COARSE) ?? null;
    const ns = note ? getComputedStyle(note) : null;
    const nr = note ? note.getBoundingClientRect() : null;
    return {
      map: box(map),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      search: box(search),
      column: box(col),
      dialog: { w: r2(d.width), h: r2(d.height) },
      scrollHeight: scroller.scrollHeight,
      scrollTop: scroller.scrollTop,
      barText: bar.textContent,
      barGround: bs.backgroundColor,
      barControls: bar.querySelectorAll("button, input, form, a, select, textarea, [tabindex], [role=button]").length,
      flow: [...col.children].map((e) => e.className.split(" ")[0]),
      list: listBox ? { ...listBox, position: ls.position, role: list.getAttribute("role"), text: list.textContent, overMapPx: r2(listBox.y + listBox.h - box(map).y) } : null,
      notice: note
        ? {
            ...box(note),
            inList: list.contains(note),
            shown: nr.width > 0 && nr.height > 0 && ns.visibility === "visible" && ns.display !== "none",
            // What a tap at the notice's centre reaches: the notice, so it lies on top of the map.
            centreReachesNotice: (() => { const el = document.elementFromPoint(nr.left + nr.width / 2, nr.top + nr.height / 2); return !!el && (el === note || note.contains(el) || list.contains(el)); })(),
            font: `${ns.fontFamily.split(",")[0].replace(/["']/g, "")} ${ns.fontSize}`,
            color: ns.color,
            lines: Math.round((note.clientHeight - parseFloat(ns.paddingTop) - parseFloat(ns.paddingBottom)) / parseFloat(ns.lineHeight)),
          }
        : null,
      mark: {
        box: box(mark),
        dataPin: mark.getAttribute("data-pin"),
        background: ms.backgroundColor,
        borderWidth: ms.borderTopWidth,
        borderStyle: ms.borderTopStyle,
        borderColor: ms.borderTopColor,
        radius: ms.borderTopLeftRadius,
        ariaHidden: mark.getAttribute("aria-hidden"),
      },
      tokens: { inkFaint: token("--ink-faint"), dim: token("--dim") },
      countedControls: counted.length,
      controls: counted.map(({ c, r }) => ({ what: name(c), w: r2(r.width), h: r2(r.height) })),
      smallBox,
      under44: smallBox.filter((s) => s.reachControl + s.reachMapboxMark < s.probes),
      mapboxExceptions: exceptions,
    };
  }, COARSE);
  const hollow = rgba(m.mark.background)?.a === 0;
  const hasBorder = m.mark.borderStyle !== "none" && parseFloat(m.mark.borderWidth) > 0;
  m.mark.hollow = hollow;
  m.mark.hasBorder = hasBorder;
  m.mark.isRing = hollow && hasBorder && m.mark.borderColor === m.tokens.inkFaint;
  m.mark.isDot = !hollow && !hasBorder && m.mark.background === m.tokens.dim;
  m.mark.outlineContrast = hasBorder ? contrast(m.mark.borderColor, m.barGround) : null;
  m.mark.fillContrast = hollow ? null : contrast(m.mark.background, m.barGround);
  return m;
}

// The choice and its numbers (walk544).  Lines are the distinct tops of the
// text's rects (a Range over the element's contents).
function measureChoice(p) {
  return p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const btn = document.querySelector("[role=dialog] [data-testid=search-list] button");
    const pair = btn.querySelector(".mw-search-pair");
    const bs = getComputedStyle(btn);
    const b = btn.getBoundingClientRect();
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
    probe.textContent = btn.textContent;
    btn.appendChild(probe);
    const sentenceW = probe.getBoundingClientRect().width;
    probe.remove();
    const linesOf = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
    };
    const pr = pair ? pair.getBoundingClientRect() : null;
    return {
      text: btn.textContent,
      button: { w: r2(b.width), h: r2(b.height) },
      roomForText: r2(b.width - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight)),
      sentenceOnOneLine: r2(sentenceW),
      choiceLines: linesOf(btn),
      pair: pair ? { text: pair.textContent, w: r2(pr.width), h: r2(pr.height), lines: linesOf(pair), whiteSpace: getComputedStyle(pair).whiteSpace } : null,
    };
  });
}

// The camera as the map reports it (the window's mapRef, through React's fiber).
function readCamera(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[role=dialog] .picker-map");
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    for (let f = key ? el[key] : null; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const mm = h.memoizedState?.current;
        if (mm && typeof mm.getZoom === "function" && typeof mm.getCenter === "function") {
          const c = mm.getCenter();
          return { zoom: Math.round(mm.getZoom() * 100) / 100, lat: Math.round(c.lat * 100000) / 100000, lng: Math.round(c.lng * 100000) / 100000, moving: mm.isMoving(), drawn: mm.loaded() && mm.areTilesLoaded() };
        }
      }
    }
    return null;
  });
}
async function settled(p) {
  for (let i = 0; i < 80; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving) return c;
  }
  return readCamera(p);
}
async function drawn(p) {
  for (let i = 0; i < 80; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving && c.drawn) break;
  }
  await p.waitForTimeout(1500);
}
function readRows(p) {
  return p.evaluate(() => [...document.querySelectorAll("[role=dialog] [data-testid=road-pick-panel] [role=radio]")].map((r) => r.querySelector(".road-pick-name")?.textContent ?? null));
}
const markers = (p) => p.locator("[role=dialog] .picker-map .mapboxgl-marker").count();

// The page behind the window (walk545).
function behind(p) {
  return p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r2(r.left), y: r2(r.top), w: r2(r.width), h: r2(r.height) };
    };
    const opener = [...document.querySelectorAll("button")].find((b) => !b.closest("[role=dialog]") && b.textContent.trim() === "Pick on map");
    const band = document.querySelector(".a-open");
    const a = document.activeElement;
    // Each stored key with a checksum of its value, never the value.
    const sum = (s) => { let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return `${s.length}:${h}`; };
    return {
      dialogs: document.querySelectorAll("[role=dialog]").length,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      docHeight: document.documentElement.scrollHeight,
      opener: rect(opener),
      band: rect(band),
      main: rect(document.querySelector("main")),
      bandText: band ? band.innerText.replace(/\s+/g, " ").trim() : null,
      focusOn: a ? `${a.tagName.toLowerCase()} "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)}"` : null,
      focusIsOpener: !!opener && a === opener,
      localStorage: Object.fromEntries(Object.entries(localStorage).map(([k, v]) => [k, sum(v)])),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage).map(([k, v]) => [k, sum(v)])),
    };
  });
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const changedKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
const boxMove = (a, b) => (a && b ? Math.max(...["x", "y", "w", "h"].map((e) => Math.round(Math.abs(a[e] - b[e]) * 100) / 100)) : null);
// The largest move, in px, of any of x, y, w, h of the named boxes between two states.
function moved(a, b, keys) {
  const o = {};
  for (const k of keys) o[k] = k === "dialog" ? Math.max(Math.abs(a.dialog.w - b.dialog.w), Math.abs(a.dialog.h - b.dialog.h)) : boxMove(a[k], b[k]);
  return o;
}
const BOXES = ["map", "search", "rail", "bar"];

async function clip(p, file, box) {
  const vp = p.viewportSize();
  const x = Math.max(0, box.x);
  const y = Math.max(0, box.y);
  await p.screenshot({ path: file, clip: { x, y, width: Math.min(box.width, vp.width - x), height: Math.min(box.height, vp.height - y) } });
}
// The bar with 24 px of map above it, cut to 520 px wide.
async function shootBar(p, w, name) {
  await p.mouse.move(4, 4);
  const r = await p.locator("[role=dialog] [data-testid=coords-bar]").boundingBox();
  await clip(p, path.join(CROPS, `prod-${w}-bar-${name}.png`), { x: r.x, y: r.y - 24, width: Math.min(r.width, 520), height: r.height + 24 });
}
// The search row, its floating list and `below` px under the row.
async function shootSearch(p, dir, w, name, below) {
  const s = await p.locator("[role=dialog] .mw-search").boundingBox();
  await clip(p, path.join(dir, `prod-${w}-search-${name}.png`), { x: s.x, y: s.y, width: Math.min(s.width, 700), height: s.height + below });
}
const shootWindow = (p, dir, w, name) => p.screenshot({ path: path.join(dir, `prod-${w}-window-${name}.png`) });

async function loadPage(p) {
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
}
async function openWindow(p) {
  await p.getByRole("button", { name: "Pick on map" }).first().click();
  await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
  await settled(p);
  await p.waitForTimeout(1500);
}
// The road list, or the live road service's "didn't answer" panel: press
// its own Try again (at most 4 times) and count them (walk541).
async function roadList(p) {
  const panel = p.locator("[role=dialog] [data-testid=road-pick-panel]");
  const again = p.locator("[role=dialog] [data-testid=road-lookup-status]").getByRole("button", { name: "Try again" });
  let retries = 0;
  for (;;) {
    await panel.or(again).first().waitFor({ timeout: 120000 });
    if ((await panel.count()) > 0 || retries >= 4) break;
    retries += 1;
    await p.waitForTimeout(4000);
    await again.click();
    await p.waitForTimeout(500);
  }
  return retries;
}

// The attribution control as it stands (walk545), plus the logo's name.
function readAttrib(p) {
  return p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const map = document.querySelector("[role=dialog] .picker-map");
    const attrib = map.querySelector(".mapboxgl-ctrl-attrib");
    const btn = attrib.querySelector(".mapboxgl-ctrl-attrib-button");
    const inner = attrib.querySelector(".mapboxgl-ctrl-attrib-inner");
    const mr = map.getBoundingClientRect();
    const ar = attrib.getBoundingClientRect();
    const what = (x, y) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ""}` : "nothing"; };
    const links = [...attrib.querySelectorAll("a")].map((a) => {
      const r = a.getBoundingClientRect();
      const at = (x, y) => document.elementFromPoint(x, y) === a;
      let host = null;
      try { host = new URL(a.href).host; } catch { /* no href */ }
      return {
        text: a.textContent.trim(),
        host,
        w: r2(r.width),
        h: r2(r.height),
        centreReachesLink: r.width > 0 ? at(r.left + r.width / 2, r.top + r.height / 2) : null,
        rightEdgeReachesLink: r.width > 0 ? at(r.right - 1, r.top + r.height / 2) : null,
        rightEdgeReaches: r.width > 0 ? what(r.right - 1, r.top + r.height / 2) : null,
      };
    });
    const as0 = getComputedStyle(attrib);
    const rec = {
      mapWidth: r2(mr.width),
      compact: attrib.classList.contains("mapboxgl-compact"),
      expanded: attrib.classList.contains("mapboxgl-compact-show"),
      container: { w: r2(ar.width), h: r2(ar.height), fromMapRight: r2(mr.right - ar.right), fromMapBottom: r2(mr.bottom - ar.bottom), insideMap: ar.left >= mr.left && ar.right <= mr.right && ar.top >= mr.top && ar.bottom <= mr.bottom, visibility: as0.visibility, opacity: as0.opacity },
      innerShown: getComputedStyle(inner).display !== "none" && inner.getBoundingClientRect().width > 0,
      text: inner.textContent.replace(/\s+/g, " ").trim(),
      links,
      logo: (() => {
        const l = map.querySelector(".mapboxgl-ctrl-logo");
        if (!l) return null;
        const r = l.getBoundingClientRect();
        let host = null;
        try { host = new URL(l.href).host; } catch { /* no href */ }
        return { shown: r.width > 0 && r.height > 0, w: r2(r.width), h: r2(r.height), label: l.getAttribute("aria-label"), host, centreReaches: what(r.left + r.width / 2, r.top + r.height / 2) };
      })(),
      button: null,
    };
    const bs = getComputedStyle(btn);
    if (bs.display === "none") return rec;
    const r = btn.getBoundingClientRect();
    const as = getComputedStyle(btn, "::after");
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let reach = 0;
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    const other = {};
    for (let dy = 0; dy < 44; dy += 1) {
      for (let dx = 0; dx < 44; dx += 1) {
        const el = document.elementFromPoint(cx - 22 + dx + 0.5, cy - 22 + dy + 0.5);
        if (el && (el === btn || btn.contains(el))) {
          reach += 1;
          minX = Math.min(minX, dx); maxX = Math.max(maxX, dx); minY = Math.min(minY, dy); maxY = Math.max(maxY, dy);
        } else {
          const k = el ? `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ""}${el.tagName === "A" ? ` "${el.textContent.trim()}"` : ""}` : "nothing";
          other[k] = (other[k] ?? 0) + 1;
        }
      }
    }
    rec.button = {
      label: btn.getAttribute("aria-label"),
      box: { w: r2(r.width), h: r2(r.height), fromMapRight: r2(mr.right - r.right), fromMapBottom: r2(mr.bottom - r.bottom) },
      after: as.content === "none" ? null : { content: as.content, position: as.position, w: as.width, h: as.height, clipPath: as.clipPath },
      probes: 1936,
      reachButton: reach,
      reachBox: reach ? { w: maxX - minX + 1, h: maxY - minY + 1 } : null,
      reachOther: other,
    };
    return rec;
  });
}
// The attribution and 16 px round it, kept inside the map.
async function shootAttrib(p, w, name) {
  await p.mouse.move(4, 4);
  await drawn(p);
  const a = await p.locator("[role=dialog] .picker-map .mapboxgl-ctrl-attrib").boundingBox();
  const m = await p.locator("[role=dialog] .picker-map").boundingBox();
  const x0 = Math.max(m.x, a.x - 16);
  const y0 = Math.max(m.y, a.y - 16);
  await p.screenshot({ path: path.join(CROPS, `prod-${w}-attrib-${name}.png`), clip: { x: x0, y: y0, width: Math.min(m.x + m.width, a.x + a.width + 16) - x0, height: Math.min(m.y + m.height, a.y + a.height + 16) - y0 } });
}

for (const [w, h] of SIZES) {
  const rec = { size: `${w}x${h}`, step: "", console: [], failed: [], chunkShas: [], nonGet: [], retries: [], tokenChecks: 0, tokenHits: 0, states: {} };
  result.sizes.push(rec);
  const b = await chromium.launch();
  let p = null;
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p = await ctx.newPage();
    const reqs = { geocode: 0, roads: 0 };
    p.on("request", (r) => {
      const u = new URL(r.url());
      if (u.pathname.includes("/api/geocode")) reqs.geocode += 1;
      if (u.pathname.includes("/api/road-bearing")) reqs.roads += 1;
      // Every non-GET request to the site itself, with the step it was sent in.
      if (r.method() !== "GET" && u.host === new URL(SITE).host) rec.nonGet.push({ step: rec.step, method: r.method(), path: u.pathname });
    });
    p.on("response", async (r) => {
      const u = new URL(r.url());
      if (r.status() === 429) rec.failed.push(`${u.host} HTTP 429 ${u.pathname.slice(0, 40)}`);
      // The served bundle itself: commit shas carried by the site's own chunks.
      try {
        if (u.host !== new URL(SITE).host || !u.pathname.startsWith("/_next/static/") || !u.pathname.endsWith(".js")) return;
        const t = await r.text();
        for (const s of [HEAD_SHA, FEAT_SHA]) if (t.includes(s) && !rec.chunkShas.includes(s)) rec.chunkShas.push(s);
      } catch { /* a chunk cut off by a navigation */ }
    });
    p.on("console", (msg) => { if (msg.type() === "error") rec.console.push({ step: rec.step, text: msg.text().slice(0, 160), url: (msg.location()?.url ?? "").split("?")[0].slice(0, 120) }); });
    p.on("requestfailed", (r) => { rec.failed.push(`${new URL(r.url()).host} ${r.failure()?.errorText ?? ""}`); });
    const dlg = p.locator("[role=dialog]");
    const box = dlg.getByLabel("Address, intersection or coordinates search");
    const barLoc = dlg.locator("[data-testid=coords-bar]");
    const S = rec.states;
    const state = async (name) => { S[name] = { ...(await measure(p)), axe: await axeDialog(p) }; return S[name]; };
    // The token in the page: its HTML, its text, what it stored, its cookies.
    // Compared here, in Node; only the count is kept.
    const tokenCheck = async () => {
      const stored = await p.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage), document.cookie]));
      const cookies = JSON.stringify(await ctx.cookies());
      const hay = [await p.content(), await p.evaluate(() => document.body.innerText), stored, cookies];
      rec.tokenChecks += 1;
      for (const t of hay) if (t.includes(TOKEN) || t.toLowerCase().includes(GATE_HEADER)) rec.tokenHits += 1;
    };
    // One close: the page before the window was opened, the close, the page
    // after, the non-GET requests sent while closing, the next window's bar.
    const closeCheck = async (how, before) => {
      const barBeforeClose = await barLoc.textContent();
      const whileOpen = await behind(p);
      await tokenCheck();
      rec.step = `${rec.step} / close ${how}`;
      const mark = rec.nonGet.length;
      if (how === "Cancel") await dlg.getByRole("button", { name: "Cancel", exact: true }).click();
      else if (how === "Close") await dlg.getByRole("button", { name: "Close", exact: true }).click();
      else await p.keyboard.press("Escape");
      await p.waitForTimeout(1500);
      const after = await behind(p);
      const nonGetOnClose = rec.nonGet.slice(mark).map((r) => `${r.method} ${r.path}`);
      rec.step = `${rec.step} / next window`;
      await openWindow(p);
      const nextBar = await barLoc.textContent();
      const nextMarkers = await markers(p);
      await p.keyboard.press("Escape");
      await p.waitForTimeout(800);
      return {
        how,
        barBeforeClose,
        windowClosed: after.dialogs === 0,
        focusOn: after.focusOn,
        focusIsOpener: after.focusIsOpener,
        scrollMovedPx: Math.max(Math.abs(after.scrollX - before.scrollX), Math.abs(after.scrollY - before.scrollY)),
        docHeightChangePx: after.docHeight - before.docHeight,
        openerMovedPx: boxMove(before.opener, after.opener),
        bandMovedPx: boxMove(before.band, after.band),
        mainMovedPx: boxMove(before.main, after.main),
        bandTextSame: before.bandText === after.bandText,
        localStorageKeysChanged: changedKeys(before.localStorage, after.localStorage),
        sessionStorageKeysChanged: changedKeys(before.sessionStorage, after.sessionStorage),
        whileOpen: { scrollY: whileOpen.scrollY, openerSame: same(before.opener, whileOpen.opener), dialogs: whileOpen.dialogs },
        nonGetOnClose,
        nextWindowBar: nextBar,
        nextWindowMarkers: nextMarkers,
        dialogsAtEnd: await dlg.count(),
      };
    };
    rec.closes = [];

    // ---- W1: #543, the town notice; closed with Escape -------------------
    rec.step = "W1 load";
    await loadPage(p);
    const before1 = await behind(p);
    rec.step = "W1 open";
    await openWindow(p);
    rec.inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    rec.step = "W1 no pin";
    await state("w1NoPin");
    await shootBar(p, w, "no-pin");
    await shootSearch(p, EXTRA, w, "no-notice", 150);
    await shootWindow(p, EXTRA, w, "no-pin");

    rec.step = "W1 town search";
    const r1 = { ...reqs };
    await box.fill(TOWN);
    await box.press("Enter");
    await dlg.getByText(COARSE).waitFor({ timeout: 45000 });
    const townCamera = await settled(p);
    await drawn(p);
    await state("w1Notice");
    await shootSearch(p, CROPS, w, "town-notice", 150);
    await shootWindow(p, w === 390 ? CROPS : EXTRA, w, "town-notice");
    const townReqs = { geocode: reqs.geocode - r1.geocode, roads: reqs.roads - r1.roads };

    // Tap the map, as the notice asks: 60 px under the list's lower edge,
    // at the middle of the map (walk543).
    rec.step = "W1 tap the map";
    const mb = await dlg.locator(".picker-map").boundingBox();
    const tapDy = Math.max(120, (S.w1Notice.list?.overMapPx ?? 0) + 60);
    await p.mouse.click(mb.x + mb.width / 2, mb.y + tapDy);
    await barLoc.getByText("Pin at").waitFor({ timeout: 15000 });
    await settled(p);
    await dlg.locator("[data-testid=road-pick-panel], [data-testid=road-lookup-status]").first().waitFor({ timeout: 120000 });
    await p.waitForTimeout(2500);
    const noticeGone = (await dlg.getByText(COARSE).count()) === 0;
    await state("w1Pin");
    await shootWindow(p, EXTRA, w, "pin-after-tap");
    rec.i543 = {
      search: TOWN,
      noticeText: S.w1Notice.notice ? COARSE : null,
      notice: S.w1Notice.notice,
      list: S.w1Notice.list,
      movedNoticeVsNone: moved(S.w1NoPin, S.w1Notice, [...BOXES, "column", "dialog"]),
      scrollHeightChange: Math.abs(S.w1Notice.scrollHeight - S.w1NoPin.scrollHeight),
      townCamera,
      townRequests: townReqs,
      tap: { pxBelowMapTop: tapDy, pxBelowNotice: Math.round((tapDy - (S.w1Notice.list?.overMapPx ?? 0)) * 100) / 100, barText: S.w1Pin.barText, pinPlaced: /^Pin at /.test(S.w1Pin.barText), markers: await markers(p), noticeGone, listAfter: S.w1Pin.list ? S.w1Pin.list.text : null, roadPanel: (await dlg.locator("[data-testid=road-pick-panel]").count()) > 0, roadRequests: reqs.roads - r1.roads - townReqs.roads },
      movedPinVsNone: moved(S.w1NoPin, S.w1Pin, ["map", "search", "bar"]),
    };
    rec.step = "W1";
    rec.closes.push(await closeCheck("Escape", before1));
    save();
    await sleep(4000);

    // ---- W2: #544, the choice and round brackets; closed with Cancel -----
    rec.step = "W2 load";
    await loadPage(p);
    const before2 = await behind(p);
    rec.step = "W2 open";
    await openWindow(p);
    await state("w2NoPin");
    rec.step = "W2 the choice";
    const r2 = { ...reqs };
    await box.fill(SWAPPED);
    await box.press("Enter");
    await dlg.getByRole("button", { name: CHOICE }).waitFor({ timeout: 15000 });
    await p.waitForTimeout(1500);
    await state("w2Choice");
    const choice = await measureChoice(p);
    await shootSearch(p, CROPS, w, "did-you-mean", 110);
    await shootWindow(p, EXTRA, w, "did-you-mean");
    const choiceReqs = { geocode: reqs.geocode - r2.geocode, roads: reqs.roads - r2.roads };

    // A bracketed pair: type, Enter, the pin, the road list.
    const bracketed = async (text, key) => {
      const r0 = { ...reqs };
      const m0 = await markers(p);
      await box.fill(text);
      await box.press("Enter");
      let pinPlaced = true;
      try { await barLoc.getByText("Pin at").waitFor({ timeout: 15000 }); } catch { pinPlaced = false; }
      const camera = await settled(p);
      const roadsOnEnter = reqs.roads - r0.roads;
      const retries = pinPlaced ? await roadList(p) : 0;
      if (retries) rec.retries.push({ step: rec.step, tryAgainPresses: retries });
      await p.waitForTimeout(2500);
      const st = await state(key);
      return { typed: text, boxValue: await box.inputValue(), pinPlaced, barText: st.barText, barIsPinText: st.barText === PIN_TEXT, camera, markersBefore: m0, markers: await markers(p), geocodeRequests: reqs.geocode - r0.geocode, roadRequestsOnEnter: roadsOnEnter, lookupRetries: retries, rows: await readRows(p), listAfter: st.list ? st.list.text : null };
    };
    rec.step = "W2 round brackets";
    const round = await bracketed(ROUND, "w2Round");
    await shootBar(p, w, "pin");
    await shootSearch(p, EXTRA, w, "brackets-round", 110);
    await shootWindow(p, EXTRA, w, "brackets-round");
    rec.step = "W2";
    rec.closes.push(await closeCheck("Cancel", before2));
    save();
    await sleep(4000);

    // ---- W3: #544, square brackets; closed with the Close button ---------
    rec.step = "W3 load";
    await loadPage(p);
    const before3 = await behind(p);
    rec.step = "W3 open";
    await openWindow(p);
    const w3Bar = await barLoc.textContent();
    rec.step = "W3 square brackets";
    const square = await bracketed(SQUARE, "w3Square");
    square.barBefore = w3Bar;
    await shootSearch(p, EXTRA, w, "brackets-square", 110);
    await shootWindow(p, EXTRA, w, "brackets-square");
    rec.step = "W3";
    rec.closes.push(await closeCheck("Close", before3));
    save();
    await sleep(4000);

    // ---- W4: the control, an ordinary address search; Escape -------------
    rec.step = "W4 load";
    await loadPage(p);
    rec.step = "W4 open";
    await openWindow(p);
    rec.step = "W4 address";
    const r4 = { ...reqs };
    const geo = p.waitForResponse((r) => new URL(r.url()).pathname.includes("/api/geocode"), { timeout: 60000 }).catch(() => null);
    await box.fill(ADDRESS);
    await box.press("Enter");
    const gr = await geo;
    let pin4 = true;
    try { await barLoc.getByText("Pin at").waitFor({ timeout: 20000 }); } catch { pin4 = false; }
    const cam4 = await settled(p);
    const retries4 = pin4 ? await roadList(p) : 0;
    if (retries4) rec.retries.push({ step: rec.step, tryAgainPresses: retries4 });
    await p.waitForTimeout(5000);
    await state("w4Address");
    rec.address = { text: ADDRESS, geocodeRequests: reqs.geocode - r4.geocode, geocodeStatus: gr ? gr.status() : null, geocodeMethod: gr ? gr.request().method() : null, pinPlaced: pin4, camera: cam4, barText: S.w4Address.barText, listAfter: S.w4Address.list ? S.w4Address.list.text : null, rows: await readRows(p), lookupRetries: retries4 };
    await shootWindow(p, EXTRA, w, "address");
    await tokenCheck();
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);
    rec.address.dialogsAfterEscape = await dlg.count();
    save();
    await sleep(4000);

    // ---- W5: #545, Mapbox's attribution; Escape --------------------------
    rec.step = "W5 load";
    await loadPage(p);
    rec.step = "W5 open";
    await openWindow(p);
    const attrib = { asOpened: await readAttrib(p) };
    rec.attrib = attrib;
    if (attrib.asOpened.button) {
      const btn = dlg.locator(".picker-map .mapboxgl-ctrl-attrib-button");
      const isExpanded = () => p.evaluate(() => document.querySelector("[role=dialog] .picker-map .mapboxgl-ctrl-attrib").classList.contains("mapboxgl-compact-show"));
      rec.step = "W5 attribution closed";
      if (await isExpanded()) await btn.click();
      await p.mouse.move(4, 4);
      await p.waitForTimeout(400);
      attrib.collapsed = await readAttrib(p);
      await state("w5AttribClosed");
      await shootAttrib(p, w, "closed");
      // A real click 17 px up and left of the button's centre: inside the
      // 44 x 44 square, outside a 24 x 24 box (walk545).
      rec.step = "W5 click off centre";
      const bb = await btn.boundingBox();
      const off = bb.width < 44 ? 17 : 0;
      await p.mouse.click(bb.x + bb.width / 2 - off, bb.y + bb.height / 2 - off);
      await p.waitForTimeout(1200);
      attrib.clickOffCentre = { pxUpAndLeftOfCentre: off, opensAttribution: await isExpanded(), barAfter: await barLoc.textContent() };
      if (!(await isExpanded())) {
        // The click went to the map and placed a pin; wait for it to rest.
        await settled(p);
        await p.waitForTimeout(4000);
        await btn.click();
      }
      rec.step = "W5 attribution open";
      await settled(p);
      await p.mouse.move(4, 4);
      await p.waitForTimeout(600);
      attrib.expanded = await readAttrib(p);
      await state("w5AttribOpen");
      await shootAttrib(p, w, "open");
      await shootWindow(p, EXTRA, w, "attrib-open");
      rec.step = "W5 click off centre again";
      const bb2 = await btn.boundingBox();
      await p.mouse.click(bb2.x + bb2.width / 2 - off, bb2.y + bb2.height / 2 + off);
      await p.waitForTimeout(800);
      attrib.clickOffCentreAgain = { pxDownAndLeftOfCentre: off, closesAttribution: !(await isExpanded()), barAfter: await barLoc.textContent() };
    } else {
      rec.step = "W5 attribution full line";
      await state("w5AttribFull");
      await shootAttrib(p, w, "full-line");
    }
    await tokenCheck();
    await p.keyboard.press("Escape");
    await p.waitForTimeout(800);
    attrib.dialogsAfterEscape = await dlg.count();

    // ---- The size's summary and verdicts ---------------------------------
    rec.step = "summary";
    const keys = Object.keys(S);
    rec.axe = Object.fromEntries(keys.map((k) => [k, S[k].axe]));
    rec.axeRuns = keys.length;
    rec.axeViolations = keys.reduce((n, k) => n + S[k].axe.length, 0);
    const all = keys.flatMap((k) => S[k].controls);
    rec.controlsMeasured = all.length;
    rec.minControlW = Math.min(...all.map((c) => c.w));
    rec.minControlH = Math.min(...all.map((c) => c.h));
    const uniq = (a) => [...new Set(a)];
    rec.boxUnder44 = uniq(keys.flatMap((k) => S[k].smallBox.map((u) => `${u.what} box ${u.w}x${u.h}: its 44x44 square reaches it at ${u.reachControl}/${u.probes}, a Mapbox mark at ${u.reachMapboxMark}`)));
    // The open-line notch (mission report, question 5; the local walk's 1,816
    // of 1,936): with Mapbox's line open at 1198, 120 points of the toggle's
    // square are left to the line and its last link.  Set apart by name, not
    // counted as a control under 44, and only when the numbers are exactly
    // the local walk's.
    const isNotch = (k, u) => k === "w5AttribOpen" && u.what === 'button "Toggle attribution"' && u.reachControl === 1816 && u.reachMapboxMark === 90;
    const u44 = (u) => `${u.what} ${u.w}x${u.h} (reaches it at ${u.reachControl}/${u.probes}, a Mapbox link at ${u.reachMapboxMark})`;
    rec.under44 = uniq(keys.flatMap((k) => S[k].under44.filter((u) => !isNotch(k, u)).map(u44)));
    rec.openLineNotch = uniq(keys.flatMap((k) => S[k].under44.filter((u) => isNotch(k, u)).map(u44)));
    rec.mapboxExceptions = uniq(keys.flatMap((k) => S[k].mapboxExceptions.map((u) => `${u.what} ${u.w}x${u.h}`)));
    rec.barBoxes = Object.fromEntries(keys.map((k) => [k, S[k].bar]));
    rec.barHeights = keys.map((k) => S[k].bar.h);
    rec.barControls = keys.map((k) => S[k].barControls);
    rec.marks = Object.fromEntries(keys.map((k) => [k, { barText: S[k].barText, ...S[k].mark }]));
    rec.requests = { ...reqs };
    const nonGetByPath = {};
    for (const r of rec.nonGet) nonGetByPath[`${r.method} ${r.path}`] = (nonGetByPath[`${r.method} ${r.path}`] ?? 0) + 1;
    rec.nonGetByPath = nonGetByPath;

    rec.i544 = {
      choice,
      choiceRequests: choiceReqs,
      movedChoiceVsNone: moved(S.w2NoPin, S.w2Choice, [...BOXES, "column", "dialog"]),
      round,
      square,
      movedRoundVsNone: moved(S.w2NoPin, S.w2Round, ["map", "search", "bar"]),
    };
    const noPinKeys = keys.filter((k) => S[k].barText === NO_PIN_TEXT);
    const pinKeys = keys.filter((k) => /^Pin at /.test(S[k].barText));
    rec.i545 = {
      noPinStates: noPinKeys.length,
      pinStates: pinKeys.length,
      ringInEveryNoPinState: noPinKeys.every((k) => S[k].mark.isRing && S[k].mark.dataPin !== "true"),
      dotInEveryPinState: pinKeys.every((k) => S[k].mark.isDot && S[k].mark.dataPin === "true"),
      ring: S.w2NoPin.mark,
      dot: S.w2Round.mark,
      tokens: S.w2NoPin.tokens,
      barNoPin: S.w2NoPin.bar,
      barPin: S.w2Round.bar,
      barMovedPx: boxMove(S.w2NoPin.bar, S.w2Round.bar),
      markMovedPx: boxMove(S.w2NoPin.mark.box, S.w2Round.mark.box),
      barHeightsAll44: rec.barHeights.every((x) => x === 44),
    };

    // PASS/FAIL, each with the checks that failed.
    const verdict = (checks) => { const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k); return { pass: failed.length === 0, failed, checks }; };
    const i3 = rec.i543;
    rec.verdict543 = verdict({
      noticeShown: !!i3.notice?.shown,
      noticeInFloatingList: !!i3.notice?.inList && i3.list?.position === "absolute",
      noticeLiesOverTheMap: (i3.list?.overMapPx ?? 0) > 0 && !!i3.notice?.centreReachesNotice,
      map0px: i3.movedNoticeVsNone.map === 0,
      searchRow0px: i3.movedNoticeVsNone.search === 0,
      rightPanel0px: i3.movedNoticeVsNone.rail === 0,
      bar0px: i3.movedNoticeVsNone.bar === 0,
      tapPlacesPin: i3.tap.pinPlaced && i3.tap.markers === 1,
      tapClearsNotice: i3.tap.noticeGone,
    });
    const i4 = rec.i544;
    rec.verdict544 = verdict({
      roundPlacesPin: round.barIsPinText && round.markers === 1 && round.camera?.lat === 39.7401 && round.camera?.lng === -104.9811,
      roundZeroGeocode: round.geocodeRequests === 0,
      squarePlacesPin: square.barIsPinText && square.markers === 1 && square.camera?.lat === 39.7401 && square.camera?.lng === -104.9811,
      squareZeroGeocode: square.geocodeRequests === 0,
      addressControlOneGeocode: rec.address.geocodeRequests === 1,
      choiceText: i4.choice.text === CHOICE,
      numbersOnOneLine: i4.choice.pair?.lines === 1 && i4.choice.pair?.text === "39.7401, -104.9811?",
      choiceAtLeast44High: i4.choice.button.h >= 44,
      choiceZeroGeocode: choiceReqs.geocode === 0,
    });
    const i5 = rec.i545;
    const A = rec.attrib;
    const mapboxOwn = (s) => /Mapbox/.test(s.text) && s.links.some((l) => /Mapbox/.test(l.text) && /(^|\.)mapbox\.com$/.test(l.host ?? "")) && !!s.logo?.shown && /mapbox/i.test(s.logo.label ?? "");
    const attribChecks = A.asOpened.button
      ? {
          attributionShownWhenOpen: A.expanded.innerShown && A.expanded.container.insideMap && A.expanded.links.every((l) => l.centreReachesLink),
          attributionReadsAsMapbox: mapboxOwn(A.expanded),
          toggleShownWhenClosed: A.collapsed.button !== null && !!A.collapsed.logo?.shown,
          tapAreaClosedFull44: A.collapsed.button.reachButton === 1936,
          // Open: at 1198 the ruled 6 x 20 px notch (120 points) goes to Mapbox's own line.
          tapAreaOpen: A.expanded.button.reachButton === 1936 || (A.expanded.button.reachButton === 1816 && Object.keys(A.expanded.button.reachOther).every((k) => /^(a|div)\.?/.test(k))),
          offCentreTapOpens: A.clickOffCentre.opensAttribution,
          offCentreTapCloses: A.clickOffCentreAgain.closesAttribution,
        }
      : {
          attributionShown: A.asOpened.innerShown && A.asOpened.container.insideMap && A.asOpened.links.every((l) => l.centreReachesLink),
          attributionReadsAsMapbox: mapboxOwn(A.asOpened),
        };
    const closeOk = (c) => c.windowClosed && c.focusIsOpener && c.scrollMovedPx === 0 && c.docHeightChangePx === 0 && c.openerMovedPx === 0 && c.bandMovedPx === 0 && c.mainMovedPx === 0 && c.nonGetOnClose.length === 0 && c.nextWindowBar === NO_PIN_TEXT && c.nextWindowMarkers === 0;
    rec.verdict545 = verdict({
      ringWithNoPin: i5.noPinStates > 0 && i5.ringInEveryNoPinState,
      dotWithPin: i5.pinStates > 0 && i5.dotInEveryPinState,
      bar44: i5.barHeightsAll44,
      barSameBoxBothStates: i5.barMovedPx === 0,
      ...attribChecks,
      cancelCloses: closeOk(rec.closes.find((c) => c.how === "Cancel")),
      closeButtonCloses: closeOk(rec.closes.find((c) => c.how === "Close")),
      escapeCloses: closeOk(rec.closes.find((c) => c.how === "Escape")),
    });
    rec.step = "done";
  } catch (e) {
    rec.error = `at ${rec.step}: ${oneLine(e).slice(0, 300)}`;
    if (p) await p.screenshot({ path: path.join(EXTRA, `prod-${w}-error.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
  rec.consoleErrors = rec.console.length;
  rec.consoleTelemetry = rec.console.filter((c) => /events\.mapbox\.com/.test(`${c.text} ${c.url}`)).length;
  const fails = {};
  for (const f of rec.failed) fails[f] = (fails[f] ?? 0) + 1;
  rec.failedByKind = fails;
  rec.failedTotal = rec.failed.length;
  rec.http429 = rec.failed.filter((f) => / HTTP 429 /.test(f)).length;
  delete rec.failed;
  if (!rec.error) {
    const verdict = (checks) => { const failed = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k); return { pass: failed.length === 0, failed, checks }; };
    rec.verdictCommon = verdict({
      axeZero: rec.axeViolations === 0,
      noControlUnder44: rec.under44.length === 0,
      noConsoleErrors: rec.consoleErrors - rec.consoleTelemetry === 0,
      tokenNotInPage: rec.tokenChecks > 0 && rec.tokenHits === 0,
      servedChunksCarryTheBuild: rec.chunkShas.length > 0,
      // The window's three reads, each a POST: the geocoder, the road lookup
      // and the corridor overlay ("the corridor-geometry read",
      // app/api/corridor-map/route.ts:16).  Anything else fails this.
      onlyReadPosts: Object.keys(rec.nonGetByPath).every((k) => ["POST /api/geocode", "POST /api/road-bearing", "POST /api/render/corridor-geometry"].includes(k)),
    });
  }
  save();
  const v = (x) => (x ? (x.pass ? "PASS" : `FAIL [${x.failed.join(", ")}]`) : "not reached");
  console.log(`${rec.size}: ${rec.error ?? "ok"} | #543 ${v(rec.verdict543)} | #544 ${v(rec.verdict544)} | #545 ${v(rec.verdict545)} | common ${v(rec.verdictCommon)}`);
  if (rec.i543) console.log(`  #543: notice shown ${rec.i543.notice?.shown} in list ${rec.i543.notice?.inList} (${rec.i543.list?.position}, ${rec.i543.list?.w}x${rec.i543.list?.h}, over the map ${rec.i543.list?.overMapPx}) lines ${rec.i543.notice?.lines} | moved ${JSON.stringify(rec.i543.movedNoticeVsNone)} | town requests ${JSON.stringify(rec.i543.townRequests)} zoom ${rec.i543.townCamera?.zoom} | tap ${rec.i543.tap.pxBelowNotice} px under the notice: "${rec.i543.tap.barText}" markers ${rec.i543.tap.markers} notice gone ${rec.i543.tap.noticeGone}`);
  if (rec.i544) {
    const c = rec.i544.choice;
    console.log(`  #544: choice "${c.text}" ${c.button.w}x${c.button.h} lines ${c.choiceLines}, numbers "${c.pair?.text}" lines ${c.pair?.lines} (${c.pair?.whiteSpace}), sentence ${c.sentenceOnOneLine} in ${c.roomForText} | choice requests ${JSON.stringify(rec.i544.choiceRequests)} moved ${JSON.stringify(rec.i544.movedChoiceVsNone)}`);
    for (const f of [rec.i544.round, rec.i544.square]) console.log(`    ${f.typed}: bar "${f.barText}" markers ${f.markers} centre ${f.camera?.lat}, ${f.camera?.lng} zoom ${f.camera?.zoom} | geocode ${f.geocodeRequests} roads on Enter ${f.roadRequestsOnEnter} retries ${f.lookupRetries} | rows ${f.rows.map((r) => `[${r}]`).join(" ")}`);
    console.log(`    address: geocode ${rec.address.geocodeRequests} (${rec.address.geocodeMethod} ${rec.address.geocodeStatus}) bar "${rec.address.barText}" retries ${rec.address.lookupRetries}`);
  }
  if (rec.i545) {
    const i = rec.i545;
    console.log(`  #545: ring ${i.ringInEveryNoPinState} in ${i.noPinStates} no-pin states (fill ${i.ring.background}, border ${i.ring.borderWidth} ${i.ring.borderStyle} ${i.ring.borderColor}, --ink-faint ${i.tokens.inkFaint}, contrast ${i.ring.outlineContrast}) | dot ${i.dotInEveryPinState} in ${i.pinStates} pin states (fill ${i.dot.background}, border ${i.dot.borderWidth}, --dim ${i.tokens.dim}, contrast ${i.dot.fillContrast}) | bar ${JSON.stringify(i.barNoPin)} moved ${i.barMovedPx} mark moved ${i.markMovedPx} | bar heights ${rec.barHeights.join("/")}`);
    for (const c of rec.closes) console.log(`    close ${c.how}: bar "${c.barBeforeClose}" closed ${c.windowClosed} focus ${c.focusOn} (opener ${c.focusIsOpener}) scroll ${c.scrollMovedPx} height ${c.docHeightChangePx} opener ${c.openerMovedPx} band ${c.bandMovedPx} main ${c.mainMovedPx} | non-GET on close: ${c.nonGetOnClose.length ? c.nonGetOnClose.join(", ") : "none"} | stored keys changed local [${c.localStorageKeysChanged.join(", ")}] session [${c.sessionStorageKeysChanged.join(", ")}] | next bar "${c.nextWindowBar}"`);
    const line = (t, s) => `    attribution ${t}: map ${s.mapWidth}, compact ${s.compact}, open ${s.expanded}, text shown ${s.innerShown} "${s.text}" | links ${s.links.map((l) => `${l.text} ${l.w}x${l.h} ${l.host} centre ${l.centreReachesLink}`).join("; ")} | logo ${s.logo ? `${s.logo.w}x${s.logo.h} "${s.logo.label}" shown ${s.logo.shown}` : "none"} | button ${s.button ? `"${s.button.label}" ${s.button.box.w}x${s.button.box.h}, tap area ${s.button.reachButton}/${s.button.probes} (span ${s.button.reachBox ? `${s.button.reachBox.w}x${s.button.reachBox.h}` : 0}), the rest ${JSON.stringify(s.button.reachOther)}` : "not shown"}`;
    const A = rec.attrib;
    console.log(line("as opened", A.asOpened));
    if (A.collapsed) {
      console.log(line("closed", A.collapsed));
      console.log(line("open", A.expanded));
      console.log(`    click ${A.clickOffCentre.pxUpAndLeftOfCentre} px off centre opens ${A.clickOffCentre.opensAttribution}, again closes ${A.clickOffCentreAgain.closesAttribution}`);
    }
  }
  console.log(`  axe ${rec.axeViolations} in ${rec.axeRuns} runs | controls ${rec.controlsMeasured} min ${rec.minControlW}x${rec.minControlH} | under 44: ${rec.under44?.length ? rec.under44.join("; ") : "none"} | open-line notch: ${rec.openLineNotch?.length ? rec.openLineNotch.join("; ") : "none"} | box under 44: ${rec.boxUnder44?.length ? rec.boxUnder44.join("; ") : "none"} | Mapbox exception: ${rec.mapboxExceptions?.join("; ")} | console ${rec.consoleErrors} (telemetry ${rec.consoleTelemetry}) | failed ${JSON.stringify(rec.failedByKind)} | non-GET ${JSON.stringify(rec.nonGetByPath)} | retries ${JSON.stringify(rec.retries)} | token checks ${rec.tokenChecks} hits ${rec.tokenHits} | chunk shas ${rec.chunkShas.map((s) => s.slice(0, 7)).join(",")}`);
  await sleep(20000); // the live map route's 40 requests a minute
}
result.finishedAt = new Date().toISOString();
save();
