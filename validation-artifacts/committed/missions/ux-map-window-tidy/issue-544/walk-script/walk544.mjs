// #544 local walk: bracketed coordinates in the search box, and the "Did
// you mean" choice's numbers on one line, at each size.  Adapted from
// #543's walk543.mjs (the same boxes, axe, camera and crops code).
//   node walk544.mjs <worktree> <crops dir> <extra dir> <site url> <env file>
// The env file gives GATE_BYPASS_TOKEN when the shell has none (read raw,
// never printed).
//
// Two windows per size.
//   A: no pin -> search "-104.9811, 39.7401" (the choice shows) -> measure
//      the choice and its numbers, once as built and once with the nowrap
//      rule switched off in the page (the control: what the numbers do
//      without the rule) -> search "(39.7401, -104.9811)" (a pin).
//   B: no pin -> search "[39.7401, -104.9811]" (a pin).
// POSTs to /api/geocode and /api/road-bearing are counted per step.  The
// map, the search row, the bar and the right panel are measured in each
// state; axe runs on the dialog in each; every control in the search row,
// its list and the bar is measured, and every control in the dialog under
// 44 px is listed by name.
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
const SWAPPED = "-104.9811, 39.7401";
const CHOICE = "Did you mean 39.7401, -104.9811?";
const ROUND = "(39.7401, -104.9811)";
const SQUARE = "[39.7401, -104.9811]";
const PIN_TEXT = "Pin at 39.7401, -104.9811";
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

// Boxes in the dialog's own frame: viewport rect plus the body scroller's
// scrollTop (below md the body scrolls).
async function measure(p) {
  return p.evaluate(() => {
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
    const name = (c) => (c.tagName === "INPUT" ? "search box" : `${c.tagName.toLowerCase()} "${(c.getAttribute("aria-label") || c.textContent || c.getAttribute("title") || "").trim().slice(0, 60)}"`);
    const controls = [...search.querySelectorAll("button, input"), ...bar.querySelectorAll("button, input, a")].map((c) => {
      const r = c.getBoundingClientRect();
      return { what: name(c), w: r2(r.width), h: r2(r.height) };
    });
    // Every control in the dialog that is shown and under 44 px either way.
    const under44 = [...dlg.querySelectorAll("button, input, a[href], select, [role=radio], [role=button]")]
      .map((c) => ({ c, r: c.getBoundingClientRect() }))
      .filter(({ r }) => r.width > 0 && r.height > 0 && (r.width < 44 || r.height < 44))
      .map(({ c, r }) => ({ what: name(c), cls: String(c.className).split(" ")[0], w: r2(r.width), h: r2(r.height) }));
    const ls = getComputedStyle(list);
    const listBox = ls.display === "none" ? null : box(list);
    return {
      map: box(map),
      rail: box(dlg.querySelector(".mw-rail")),
      bar: box(bar),
      search: box(search),
      column: box(col),
      dialog: { w: r2(d.width), h: r2(d.height) },
      scrollHeight: scroller.scrollHeight,
      barText: bar.textContent,
      list: listBox ? { ...listBox, position: ls.position, text: list.textContent } : null,
      controls,
      under44,
      scrollTop: scroller.scrollTop,
    };
  });
}

// The choice and its numbers.  Lines are counted as the distinct tops of
// the text's rects (a Range over the element's contents).
function measureChoice(p) {
  return p.evaluate(() => {
    const r2 = (n) => Math.round(n * 100) / 100;
    const btn = document.querySelector("[role=dialog] [data-testid=search-list] button");
    const pair = btn.querySelector(".mw-search-pair");
    const bs = getComputedStyle(btn);
    const ps = getComputedStyle(pair);
    const b = btn.getBoundingClientRect();
    const pr = pair.getBoundingClientRect();
    // The whole sentence on one line, measured with the button's own font.
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;";
    probe.textContent = btn.textContent;
    btn.appendChild(probe);
    const sentenceW = probe.getBoundingClientRect().width;
    probe.remove();
    const lh = parseFloat(bs.lineHeight);
    const linesOf = (el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size;
    };
    return {
      text: btn.textContent,
      button: { w: r2(b.width), h: r2(b.height) },
      roomForText: r2(b.width - parseFloat(bs.paddingLeft) - parseFloat(bs.paddingRight)),
      sentenceOnOneLine: r2(sentenceW),
      choiceLines: linesOf(btn),
      pair: { text: pair.textContent, w: r2(pr.width), h: r2(pr.height), lines: linesOf(pair), whiteSpace: ps.whiteSpace },
      font: `${bs.fontFamily.split(",")[0].replace(/["']/g, "")} ${bs.fontSize}`,
      lineHeight: Number.isFinite(lh) ? lh : bs.lineHeight,
      color: bs.color,
    };
  });
}

// The camera as the map reports it (the window's mapRef, found through
// React's fiber tree from the map's container node).
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
          const c = m.getCenter();
          return {
            zoom: Math.round(m.getZoom() * 100) / 100,
            center: [Math.round(c.lng * 10000) / 10000, Math.round(c.lat * 10000) / 10000],
            moving: m.isMoving(),
          };
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

// The search row, its list and `below` px of what is under them.
async function shootSearch(p, w, name, below) {
  const s = await p.locator("[role=dialog] .mw-search").boundingBox();
  const vw = p.viewportSize().width;
  await p.screenshot({ path: path.join(CROPS, `${w}-${name}.png`), clip: { x: Math.max(0, s.x), y: Math.max(0, s.y), width: Math.min(s.width, vw - s.x), height: s.height + below } });
}

async function openWindow(p) {
  await p.goto(`${SITE}/sandbox`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForSelector(".a-open .a-head", { timeout: 120000 });
  await p.getByRole("button", { name: "Pick on map" }).first().click();
  await p.waitForSelector("[role=dialog] [data-testid=coords-bar]", { timeout: 30000 });
  await p.waitForFunction(() => document.querySelector("[role=dialog] .picker-map canvas"), null, { timeout: 60000 });
  await settled(p);
  await p.waitForTimeout(1500);
}

// Type bracketed coordinates, press Enter, wait for the pin and the road
// panel.  Returns the POSTs this step sent, the camera and the state.
async function placeBracketed(p, dlg, box, posts, text) {
  const before = { ...posts };
  await box.fill(text);
  await box.press("Enter");
  await dlg.locator("[data-testid=coords-bar]").getByText("Pin at").waitFor({ timeout: 15000 });
  const camera = await settled(p);
  await dlg.locator("[data-testid=road-pick-panel], [data-testid=road-lookup-status]").first().waitFor({ timeout: 120000 });
  await p.waitForTimeout(2500);
  const state = { ...(await measure(p)), axe: await axeDialog(p) };
  return {
    typed: text,
    boxValue: await box.inputValue(),
    geocodePosts: posts.geocode - before.geocode,
    roadPosts: posts.roads - before.roads,
    camera,
    pinPlaced: state.barText === PIN_TEXT,
    state,
  };
}

for (const [w, h] of SIZES) {
  const b = await chromium.launch();
  try {
    const ctx = await newGatedContext(b, SITE, { viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    const posts = { geocode: 0, roads: 0 };
    p.on("request", (r) => {
      if (r.method() !== "POST") return;
      if (r.url().includes("/api/geocode")) posts.geocode += 1;
      if (r.url().includes("/api/road-bearing")) posts.roads += 1;
    });
    const dlg = p.locator("[role=dialog]");
    const box = dlg.getByLabel("Address, intersection or coordinates search");

    // ---- window A ----
    step = "A0 open";
    await openWindow(p);
    const inter = await p.evaluate(async () => { await document.fonts.ready; return [...document.fonts].some((f) => /inter/i.test(f.family) && f.status === "loaded"); });
    const states = {};
    step = "A1 no pin";
    states.noPin = { ...(await measure(p)), axe: await axeDialog(p) };

    step = "A2 the choice";
    await box.fill(SWAPPED);
    await box.press("Enter");
    await dlg.getByRole("button", { name: CHOICE }).waitFor({ timeout: 15000 });
    await p.waitForTimeout(500);
    states.choice = { ...(await measure(p)), axe: await axeDialog(p) };
    const choice = await measureChoice(p);
    const choicePosts = { ...posts };
    await shootSearch(p, w, "did-you-mean", 110);
    await p.screenshot({ path: path.join(CROPS, `${w}-did-you-mean-window.png`) });

    // The control: the same choice with the nowrap rule switched off in
    // the page.  It shows what the numbers do without the rule.
    step = "A3 control";
    const off = await p.addStyleTag({ content: ".map-window .mw-search-pair { white-space: normal !important; }" });
    await p.waitForTimeout(200);
    const choiceWithoutRule = await measureChoice(p);
    await shootSearch(p, w, "did-you-mean-rule-off", 110);
    await off.evaluate((el) => el.remove());
    await p.waitForTimeout(200);
    const choiceAgain = await measureChoice(p);

    step = "A4 round brackets";
    const round = await placeBracketed(p, dlg, box, posts, ROUND);
    states.round = round.state;
    await shootSearch(p, w, "brackets-round", 110);
    await p.screenshot({ path: path.join(CROPS, `${w}-brackets-round-window.png`) });

    // ---- window B ----
    step = "B0 open";
    await openWindow(p);
    step = "B1 square brackets";
    const noPinB = await measure(p);
    const square = await placeBracketed(p, dlg, box, posts, SQUARE);
    states.square = square.state;
    await shootSearch(p, w, "brackets-square", 110);
    await p.screenshot({ path: path.join(CROPS, `${w}-brackets-square-window.png`) });

    // Largest change in any of x, y, w, h between no pin and the choice
    // shown, per box.
    const px = (k) => Math.max(...["x", "y", "w", "h"].map((f) => Math.abs((states.choice[k][f] ?? 0) - (states.noPin[k][f] ?? 0))));
    const keys = Object.keys(states);
    const rec = {
      size: `${w}x${h}`,
      inter,
      choice,
      choiceWithoutRule,
      choiceAgain,
      choiceMovesPx: { map: px("map"), search: px("search"), rail: px("rail"), bar: px("bar"), column: px("column"), dialog: px("dialog"), scrollHeight: Math.abs(states.choice.scrollHeight - states.noPin.scrollHeight) },
      choicePosts,
      round: { ...round, state: undefined },
      square: { ...square, state: undefined, noPinBarText: noPinB.barText },
      totalPosts: { ...posts },
      states,
    };
    out.push(rec);
    const ctl = keys.flatMap((s) => states[s].controls);
    const minH = Math.min(...ctl.map((c) => c.h));
    const minW = Math.min(...ctl.map((c) => c.w));
    const under = [...new Set(keys.flatMap((s) => states[s].under44.map((u) => `${u.what} ${u.w}x${u.h}`)))];
    const mv = rec.choiceMovesPx;
    console.log(
      `${w}x${h}: Inter ${inter} | choice "${choice.text}" button ${choice.button.w}x${choice.button.h} lines ${choice.choiceLines}, numbers "${choice.pair.text}" lines ${choice.pair.lines} (${choice.pair.whiteSpace}); sentence ${choice.sentenceOnOneLine} in room ${choice.roomForText}; rule off: numbers lines ${choiceWithoutRule.pair.lines}, choice lines ${choiceWithoutRule.choiceLines} | choice shown vs not, px moved: map ${mv.map} search ${mv.search} rail ${mv.rail} bar ${mv.bar} column ${mv.column} dialog ${mv.dialog} scrollHeight ${mv.scrollHeight} | choice POSTs geocode ${choicePosts.geocode} roads ${choicePosts.roads} | round: pin ${round.pinPlaced} geocode ${round.geocodePosts} roads ${round.roadPosts} centre ${round.camera?.center} zoom ${round.camera?.zoom} | square: pin ${square.pinPlaced} geocode ${square.geocodePosts} roads ${square.roadPosts} centre ${square.camera?.center} zoom ${square.camera?.zoom} | min control (search row, list, bar) ${minW}x${minH} | under 44 in the dialog: ${under.length ? under.join("; ") : "none"} | axe ${keys.map((s) => `${s}:${states[s].axe.length ? states[s].axe.join(",") : 0}`).join(" ")}`,
    );
  } catch (e) {
    console.log(`${w}x${h} ERROR at step ${step} ${oneLine(e).slice(0, 300)}`);
    await b.contexts()[0]?.pages()[0]?.screenshot({ path: path.join(EXTRA, `${w}-error.png`) }).catch(() => {});
  } finally {
    await b.close();
  }
}
const ascii = JSON.stringify(out, null, 1).replace(/[\u0080-\uffff]/g, (ch) => `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`);
fs.writeFileSync(path.join(CROPS, "walk.json"), `${ascii}\n`, "utf8");
