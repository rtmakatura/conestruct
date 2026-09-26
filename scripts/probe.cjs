// FORWARD COPY (coming-soon-gate C-Q7) of validation-artifacts/committed/
// issue-289-band-stack/fidelity-audit/probe.cjs, which stays as recorded.
// Changes from the archive, and only these: it sends the gate's bypass
// header (scripts/gate.cjs — fails loudly on prod without
// GATE_BYPASS_TOKEN); live-check.cjs resolves from scripts/; and AUDIT_OUT
// is required (the archive defaulted to its own dir, which here would
// write captures into scripts/).
//
// #289 fidelity audit — the prod capture.
//
// Drives the REAL deployed /sandbox through S1, S2 (road confirmed, kind
// unchosen), S3, S4 (in flight — added after the fidelity pass), S5 and S7
// at 1440x1000 and 380x800, and for every state
// records, off getComputedStyle — measured, not read from source:
//
//   texts: every visible element with a direct text node — family, size,
//          weight, line-height, letter-spacing, colour, transform,
//          decoration, effective opacity, the classes up to 4 ancestors;
//   boxes: every band / fact line / field / chip / button / panel / row —
//          padding, gap, border, background, height, width, grid tracks,
//          and the vertical gap to its previous visible sibling.
//
// Output goes OUTSIDE the repo (job tmp); the audit commit carries the
// rig and the tables derived from it.

const path = require("path");
const fs = require("fs");
const { chromium } = require(
  "C:/Users/rtmak/Documents/traffic-control-tool/node_modules/playwright",
);
// #237: every band selection goes through the helper — zero matches throw.
const { hook, nonEmpty } = require("./live-check.cjs");
const { applyGate, gateHeaders } = require("./gate.cjs");

const SITE = process.env.AUDIT_SITE || "https://www.conestruct.com/sandbox";
const OUT = process.env.AUDIT_OUT;
if (!OUT) throw new Error("AUDIT_OUT is required (a dir outside the repo)");
gateHeaders(SITE); // throws before any browser starts
// E Colfax mid-block — the arc's standing test spot (s7-prod/README.md).
const PIN = { lat: "39.74020", lng: "-104.95600" };

function capture() {
  const BOX_SEL = [
    "nav", "header", ".status-slot", ".status-bar", ".status-bar .pill",
    ".band-stack", ".a-fact", ".a-open", ".a-open > *", ".a-head", ".a-body",
    ".a-moves", ".a-move", ".a-chips", ".a-chip", ".a-fld", ".a-pri", ".a-lk",
    ".a-val-lk", ".act", ".act-btn", ".a-grid", ".a-cell", ".a-findrow",
    ".a-detect", ".a-revise-foot", ".a-panel-foot", ".results-head-slot",
    ".zone", ".zone.results", "[data-testid]", "button", "select", "input",
    "main", "main > *", "section > *", ".stale-ribbon", ".ny-item", ".ny-head",
    ".ny-apply", "details", "summary", "footer",
    ".hero", ".hero-cell", ".hero-meta", ".dls", ".dl-card", ".dl-all",
    ".disc", ".results-disc", ".results-stale", ".needs-you", ".a-panel",
    ".a-panel-head", ".a-panel-rows", ".a-panel-row", ".a-panel-status",
    ".a-subgroup", ".a-genframe", ".a-mid", ".a-lead", ".a-sym",
    ".workbench-frame", ".working-band", ".wb-row", ".status-glyph",
  ].join(",");

  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const effOpacity = (el) => {
    let o = 1;
    for (let e = el; e; e = e.parentElement) {
      const v = parseFloat(getComputedStyle(e).opacity);
      if (!Number.isNaN(v)) o *= v;
    }
    return Math.round(o * 1000) / 1000;
  };
  const ground = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const bg = getComputedStyle(e).backgroundColor;
      if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    }
    return null;
  };
  const tagOf = (e) =>
    e.tagName.toLowerCase() +
    (e.id ? "#" + e.id : "") +
    (e.classList.length ? "." + [...e.classList].slice(0, 4).join(".") : "") +
    (e.dataset && e.dataset.testid ? `[${e.dataset.testid}]` : "");
  const chain = (el) => {
    const parts = [];
    for (let e = el; e && e !== document.body && parts.length < 5; e = e.parentElement) {
      parts.unshift(tagOf(e));
    }
    return parts.join(" > ");
  };
  const texts = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "NOSCRIPT", "svg", "path"].includes(el.tagName)) continue;
    const direct = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join(" ");
    if (!direct) continue;
    if (!vis(el)) continue;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (cs.clip === "rect(0px, 0px, 0px, 0px)" || (r.width <= 1 && r.height <= 1)) continue;
    texts.push({
      text: direct.slice(0, 80),
      el: tagOf(el),
      chain: chain(el),
      family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      size: cs.fontSize,
      weight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
      transform: cs.textTransform,
      decoration: cs.textDecorationLine,
      opacity: effOpacity(el),
      ground: ground(el),
      top: Math.round(r.top + window.scrollY),
      left: Math.round(r.left),
      w: Math.round(r.width),
      h: Math.round(r.height),
    });
  }
  const boxes = [];
  const seen = new Set();
  for (const el of document.body.querySelectorAll(BOX_SEL)) {
    if (seen.has(el) || !vis(el)) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    let prev = el.previousElementSibling;
    while (prev && !vis(prev)) prev = prev.previousElementSibling;
    const gapToPrev = prev
      ? Math.round((r.top - prev.getBoundingClientRect().bottom) * 100) / 100
      : null;
    boxes.push({
      el: tagOf(el),
      chain: chain(el),
      text: (el.innerText || "").replace(/\s+/g, " ").trim().slice(0, 60),
      top: Math.round(r.top + window.scrollY),
      left: Math.round(r.left),
      w: Math.round(r.width * 100) / 100,
      h: Math.round(r.height * 100) / 100,
      display: cs.display,
      padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
      margin: `${cs.marginTop} ${cs.marginRight} ${cs.marginBottom} ${cs.marginLeft}`,
      gap: `${cs.rowGap} ${cs.columnGap}`,
      grid: cs.gridTemplateColumns,
      border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor} | L ${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor} | B ${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`,
      bg: cs.backgroundColor,
      minHeight: cs.minHeight,
      family: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
      size: cs.fontSize,
      weight: cs.fontWeight,
      lineHeight: cs.lineHeight,
      letterSpacing: cs.letterSpacing,
      color: cs.color,
      transform: cs.textTransform,
      opacity: effOpacity(el),
      gapToPrev,
      prev: prev ? tagOf(prev) : null,
    });
  }
  return {
    scrollH: document.documentElement.scrollHeight,
    // Rule 32 / 173: no horizontal page scroll at any width.
    scrollW: document.documentElement.scrollWidth,
    bodyFont: (() => {
      const cs = getComputedStyle(document.body);
      return `${cs.fontFamily.split(",")[0]} ${cs.fontSize}/${cs.lineHeight} ${cs.color} bg ${cs.backgroundColor}`;
    })(),
    innerW: window.innerWidth,
    texts,
    boxes,
  };
}

/** A state is captured SETTLED: no working band, no VERIFYING strip,
 *  and (S7) the preview landed.  Polls up to `ms`; records whether it
 *  settled rather than pretending it did. */
async function settled(page, ms, extra) {
  for (let t = 0; t < ms; t += 1000) {
    const busy = await page.evaluate(
      (x) =>
        !!document.querySelector(".working-band") ||
        !!document.querySelector(".status-bar.verifying") ||
        (x === "preview" &&
          document.querySelector('[data-testid="revision-panel"]')?.getAttribute("data-preview") !== "ready"),
      extra,
    );
    if (!busy) return true;
    await page.waitForTimeout(1000);
  }
  return false;
}

async function snap(page, tag, state, result, ms = 0, extra = null) {
  const ok = ms ? await settled(page, ms, extra) : true;
  // No hover state in the measurement: park the pointer off every
  // control (a link under the last click read its :hover colour).
  // (1, 1) sat on the nav wordmark and read ITS hover colour; the right
  // edge at mid-height is page gutter at 1440 and padding at 380.
  const vp = page.viewportSize();
  await page.mouse.move(vp.width - 2, Math.round(vp.height / 2));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  const data = await page.evaluate(capture);
  data.settled = ok;
  nonEmpty(data.texts, `${tag} ${state} texts`);
  nonEmpty(data.boxes, `${tag} ${state} boxes`);
  result.states[state] = data;
  await page.screenshot({ path: path.join(OUT, `${tag}-${state}.png`), fullPage: true });
  console.log(
    `${tag} ${state}: settled=${ok} ${data.texts.length} texts, ${data.boxes.length} boxes`,
  );
}

async function run(width, height, tag) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height } });
  await applyGate(ctx, SITE);
  const page = await ctx.newPage();
  const result = { width, height, states: {} };

  await page.goto(SITE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  await snap(page, tag, "S1", result);

  // S2 — road confirmed, kind unchosen.  The picker's manual-coordinates
  // route, then the first detected candidate, then Save & Close.
  await (await hook(page, "where-open-picker")).click();
  await page.waitForTimeout(3500);
  await page.getByRole("button", { name: /enter coordinates manually/i }).click();
  await page.waitForTimeout(1200);
  await page.getByPlaceholder(/^Latitude/).fill(PIN.lat);
  await page.getByPlaceholder(/^Longitude/).fill(PIN.lng);
  await page.waitForTimeout(2500);
  const save = page.getByRole("button", { name: /Save & Close/ });
  const candidate = page
    .locator("button")
    .filter({ hasText: /\((primary|secondary|tertiary|residential|trunk|motorway)/ })
    .first();
  for (let i = 0; i < 90; i += 1) {
    if ((await candidate.count()) > 0 || (await save.isEnabled())) break;
    await page.waitForTimeout(1000);
  }
  if ((await candidate.count()) > 0) {
    await candidate.click();
    await page.waitForTimeout(2500);
  }
  for (let i = 0; i < 60 && !(await save.isEnabled()); i += 1) {
    await page.waitForTimeout(1000);
  }
  await save.click();
  await page.waitForTimeout(3000);
  const len = page.locator("#band-worklen");
  if (await len.count()) {
    await len.fill("1000");
    await len.blur();
  }
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await snap(page, tag, "S2", result);

  // S3 — a chip, the confirm, the WHAT band open; checks settle.
  await (await hook(page, "kind-chip-shoulder")).click();
  await (await hook(page, "where-confirm")).click();
  await page.waitForTimeout(3000);
  await snap(page, tag, "S3", result, 90000);

  // S5 — Generate, the results stack at the settle (the scan can take
  // ~17 s; the working band is the in-flight voice, so its absence is the
  // settle).
  // S4 is genState "generating": the plan's device-breakdown request in
  // flight.  On prod it can answer before a full-page capture finishes
  // (the first run read 380's facts after the verdict landed), so the rig
  // HOLDS that one request until S4 is read and shot, then releases it.
  // Nothing on the page changes — the request is only answered later.
  let release;
  const held = new Promise((r) => (release = r));
  let holding = true;
  await page.route("**/api/render/device-breakdown", async (route) => {
    if (holding) await held;
    await route.continue();
  });
  await (await hook(page, "generate-plan")).click();

  // S4 — in flight (#289 acceptance: "Every S1–S4 and S7 state measured on
  // prod at both widths"; S4 was the one never captured).  The working
  // band is S4's voice; the scan keeps it up ~17 s, so the capture is
  // taken while it is present, never waited out.  Rule 117's own facts
  // are recorded beside the capture (s4Facts) rather than inferred later.
  await page.waitForSelector(".working-band", { timeout: 15000 });
  // Facts first, the full capture second — both while the request is held.
  const s4Facts = await page.evaluate(() => {
    const slot = document.querySelector(".status-slot");
    const facts = [...document.querySelectorAll(".a-fact")];
    const ph = document.querySelector(".results-placeholder");
    const eff = (el) => {
      let o = 1;
      for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity) || 1;
      return Math.round(o * 100) / 100;
    };
    return {
      workingBand: !!document.querySelector(".working-band"),
      // Rule 117: "Verdict slot mounted and empty, holding its height —
      // visibility hidden, not display none."
      verdictSlot: slot
        ? {
            mounted: true,
            visibility: getComputedStyle(slot).visibility,
            display: getComputedStyle(slot).display,
            height: Math.round(slot.getBoundingClientRect().height * 100) / 100,
            text: (slot.textContent || "").trim(),
          }
        : { mounted: false },
      // "Both fact lines at opacity .5 with 'locked'."
      factLines: facts.map((f) => ({
        opacity: eff(f),
        locked: /locked/.test(f.textContent || ""),
        text: (f.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      })),
      // "The aerial NOT dimmed."
      aerialOpacity: (() => {
        const a = document.querySelector("[data-testid='where-aerial'], .a-aerial");
        return a ? eff(a) : null;
      })(),
      // "A results placeholder block … 'No package yet — the plan is
      // being built.'"
      placeholder: ph ? (ph.textContent || "").replace(/\s+/g, " ").trim() : null,
      // "1 px #2c3e53, ground #101c29, padding 22 px 16 px … body value
      // #6e7c8e" — measured off the block and its line.
      placeholderBox: ph
        ? (() => {
            const cs = getComputedStyle(ph);
            const line = ph.querySelector(".rp-line");
            return {
              border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
              ground: cs.backgroundColor,
              padding: cs.padding,
              lineColor: line ? getComputedStyle(line).color : null,
            };
          })()
        : null,
      // "No primary." — visible primary actions on the page.
      primaries: [...document.querySelectorAll(".a-pri")].filter(
        (e) => getComputedStyle(e).display !== "none" && e.getBoundingClientRect().height > 0,
      ).length,
    };
  });
  await snap(page, tag, "S4", result, 0);
  // S4 is captured IN FLIGHT by design: "settled" does not apply to it.
  result.states.S4.settled = false;
  result.states.S4.inFlight = true;
  result.states.S4.s4Facts = s4Facts;
  // The working band must still be up after the full capture, or the
  // capture is not S4.
  result.states.S4.workingBandAfterCapture = await page.evaluate(
    () => !!document.querySelector(".working-band"),
  );
  // Released, not unrouted: unroute hands the held request on itself and
  // the handler's continue then throws.  From here the handler passes
  // every call straight through.
  holding = false;
  release();

  await page.waitForSelector('[data-testid="fact-setup"]', { timeout: 120000 });
  await snap(page, tag, "S5", result, 150000);

  // S7 — the speed value opens revision; stage 35 → 7c.
  await (await hook(page, "setup-link-speed")).click();
  await page.waitForSelector('[data-testid="revision-panel"]', { timeout: 15000 });
  await page.selectOption("#revise-speed", "35");
  await snap(page, tag, "S7", result, 60000, "preview");

  await browser.close();
  return result;
}

(async () => {
  const out = { site: SITE, ranAt: new Date().toISOString(), widths: {} };
  out.widths["1440"] = await run(1440, 1000, "w1440");
  out.widths["380"] = await run(380, 800, "w380");
  fs.writeFileSync(path.join(OUT, "capture.json"), JSON.stringify(out, null, 1));
  console.log("done");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
