// s2-arc23 investigate — measurement only. Per viewport: pin Denver, Generate,
// sample the wait surfaces every 250 ms until settle; then measure the landing
// (scrollY, clamped?), then inject a MOCK fixed 52px band + 150px main padding
// and re-run the landing scrollIntoView to see whether the target moves.
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
const BASE = "https://www.conestruct.com";
const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const OUT = process.argv[2]; const EXPECT_SHA = process.argv[3] || "";
fs.mkdirSync(OUT, { recursive: true });
const LAT = "39.726900", LNG = "-104.987300";
const log = (s) => { console.log(s); fs.appendFileSync(path.join(OUT, "log.txt"), s + "\n"); };
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|NEEDS ATTENTION|VERIFIED/;
async function pin(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v);
  await fill("Latitude", LAT);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", LNG); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  await page.waitForTimeout(400);
}
const SAMPLE = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().slice(0, 60) }; };
  const zones = document.querySelectorAll("section.zone"); const res = zones[1];
  const nav = document.querySelector("nav"); const nb = nav ? nav.getBoundingClientRect() : null;
  const main = document.querySelector("main"); const cs = main ? getComputedStyle(main) : null;
  const frame = document.querySelector(".workbench-frame"); const fb = frame ? frame.getBoundingClientRect() : null;
  let mx = 0; if (main) for (const e of main.querySelectorAll("*")) { const b = e.getBoundingClientRect(); if (b.bottom > mx) mx = b.bottom; }
  return { scrollY: Math.round(window.scrollY), docH: document.documentElement.scrollHeight, innerH: window.innerHeight, innerW: window.innerWidth,
    nav: nb ? { top: Math.round(nb.top), bottom: Math.round(nb.bottom), pos: getComputedStyle(nav).position, z: getComputedStyle(nav).zIndex } : null,
    mainPadB: cs ? cs.paddingBottom : null, frameBottom: fb ? Math.round(fb.bottom) : null,
    statusBar: r(".status-bar"), ribbon: r(".stale-ribbon"), empty: r(".empty-state"), waitLine: r(".results-head-wait"), lockup: r(".results-head-lockup"), block: r(".site-corrections"), refusal: r(".scan-refusal"),
    resultsTop: res ? Math.round(res.getBoundingClientRect().top) : null, resultsMargin: res ? getComputedStyle(res).scrollMarginTop : null,
    liveRegions: Array.from(document.querySelectorAll("[aria-live],[role=status],[role=alert]")).map((e) => `${e.tagName.toLowerCase()}${e.className ? "." + String(e.className).split(" ")[0] : ""}[${e.getAttribute("role") || ""}/${e.getAttribute("aria-live") || ""}]`),
    lastEl: Math.round(mx),
  };
};
async function sampleUntilSettled(page, label, maxMs) {
  const t0 = Date.now(); const samples = []; let settledAt = null; let lastKey = "";
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0;
    const key = JSON.stringify([s.scrollY, s.statusBar && s.statusBar.text, s.ribbon && s.ribbon.text, s.empty && s.empty.text, s.waitLine && s.waitLine.text, s.lockup && s.lockup.text, s.resultsTop, s.refusal && s.refusal.text]);
    if (key !== lastKey) { samples.push(s); lastKey = key; }
    const st = (s.statusBar && s.statusBar.text) || "";
    if (settledAt === null && SETTLED.test(st) && !/VERIFYING|COMPUTING/.test(st)) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1500) break;
    await page.waitForTimeout(250);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples, null, 1));
  const iv = (rc, h) => rc && rc.bottom > 0 && rc.top < h ? "IN" : "OUT";
  const fmt = (rc, h, withText) => rc ? `${rc.top}..${rc.bottom} ${iv(rc, h)}${withText ? ` "${rc.text.slice(0, 40)}"` : ""}` : "—";
  for (const s of samples) log(`  [${label}] t=${String(s.t).padStart(5)} scrollY=${s.scrollY} docH=${s.docH} | status ${fmt(s.statusBar, s.innerH, true)} | ribbon ${fmt(s.ribbon, s.innerH)} | empty ${fmt(s.empty, s.innerH)} | wait ${fmt(s.waitLine, s.innerH)} | lockup ${fmt(s.lockup, s.innerH)} | refusal ${s.refusal ? "YES" : "—"} | resultsTop ${s.resultsTop}`);
  return { samples, settledAt };
}
const MOCK = (on) => {
  const old1 = document.getElementById("a23-mock"); if (old1) old1.remove();
  const old2 = document.getElementById("a23-band"); if (old2) old2.remove();
  if (!on) return;
  const st = document.createElement("style"); st.id = "a23-mock";
  st.textContent = "main{padding-bottom:150px !important} #a23-band{position:fixed;left:0;right:0;bottom:0;z-index:50;background:#0f1a26;border-top:1px solid #34a9e8;padding:11px 26px;font:10px/1.45 monospace;color:#a9dcf8;display:flex;flex-wrap:wrap;column-gap:14px;row-gap:6px;align-items:baseline}";
  document.head.appendChild(st);
  const b = document.createElement("div"); b.id = "a23-band";
  b.innerHTML = '<span style="font-size:13px;color:#34a9e8">◌</span><span style="letter-spacing:.16em">RE-GENERATING</span><span style="font:12.5px sans-serif;color:#eaf0f7">after a correction to Pedestrian sidewalks</span><span style="flex:1 1 180px;font-size:10.5px;color:#93a0b0">re-generating the plan</span><span style="font-size:9.5px;color:#f4c020;letter-spacing:.12em">⚠ CONTROLS LOCKED</span><button style="font:9.5px monospace;letter-spacing:.14em;color:#34a9e8;border:1px solid #2c3e53;background:transparent;padding:5px 9px">CANCEL</button>';
  document.body.appendChild(b);
};
const LAND = () => {
  const res = document.querySelectorAll("section.zone")[1]; res.scrollIntoView({ behavior: "auto", block: "start" });
  const b = res.getBoundingClientRect(); const band = document.getElementById("a23-band"); const bb = band ? band.getBoundingClientRect() : null;
  const ticks = Array.from(document.querySelectorAll(".workbench-frame .ftick")).map((t) => { const r = t.getBoundingClientRect(); return { cls: t.className.replace("ftick ", ""), top: Math.round(r.top), bottom: Math.round(r.bottom) }; });
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
  return { scrollY: Math.round(window.scrollY), docH: document.documentElement.scrollHeight, innerH: window.innerHeight, resultsTop: Math.round(b.top), maxScroll, clamped: Math.round(window.scrollY) >= maxScroll - 1, band: bb ? { top: Math.round(bb.top), h: Math.round(bb.height) } : null, ticks };
};
const BOTTOM = () => {
  window.scrollTo(0, 1e9); const main = document.querySelector("main"); let mx = 0;
  for (const e of main.querySelectorAll("*")) { const b = e.getBoundingClientRect(); if (b.bottom > mx) mx = b.bottom; }
  const foot = document.querySelector("footer"); const band = document.getElementById("a23-band").getBoundingClientRect();
  return { mainLastBottom: Math.round(mx), footerBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : null, bandTop: Math.round(band.top), innerH: window.innerHeight };
};
(async () => {
  const hz = await (await fetch(HEALTHZ)).json();
  if (EXPECT_SHA && !hz.sha.startsWith(EXPECT_SHA)) { log(`healthz ${hz.sha} != ${EXPECT_SHA}; abort`); process.exit(2); }
  log(`healthz ${hz.sha}`);
  const browser = await chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const label = `${vp.width}`;
    const page = await browser.newPage({ viewport: vp });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(600);
    await pin(page);
    await page.waitForTimeout(3000);
    const pre = await page.evaluate(SAMPLE);
    log(`[${label}] pre-generate: nav ${JSON.stringify(pre.nav)} main padding-bottom ${pre.mainPadB} zone scroll-margin ${pre.resultsMargin} frameBottom ${pre.frameBottom} innerH ${pre.innerH} live regions: ${pre.liveRegions.join(" ")}`);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    const g = await sampleUntilSettled(page, `${label}-gen`, 60000);
    log(`[${label}] settled at ${g.settledAt} ms`);
    await page.waitForTimeout(800);
    const post = await page.evaluate(SAMPLE);
    log(`[${label}] post: scrollY ${post.scrollY} docH ${post.docH} resultsTop ${post.resultsTop} lockup ${JSON.stringify(post.lockup)} lastEl ${post.lastEl} live regions: ${post.liveRegions.join(" ")}`);
    await page.screenshot({ path: path.join(OUT, `${label}-settled.png`) });
    const l0 = await page.evaluate(LAND); log(`[${label}] landing (no band): ${JSON.stringify(l0)}`);
    await page.evaluate(MOCK, true);
    await page.waitForTimeout(100);
    const l1 = await page.evaluate(LAND); log(`[${label}] landing (mock band + 150px): ${JSON.stringify(l1)}`);
    await page.screenshot({ path: path.join(OUT, `${label}-mockband-landing.png`) });
    const bot = await page.evaluate(BOTTOM);
    log(`[${label}] scrolled to bottom with mock band: ${JSON.stringify(bot)}`);
    await page.screenshot({ path: path.join(OUT, `${label}-mockband-bottom.png`) });
    await page.evaluate(MOCK, false);
    const hasAssert = await page.getByRole("button", { name: "Assert", exact: true }).count();
    if (hasAssert > 0) {
      await page.evaluate(() => { const el = document.getElementById("site-corrections"); if (el) el.scrollIntoView({ block: "center" }); });
      await page.getByRole("button", { name: "Assert", exact: true }).first().click();
      const c = await sampleUntilSettled(page, `${label}-assert`, 60000);
      log(`[${label}] assert settled at ${c.settledAt} ms`);
    } else log(`[${label}] no Assert button — correction leg skipped`);
    await page.close();
  }
  await browser.close();
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
