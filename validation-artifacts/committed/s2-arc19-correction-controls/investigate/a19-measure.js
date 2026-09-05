// s2-arc19 investigate — measurement only (no assertions): the reason
// picker's computed colors + contrast, axe with the picker open, and
// the post-generate geometry of the scanned block at two viewports.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = "https://www.conestruct.com";
const OUT = process.argv[2] || path.join(__dirname, "a19-out");
fs.mkdirSync(OUT, { recursive: true });
const AXE_SRC = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf-8");
const LAT = "39.711300", LNG = "-105.081500", BEARING = "180", WORKLEN = "1000";
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };

const strip = (page) => page.evaluate(() => document.querySelector(".status-bar")?.textContent ?? "");
async function waitSettled(page, maxMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxMs) {
    const s = await strip(page);
    if (/READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/.test(s) && !/VERIFYING|COMPUTING/.test(s)) return s;
    await page.waitForTimeout(150);
  }
  return null;
}
async function pinManually(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => {
    const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]");
    await input.fill(value);
  };
  await fill("Latitude", LAT);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", LNG);
  await fill("Bearing (° from N)", BEARING);
  await fill("Work zone (ft)", WORKLEN);
  await page.waitForTimeout(400);
}
const GEOM = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), height: Math.round(b.height) }; };
  const zones = Array.from(document.querySelectorAll("section.zone"));
  const z = zones.map((s) => { const b = s.getBoundingClientRect(); return { tag: s.querySelector(".zone-tag")?.textContent, top: Math.round(b.top), bottom: Math.round(b.bottom) }; });
  const cs = getComputedStyle(document.querySelector(".workbench"));
  return {
    scrollY: Math.round(window.scrollY), innerH: window.innerHeight, innerW: window.innerWidth,
    navH: cs.getPropertyValue("--nav-h").trim(), railH: cs.getPropertyValue("--rail-h").trim(),
    block: r(".site-corrections"), setupStrip: r(".setup-strip"), statusBar: r(".status-bar"), zones: z,
    ref03: r(".zone-tag .n + *") , tiers: r('[aria-label="Plan reference tiers"]'),
  };
};
async function measurePicker(page) {
  return page.evaluate(() => {
    const lum = (hex) => { const c = hex.match(/\w\w/g).map((h) => parseInt(h, 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
    const toHex = (rgb) => { const m = rgb.match(/\d+(\.\d+)?/g); if (!m) return rgb; const a = m[3] !== undefined ? Number(m[3]) : 1; if (a === 0) return "transparent"; return "#" + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("") + (a < 1 ? `@${a}` : ""); };
    const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return ((hi + 0.05) / (lo + 0.05)).toFixed(2); };
    const effBg = (el) => { let e = el; while (e) { const bg = getComputedStyle(e).backgroundColor; if (bg && bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return { hex: toHex(bg), from: e.className || e.tagName }; e = e.parentElement; } return { hex: "#ffffff", from: "root" }; };
    const sel = document.querySelector(".site-correction-picker select");
    const cs = getComputedStyle(sel);
    const opt = sel.querySelector("option");
    const os = getComputedStyle(opt);
    const strip = effBg(sel.parentElement);
    const selBg = toHex(cs.backgroundColor);
    const selFg = toHex(cs.color);
    const bgUsed = selBg === "transparent" ? strip.hex : selBg;
    const cfm = document.querySelector(".site-correction-picker button.confirm");
    const gh = document.querySelector(".site-correction-picker button.ghost");
    const rec = document.querySelector(".site-correction-picker .sugg-name");
    const c = (el) => { const s = getComputedStyle(el); return { fg: toHex(s.color), bg: toHex(s.backgroundColor), border: toHex(s.borderColor), opacity: s.opacity }; };
    const cf = c(cfm), g = c(gh);
    return {
      select: { fg: selFg, bg: selBg, effectiveBg: bgUsed, stripBg: strip, colorScheme: cs.colorScheme, appearance: cs.appearance, font: cs.fontSize + " " + cs.fontFamily.slice(0, 30), ratio: ratio(selFg, bgUsed) },
      option: { fg: toHex(os.color), bg: toHex(os.backgroundColor), text: opt.textContent },
      confirmDisabled: { ...cf, ratioFgOnStrip: ratio(cf.fg, strip.hex), disabled: cfm.disabled },
      ghost: { ...g, ratioFgOnStrip: ratio(g.fg, strip.hex) },
      name: { fg: toHex(getComputedStyle(rec).color), ratio: ratio(toHex(getComputedStyle(rec).color), strip.hex) },
      tokens: Object.fromEntries(["--canvas", "--canvas-tint", "--rule", "--ink-on-dark", "--ink-on-dark-faint", "--act", "--none", "--pass", "--raise", "--ink"].map((t) => [t, getComputedStyle(document.querySelector(".workbench")).getPropertyValue(t).trim()])),
    };
  });
}
async function runAxe(page, name) {
  await page.evaluate(AXE_SRC);
  const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] } }));
  const compact = res.violations.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target.join(" ")), data: v.nodes.map((n) => n.any?.[0]?.data ?? null) }));
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(compact, null, 2));
  return compact;
}
(async () => {
  const browser = await chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const page = await browser.newPage({ viewport: vp });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(600);
    await pinManually(page);
    log(`[${tag}] pre settle: ${(await waitSettled(page, 60000))?.slice(0, 60)}`);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    const s = await waitSettled(page, 90000);
    log(`[${tag}] post settle: ${s?.slice(0, 60)}`);
    await page.waitForTimeout(1500);
    const g = await page.evaluate(GEOM);
    log(`[${tag}] GEOM ${JSON.stringify(g)}`);
    await page.screenshot({ path: path.join(OUT, `post-generate-${tag}.png`) });
    // The picker.
    const row = page.locator(".site-correction-row", { hasText: "Pedestrian sidewalks" }).first();
    if ((await row.count()) === 0) { log(`[${tag}] no sidewalk row`); await page.close(); continue; }
    await row.getByRole("button", { name: "Dismiss" }).click();
    await page.waitForTimeout(200);
    const m = await measurePicker(page);
    log(`[${tag}] PICKER ${JSON.stringify(m)}`);
    await page.locator(".site-correction-picker").scrollIntoViewIfNeeded();
    await page.locator(".site-corrections").screenshot({ path: path.join(OUT, `picker-open-${tag}.png`) });
    const ax = await runAxe(page, `axe-picker-open-${tag}.json`);
    log(`[${tag}] AXE picker open (menu closed): ${ax.length} — ${ax.map((x) => x.id + " " + x.targets.join(",").slice(0, 80) + " " + JSON.stringify(x.data).slice(0, 160)).join(" ; ") || "none"}`);
    await page.close();
  }
  await browser.close();
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
