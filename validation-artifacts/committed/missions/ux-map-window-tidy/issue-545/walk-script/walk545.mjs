// #545 local walk: the bar's mark with no pin and with a pin, Mapbox's
// "Toggle attribution" button's tap area, and closing the window with
// Cancel, with Close and with Escape, at each size.  Adapted from #544's
// walk544.mjs (the same boxes, axe and camera code).
//   node walk545.mjs <worktree> <crops dir> <extra dir> <site url> <env file>
// The env file gives GATE_BYPASS_TOKEN when the shell has none (read raw,
// never printed).
//
// Four windows per size, each opened from /sandbox with "Pick on map".
//   A: no pin (measure, axe, crop) -> search "39.7401, -104.9811" (a pin:
//      measure, axe, crop) -> Cancel.
//   B: a pin the same way -> the Close button.
//   C: a pin the same way -> Escape (the path #541's production check used).
//   D: no pin -> the attribution, collapsed and expanded: the button's box,
//      its tap area probed point by point, a click 17 px off its centre,
//      and a pixel comparison with the ::after on, off and on again.
// The 44 px check: a control counts as under 44 when its box is under 44
// either way AND some point of the 44 x 44 square centred on it reaches
// neither the control nor one of Mapbox's marks.  Mapbox's logo and
// attribution links are #505's exception, chosen by selector and listed.
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const [WT, CROPS, EXTRA, SITE, ENVFILE] = process.argv.slice(2);
if (!process.env.GATE_BYPASS_TOKEN && ENVFILE) {
  const m = fs.readFileSync(ENVFILE, "utf8").match(/^\s*GATE_BYPASS_TOKEN\s*=\s*["']?([^"'\r\n]*)["']?\s*$/m);
  if (m) process.env.GATE_BYPASS_TOKEN = m[1];
}
const require = createRequire(path.join(WT, "scripts", "gate.cjs"));
const { newGatedContext, guardOutput, oneLine } = require("./gate.cjs");
guardOutput();
const requireMain = createRequire("C:/Users/rtmak/Documents/traffic-control-tool/package.json");
const { chromium } = requireMain("playwright");
const AXE = fs.readFileSync(path.join(WT, "conestruct/site/node_modules/axe-core/axe.min.js"), "utf8");
const SIZES = [[1440, 900], [1198, 930], [390, 844]];
const COORDS = "39.7401, -104.9811";
const PIN_TEXT = "Pin at 39.7401, -104.9811";
const NO_PIN_TEXT = "No pin yet";
const EXCEPTION_REASON = "#505 (Ryan, 2026-11-10): Mapbox's logo and attribution links are Mapbox's, placed under its terms, not controls we design";
fs.mkdirSync(CROPS, { recursive: true });
fs.mkdirSync(EXTRA, { recursive: true });
const out = [];
let step = "";

async function axeDialog(p) {
  if (!(await p.evaluate(() => !!window.axe))) await p.addScriptTag({ content: AXE });
  return p.evaluate(async () => {
    const r = await window.axe.run({ include: [["[role=dialog]"]] }, { resultTypes: ["violations"] });
    return r.violations.map((v) => `${v.id}(${v.nodes.length})`);
  });
}

// WCAG relative luminance and contrast, from two computed colours.
function rgba(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
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

// Boxes in the dialog's own frame: viewport rect plus the body scroller's
// scrollTop (below md the body scrolls).
async function measure(p) {
  const m = await p.evaluate(() => {
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
    const mark = bar.querySelector(".mw-cbar-dot");
    const ms = getComputedStyle(mark);
    const bs = getComputedStyle(bar);
    const name = (c) => (c.tagName === "INPUT" ? "search box" : `${c.tagName.toLowerCase()} "${(c.getAttribute("aria-label") || c.textContent || c.getAttribute("title") || "").trim().slice(0, 60)}"`);
    const isMapboxMark = (c) => !!c && (c.classList.contains("mapboxgl-ctrl-logo") || (c.tagName === "A" && !!c.closest(".mapboxgl-ctrl-attrib")));
    const shown = [...dlg.querySelectorAll("button, input, a[href], select, [role=radio], [role=button]")]
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
    return {
      map: box(dlg.querySelector(".picker-map, .mw-map-off")),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      search: box(dlg.querySelector(".mw-search")),
      column: box(col),
      dialog: { w: r2(d.width), h: r2(d.height) },
      barText: bar.textContent,
      barGround: bs.backgroundColor,
      barControls: bar.querySelectorAll("button, input, form, a, select, textarea, [tabindex], [role=button]").length,
      mark: {
        box: box(mark),
        dataPin: mark.getAttribute("data-pin"),
        background: ms.backgroundColor,
        border: `${ms.borderTopWidth} ${ms.borderTopStyle} ${ms.borderTopColor}`,
        borderWidth: ms.borderTopWidth,
        borderStyle: ms.borderTopStyle,
        borderColor: ms.borderTopColor,
        radius: ms.borderTopLeftRadius,
        boxSizing: ms.boxSizing,
        ariaHidden: mark.getAttribute("aria-hidden"),
      },
      tokens: {
        inkFaint: getComputedStyle(mark).getPropertyValue("--ink-faint").trim(),
        dim: getComputedStyle(mark).getPropertyValue("--dim").trim(),
        daGround: getComputedStyle(mark).getPropertyValue("--da-ground").trim(),
      },
      font: bs.fontFamily.split(",")[0].replace(/["']/g, ""),
      countedControls: counted.length,
      smallBox,
      under44: smallBox.filter((s) => s.reachControl + s.reachMapboxMark < s.probes),
      mapboxExceptions: exceptions,
      scrollTop: scroller.scrollTop,
    };
  });
  const hollow = rgba(m.mark.background)?.a === 0;
  m.mark.hollow = hollow;
  m.mark.outlineContrast = m.mark.borderStyle !== "none" && parseFloat(m.mark.borderWidth) > 0 ? contrast(m.mark.borderColor, m.barGround) : null;
  m.mark.fillContrast = hollow ? null : contrast(m.mark.background, m.barGround);
  return m;
}

function readCamera(p) {
  return p.evaluate(() => {
    const el = document.querySelector("[role=dialog] .picker-map");
    if (!el) return null;
    const key = Object.keys(el).find((k) => k.startsWith("__reactFiber$"));
    let f = key ? el[key] : null;
    for (; f; f = f.return) {
      for (let h = f.memoizedState; h && typeof h === "object" && "next" in h; h = h.next) {
        const m = h.memoizedState?.current;
        if (m && typeof m.getZoom === "function" && typeof m.getCenter === "function") {
          return { zoom: Math.round(m.getZoom() * 100) / 100, moving: m.isMoving(), drawn: m.loaded() && m.areTilesLoaded() };
        }
      }
    }
    return null;
  });
}
async function settled(p) {
  for (let i = 0; i < 60; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving) return c;
  }
  return readCamera(p);
}

// The map at rest with every tile drawn, so two shots a moment apart match.
async function drawn(p) {
  for (let i = 0; i < 80; i += 1) {
    await p.waitForTimeout(250);
    const c = await readCamera(p);
    if (c && !c.moving && c.drawn) break;
  }
  await p.waitForTimeout(1500);
}

// The bar, with 24 px of the map above it, cut to 520 px wide.
async function shootBar(p, w, name) {
  const b = await p.locator("[role=dialog] [data-testid=coords-bar]").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(CROPS, `${w}-${name}.png`), clip: { x: Math.max(0, b.x), y: b.y - 24, width: Math.min(520, b.width, vw - b.x), height: b.height + 24 } });
}
// The mark alone, with 6 px round it (a 22 x 22 crop).
async function shootMark(p, w, name) {
  const b = await p.locator("[role=dialog] [data-testid=coords-bar] .mw-cbar-dot").boundingBox();
  await p.screenshot({ path: path.join(CROPS, `${w}-${name}.png`), clip: { x: b.x - 6, y: b.y - 6, width: b.width + 12, height: b.height + 12 }});
}

// The page behind the window.
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
function compareBehind(before, after) {
  return {
    windowClosed: after.dialogs === 0,
    focusOn: after.focusOn,
    focusIsOpener: after.focusIsOpener,
    scrollMovedPx: Math.max(Math.abs(after.scrollX - before.scrollX), Math.abs(after.scrollY - before.scrollY)),
    docHeightChangePx: after.docHeight - before.docHeight,
    openerBoxSame: same(before.opener, after.opener),
    bandBoxSame: same(before.band, after.band),
    mainBoxSame: same(before.main, after.main),
    bandTextSame: before.bandText === after.bandText,
    localStorageKeysChanged: changedKeys(before.localStorage, after.localStorage),
    sessionStorageKeysChanged: changedKeys(before.sessionStorage, after.sessionStorage),
  };
}

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
async function placePin(p, dlg) {
  const box = dlg.getByLabel("Address, intersection or coordinates search");
  await box.fill(COORDS);
  await box.press("Enter");
  await dlg.locator("[data-testid=coords-bar]").getByText("Pin at").waitFor({ timeout: 15000 });
  await settled(p);
  await dlg.locator("[data-testid=road-pick-panel], [data-testid=road-lookup-status]").first().waitFor({ timeout: 120000 });
  await p.waitForTimeout(2500);
}

// One close path: the page before the window, a pin placed in it, the
// close, the page after, and the next window's bar.
async function closePath(p, dlg, sent, how, alreadyOpenWithPin, beforeOpen) {
  const before = beforeOpen ?? (await behind(p));
  if (!alreadyOpenWithPin) {
    await openWindow(p);
    await placePin(p, dlg);
  }
  const barBeforeClose = await dlg.locator("[data-testid=coords-bar]").textContent();
  const whileOpen = await behind(p);
  sent.length = 0;
  if (how === "Cancel") await dlg.getByRole("button", { name: "Cancel", exact: true }).click();
  else if (how === "Close") await dlg.getByRole("button", { name: "Close", exact: true }).click();
  else await p.keyboard.press("Escape");
  await p.waitForTimeout(1500);
  const after = await behind(p);
  const requestsOnClose = [...sent];
  // The next window: nothing was saved if its bar has no pin.
  await openWindow(p);
  const nextBar = await dlg.locator("[data-testid=coords-bar]").textContent();
  await p.keyboard.press("Escape");
  await p.waitForTimeout(800);
  return {
    how,
    barBeforeClose,
    ...compareBehind(before, after),
    whileOpen: { scrollY: whileOpen.scrollY, openerBoxSame: same(before.opener, whileOpen.opener), dialogs: whileOpen.dialogs },
    requestsOnClose,
    nextWindowBar: nextBar,
    before,
    after,
  };
}

// The attribution control, as it stands.
function readAttrib(p) {
  return p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const map = document.querySelector("[role=dialog] .picker-map");
    const attrib = map.querySelector(".mapboxgl-ctrl-attrib");
    const btn = attrib.querySelector(".mapboxgl-ctrl-attrib-button");
    const inner = attrib.querySelector(".mapboxgl-ctrl-attrib-inner");
    const mr = map.getBoundingClientRect();
    const ar = attrib.getBoundingClientRect();
    const links = [...attrib.querySelectorAll("a")].map((a) => {
      const r = a.getBoundingClientRect();
      const at = (x, y) => document.elementFromPoint(x, y) === a;
      const what = (x, y) => { const el = document.elementFromPoint(x, y); return el ? `${el.tagName.toLowerCase()}${el.classList[0] ? `.${el.classList[0]}` : ""}` : "nothing"; };
      return {
        text: a.textContent.trim(),
        href: a.getAttribute("href")?.split("?")[0].split("#")[0] ?? null,
        w: r2(r.width),
        h: r2(r.height),
        centreReachesLink: r.width > 0 ? at(r.left + r.width / 2, r.top + r.height / 2) : null,
        rightEdgeReachesLink: r.width > 0 ? at(r.right - 1, r.top + r.height / 2) : null,
        rightEdgeReaches: r.width > 0 ? what(r.right - 1, r.top + r.height / 2) : null,
        right: r2(r.right),
      };
    });
    const rec = {
      mapWidth: r2(mr.width),
      compact: attrib.classList.contains("mapboxgl-compact"),
      expanded: attrib.classList.contains("mapboxgl-compact-show"),
      container: { w: r2(ar.width), h: r2(ar.height), fromMapRight: r2(mr.right - ar.right), fromMapBottom: r2(mr.bottom - ar.bottom) },
      innerShown: getComputedStyle(inner).display !== "none",
      text: inner.textContent.replace(/\s+/g, " ").trim(),
      links,
      logo: (() => { const l = map.querySelector(".mapboxgl-ctrl-logo"); const r = l?.getBoundingClientRect(); return l ? { shown: r.width > 0 && r.height > 0, w: r2(r.width), h: r2(r.height) } : null; })(),
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
      background: bs.backgroundColor,
      backgroundSize: bs.backgroundSize,
      after: as.content === "none" ? null : { content: as.content, position: as.position, w: as.width, h: as.height, background: as.backgroundColor },
      probes: 1936,
      reachButton: reach,
      reachBox: reach ? { w: maxX - minX + 1, h: maxY - minY + 1 } : null,
      reachOther: other,
    };
    return rec;
  });
}

// Pixels that differ between two PNGs, counted in a blank page.
// `pill` (x, y, w, h, radius, in the image's own pixels) is the attribution's
// box: pixels inside it, its rounded corners' squares left out, are counted
// on their own, since the map shows round the pill and through its corners.
async function diffPixels(page, a, b, pill) {
  return page.evaluate(async ([A, B, P]) => {
    const load = (s) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:image/png;base64,${s}`; });
    const [ia, ib] = await Promise.all([load(A), load(B)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return { sizeDiffers: true };
    const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data; };
    const da = px(ia); const db = px(ib);
    let n = 0;
    let inPill = 0;
    let pillPixels = 0;
    const x1 = Math.ceil(P.x); const y1 = Math.ceil(P.y); const x2 = Math.floor(P.x + P.w); const y2 = Math.floor(P.y + P.h);
    const rad = Math.ceil(P.radius);
    for (let y = 0; y < ia.height; y += 1) {
      for (let x = 0; x < ia.width; x += 1) {
        const i = (y * ia.width + x) * 4;
        const d = da[i] !== db[i] || da[i + 1] !== db[i + 1] || da[i + 2] !== db[i + 2] || da[i + 3] !== db[i + 3];
        if (d) n += 1;
        const inside = x >= x1 && x < x2 && y >= y1 && y < y2;
        const corner = (x < x1 + rad || x >= x2 - rad) && (y < y1 + rad || y >= y2 - rad);
        if (inside && !corner) { pillPixels += 1; if (d) inPill += 1; }
      }
    }
    return { pixels: ia.width * ia.height, differ: n, pillPixels, differInPill: inPill };
  }, [a.toString("base64"), b.toString("base64"), pill]);
}

// The attribution and 16 px round it: with the page as built, with the
// button's ::after switched off, and as built again (the control: what
// differs between two shots when nothing changed).
async function shootAttrib(p, blank, w, name) {
  await p.mouse.move(4, 4);
  await drawn(p);
  const a = await p.locator("[role=dialog] .picker-map .mapboxgl-ctrl-attrib").boundingBox();
  const m = await p.locator("[role=dialog] .picker-map").boundingBox();
  const x0 = Math.max(m.x, a.x - 16);
  const y0 = Math.max(m.y, a.y - 16);
  const clip = { x: x0, y: y0, width: Math.min(m.x + m.width, a.x + a.width + 16) - x0, height: Math.min(m.y + m.height, a.y + a.height + 16) - y0 };
  const radius = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector("[role=dialog] .picker-map .mapboxgl-ctrl-attrib")).borderTopLeftRadius) || 0);
  const pill = { x: a.x - x0, y: a.y - y0, w: a.width, h: a.height, radius };
  const file = path.join(CROPS, `${w}-${name}.png`);
  const built = await p.screenshot({ path: file, clip });
  const off = await p.addStyleTag({ content: ".picker-map .mapboxgl-ctrl-attrib-button::after { content: none !important; }" });
  await p.waitForTimeout(200);
  const without = await p.screenshot({ path: path.join(EXTRA, `${w}-${name}-rule-off.png`), clip });
  await off.evaluate((el) => el.remove());
  await p.waitForTimeout(200);
  const again = await p.screenshot({ clip });
  return {
    crop: `${w}-${name}.png`,
    clip: { w: Math.round(clip.width * 100) / 100, h: Math.round(clip.height * 100) / 100 },
    ruleOnVsOff: await diffPixels(blank, built, without, pill),
    ruleOnVsOnAgain: await diffPixels(blank, built, again, pill),
  };
}

for (const [w, h] of SIZES) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const blank = await ctx.newPage();
    await p.bringToFront();
    const sent = [];
    p.on("request", (r) => {
      if (r.method() === "GET" || !r.url().startsWith(SITE)) return;
      sent.push(`${r.method()} ${new URL(r.url()).pathname}`);
    });
    const dlg = p.locator("[role=dialog]");

    // ---- window A: the bar, then Cancel ----
    step = "A0 load";
    await loadPage(p);
    const beforeA = await behind(p);
    step = "A1 open, no pin";
    await openWindow(p);
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    const states = {};
    states.noPin = { ...(await measure(p)), axe: await axeDialog(p) };
    await p.mouse.move(4, 4);
    await shootBar(p, w, "bar-no-pin");
    await shootMark(p, w, "mark-no-pin");
    await p.screenshot({ path: path.join(CROPS, `${w}-window-no-pin.png`) });

    step = "A2 pin";
    await placePin(p, dlg);
    states.pin = { ...(await measure(p)), axe: await axeDialog(p) };
    await p.mouse.move(4, 4);
    await shootBar(p, w, "bar-pin");
    await shootMark(p, w, "mark-pin");
    await p.screenshot({ path: path.join(CROPS, `${w}-window-pin.png`) });

    step = "A3 Cancel";
    const closes = [];
    closes.push(await closePath(p, dlg, sent, "Cancel", true, beforeA));
    step = "B Close";
    closes.push(await closePath(p, dlg, sent, "Close", false, null));
    step = "C Escape";
    closes.push(await closePath(p, dlg, sent, "Escape", false, null));

    // ---- window D: the attribution ----
    step = "D0 open";
    await openWindow(p);
    const attrib = { asOpened: await readAttrib(p) };
    if (attrib.asOpened.button) {
      const btn = dlg.locator(".picker-map .mapboxgl-ctrl-attrib-button");
      const isExpanded = () => p.evaluate(() => document.querySelector("[role=dialog] .picker-map .mapboxgl-ctrl-attrib").classList.contains("mapboxgl-compact-show"));
      step = "D1 collapsed";
      if (await isExpanded()) await btn.click();
      await p.mouse.move(4, 4);
      await p.waitForTimeout(400);
      attrib.collapsed = await readAttrib(p);
      attrib.collapsedShots = await shootAttrib(p, blank, w, "attrib-collapsed");

      // A real click 17 px up and left of the button's centre: inside the
      // 44 x 44 square, outside a 24 x 24 box.
      step = "D2 click off centre";
      const bb = await btn.boundingBox();
      const off = bb.width < 44 ? 17 : 0;
      await p.mouse.click(bb.x + bb.width / 2 - off, bb.y + bb.height / 2 - off);
      await p.waitForTimeout(1200);
      attrib.clickOffCentre = { pxUpAndLeftOfCentre: off, opensAttribution: await isExpanded(), barAfter: await dlg.locator("[data-testid=coords-bar]").textContent() };
      if (!(await isExpanded())) {
        // The click went to the map and placed a pin; wait for it to rest.
        await settled(p);
        await p.waitForTimeout(4000);
        await btn.click();
      }
      step = "D3 expanded";
      await settled(p);
      await p.mouse.move(4, 4);
      await p.waitForTimeout(600);
      attrib.expanded = await readAttrib(p);
      attrib.expandedShots = await shootAttrib(p, blank, w, "attrib-expanded");
      // The same off-centre click closes it again.
      step = "D4 click off centre again";
      const bb2 = await btn.boundingBox();
      await p.mouse.click(bb2.x + bb2.width / 2 - off, bb2.y + bb2.height / 2 + off);
      await p.waitForTimeout(800);
      attrib.clickOffCentreAgain = { pxDownAndLeftOfCentre: off, closesAttribution: !(await isExpanded()), barAfter: await dlg.locator("[data-testid=coords-bar]").textContent() };
    } else {
      step = "D1 full line";
      attrib.fullLineShots = await shootAttrib(p, blank, w, "attrib-full-line");
    }
    await p.keyboard.press("Escape");

    const rec = { size: `${w}x${h}`, inter, exceptionReason: EXCEPTION_REASON, states, closes, attrib };
    out.push(rec);

    const n = states.noPin;
    const y = states.pin;
    const bx = (o) => `${o.x},${o.y} ${o.w}x${o.h}`;
    const keys = Object.keys(states);
    const under = [...new Set(keys.flatMap((s) => states[s].under44.map((u) => `${u.what} ${u.w}x${u.h} (reaches it at ${u.reachControl}/${u.probes})`)))];
    const small = [...new Set(keys.flatMap((s) => states[s].smallBox.map((u) => `${u.what} box ${u.w}x${u.h}, its 44x44 square reaches it at ${u.reachControl}/${u.probes} and a Mapbox mark at ${u.reachMapboxMark}`)))];
    const exc = [...new Set(keys.flatMap((s) => states[s].mapboxExceptions.map((u) => `${u.what} ${u.w}x${u.h}`)))];
    console.log(`${w}x${h}: Inter ${inter} (bar font ${n.font})`);
    console.log(`  bar no pin: "${n.barText}" box ${bx(n.bar)} controls ${n.barControls} | mark ${bx(n.mark.box)} data-pin ${n.mark.dataPin} fill ${n.mark.background} hollow ${n.mark.hollow} border ${n.mark.border} | outline contrast on ${n.barGround}: ${n.mark.outlineContrast ?? "no outline"}`);
    console.log(`  bar pin:    "${y.barText}" box ${bx(y.bar)} controls ${y.barControls} | mark ${bx(y.mark.box)} data-pin ${y.mark.dataPin} fill ${y.mark.background} hollow ${y.mark.hollow} border ${y.mark.border} | fill contrast: ${y.mark.fillContrast}`);
    console.log(`  bar box same in both: ${same(n.bar, y.bar)} | mark box same: ${same(n.mark.box, y.mark.box)} | map same: ${same(n.map, y.map)} | search same: ${same(n.search, y.search)} | tokens --ink-faint ${n.tokens.inkFaint} --dim ${n.tokens.dim} --da-ground ${n.tokens.daGround}`);
    console.log(`  44 px: ${n.countedControls}/${y.countedControls} controls counted (no pin/pin) | under 44: ${under.length ? under.join("; ") : "none"} | box under 44: ${small.length ? small.join("; ") : "none"}`);
    console.log(`  skipped, ${EXCEPTION_REASON}: ${exc.length ? exc.join("; ") : "none shown"}`);
    console.log(`  axe ${keys.map((s) => `${s}:${states[s].axe.length ? states[s].axe.join(",") : 0}`).join(" ")}`);
    for (const c of closes) {
      console.log(`  close ${c.how}: bar before "${c.barBeforeClose}" | closed ${c.windowClosed} | focus on ${c.focusOn} (the opener: ${c.focusIsOpener}) | scroll moved ${c.scrollMovedPx} px, page height ${c.docHeightChangePx} px | opener box same ${c.openerBoxSame}, band box same ${c.bandBoxSame}, main box same ${c.mainBoxSame} | band text same ${c.bandTextSame} | stored keys changed: local [${c.localStorageKeysChanged.join(", ")}] session [${c.sessionStorageKeysChanged.join(", ")}] | requests on close: ${c.requestsOnClose.length ? c.requestsOnClose.join(", ") : "none"} | next window's bar "${c.nextWindowBar}"`);
    }
    const A = attrib;
    const btnLine = (t, s) => `  attribution ${t}: map ${s.mapWidth} wide, compact ${s.compact}, expanded ${s.expanded} | container ${s.container.w}x${s.container.h} | text "${s.text}" (shown ${s.innerShown}) | links ${s.links.map((l) => `${l.text} ${l.w}x${l.h}${l.centreReachesLink === null ? "" : ` centre ${l.centreReachesLink} right edge ${l.rightEdgeReachesLink} (${l.rightEdgeReaches})`}`).join("; ")} | logo ${s.logo ? `${s.logo.w}x${s.logo.h} shown ${s.logo.shown}` : "none"} | button ${s.button ? `"${s.button.label}" box ${s.button.box.w}x${s.button.box.h}, ::after ${s.button.after ? `${s.button.after.w} x ${s.button.after.h} ${s.button.after.position} ${s.button.after.background}` : "none"}, tap area: ${s.button.reachButton}/${s.button.probes} points of its 44x44 square reach it (span ${s.button.reachBox ? `${s.button.reachBox.w}x${s.button.reachBox.h}` : "0"}); the rest reach ${JSON.stringify(s.button.reachOther)}` : "not shown"}`;
    console.log(btnLine("as opened", A.asOpened));
    if (A.collapsed) {
      console.log(btnLine("collapsed", A.collapsed));
      console.log(btnLine("expanded", A.expanded));
      console.log(`  click ${A.clickOffCentre.pxUpAndLeftOfCentre} px up-left of the button's centre: opens the attribution ${A.clickOffCentre.opensAttribution}, bar then "${A.clickOffCentre.barAfter}" | ${A.clickOffCentreAgain.pxDownAndLeftOfCentre} px down-left: closes it ${A.clickOffCentreAgain.closesAttribution}`);
      console.log(`  pixels, ::after on vs off: ${["collapsed", "expanded"].map((k) => { const t = A[`${k}Shots`]; return `${k} ${t.ruleOnVsOff.differ}/${t.ruleOnVsOff.pixels} in the crop, ${t.ruleOnVsOff.differInPill}/${t.ruleOnVsOff.pillPixels} inside the attribution's box (on vs on again ${t.ruleOnVsOnAgain.differ} and ${t.ruleOnVsOnAgain.differInPill})`; }).join("; ")}`);
    } else {
      console.log(`  pixels, ::after on vs off: full line ${A.fullLineShots.ruleOnVsOff.differ}/${A.fullLineShots.ruleOnVsOff.pixels} in the crop, ${A.fullLineShots.ruleOnVsOff.differInPill}/${A.fullLineShots.ruleOnVsOff.pillPixels} inside the attribution's box (on vs on again ${A.fullLineShots.ruleOnVsOnAgain.differ} and ${A.fullLineShots.ruleOnVsOnAgain.differInPill})`);
    }
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
    await b.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(EXTRA, `${w}-error.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
