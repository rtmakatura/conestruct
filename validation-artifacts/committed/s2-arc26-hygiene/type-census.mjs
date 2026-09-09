// s2-arc26 bucket D — #263 rendered census + contrast + axe on a settled
// Denver plan, at 1440×1000 and 380×800.  Evidence leg only: the CI gate
// is lib/design/type-census.test.ts (static) and ink-literals.test.ts.
//
//   T1  type tuples on the settled page (audit-lib TYPE over "main") —
//       the P5 figure: 63 on 2e0b25e (s2-audit-1) → expect 63 (zero folds
//       this round; the count is reported, not asserted)
//   T2  the .honesty caveat's measured pair (audit-lib PAIRS over the
//       pinned .jbar-suggest — the slot unmounts post-generate): ink over
//       --canvas-tint through the effective opacity ≥ 4.5
//   T3  axe color-contrast: 0 nodes at both viewports, pinned AND settled
//   T4  the section role reads --ink-bright (computed rgb(255,255,255))
//
// Usage: node type-census.mjs <OUT> <frontendSha> [base]
//   base defaults to the local dev server on 3004 (prod Modal backend via
//   .env.local — the healthz gate names the BACKEND sha, the frontend sha
//   is the worktree tip passed in).
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
const require = createRequire(import.meta.url);
const L = require(path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..", "s2-audit-1", "audit-lib.js"));

const OUT = process.argv[2];
const FRONT_SHA = process.argv[3] || "?";
const BASE = process.argv[4] || "http://127.0.0.1:3004";
const { log, rec, flush } = L.mkLog(OUT);
const PIN = { lat: "39.726900", lng: "-104.987300" }; // Denver, the audit's pin
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|VERIFIED/;
const RUNS = [{ width: 1440, height: 1000 }, { width: 380, height: 800 }];
let pass = 0, fail = 0;
const check = (vp, name, ok, measure) => { rec({ vp, surface: "census", p: name.split(" ")[0], verdict: ok ? "PASS" : "FAIL", what: name, measure }); ok ? pass++ : fail++; };

const S = () => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140) }; };
  return { band: !!document.querySelector(".working-band"), strip: r(".status-bar"), refusal: r(".scan-refusal"), lockup: r(".results-head-lockup"), hero: !!document.querySelector(".hero") };
};

async function pinManually(page) {
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (labelText, value) => { const input = page.locator(`label:text-is("${labelText}")`).locator("xpath=following-sibling::input[1]"); await input.fill(value); };
  await fill("Latitude", PIN.lat);
  await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", PIN.lng); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  await page.waitForTimeout(400);
}
async function settle(page, maxMs) {
  const t0 = Date.now(); let seen = false, settledAt = null, last = null;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(S); s.t = Date.now() - t0; last = s; if (s.band) seen = true;
    const done = seen && !s.band && (SETTLED.test(s.strip?.text ?? "") || s.refusal || s.lockup);
    if (settledAt === null && done) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1200) break;
    await page.waitForTimeout(100);
  }
  return { settledAt, last };
}

async function generateWithRetry(page, vp) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.getByRole("button", { name: /Generate plan/ }).click();
    const s = await settle(page, 90000);
    if (!s.last.refusal) return { ...s, attempt };
    log(`[${vp}] natural refusal on attempt ${attempt} (#256): "${s.last.refusal.text.slice(0, 90)}"`);
    if (attempt === 1) { await page.getByRole("button", { name: /Retry scan/ }).click().catch(() => {}); const r = await settle(page, 90000); if (!r.last.refusal) return { ...r, attempt: 2 }; }
  }
  return null;
}

const HEALTHZ = "https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz";
const hz = await (await fetch(HEALTHZ)).json();
log(`backend healthz sha ${hz.sha} · frontend sha ${FRONT_SHA} · base ${BASE}`);
const browser = await L.chromium.launch();
for (const vpSize of RUNS) {
  const vp = `${vpSize.width}x${vpSize.height}`;
  const page = await browser.newPage({ viewport: vpSize });
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 90000 }); await page.waitForTimeout(800);
  await pinManually(page);
  const tv = Date.now(); while (Date.now() - tv < 40000) { const s = await page.evaluate(S); if (s.strip && !/VERIFYING/.test(s.strip.text)) break; await page.waitForTimeout(300); }
  // T2 .honesty pair — PRE-generate: the caveat rides the suggestion slot
  // in the setup panel (audit F-S1-7 was measured at S1 pinned); after
  // Generate the panel collapses into the strip and the slot unmounts.
  const pairs = await page.evaluate(L.PAIRS, ".jbar-suggest");
  fs.writeFileSync(path.join(OUT, `${vp}-pinned-suggest-pairs.json`), JSON.stringify(pairs, null, 1));
  const honesty = pairs.filter((p) => /honesty/.test(p.sel));
  check(vp, "T2 .honesty ≥ 4.5:1 (pinned)", honesty.length > 0 && honesty.every((p) => p.ratio >= 4.5), honesty.map((p) => `${p.sel} "${p.text.slice(0, 30)}" ${p.fg}/${p.bg} ${p.ratio} (opacity ${p.opacity})`).join(" ; ") || "no .honesty node in .jbar-suggest");
  const low = pairs.filter((p) => p.ratio < 4.5 && p.size < 18);
  rec({ vp, surface: "census", p: "P9", verdict: low.length ? "note" : "measured", what: "T2b other .jbar-suggest pairs under 4.5 (pinned)", measure: low.map((p) => `${p.sel} "${p.text.slice(0, 24)}" ${p.ratio}`).join(" ; ") || "none" });
  const axePinned = await L.runAxe(page, OUT, `${vp}-pinned`);
  const ccP = axePinned.find((v) => v.id === "color-contrast");
  check(vp, "T3a axe color-contrast 0 (pinned)", !ccP, ccP ? `${ccP.nodes.length} node(s): ${ccP.nodes.slice(0, 6).map((n) => n.target).join(" ; ")}` : "0 nodes");
  await L.shot(page, OUT, `${vp}-pinned`, true);
  const gen = await generateWithRetry(page, vp);
  if (!gen) { check(vp, "T0 settled plan", false, "two natural refusals — leg pending"); await page.close(); continue; }
  const st = await page.evaluate(S);
  check(vp, "T0 settled plan", st.hero && !st.refusal, `strip "${st.strip?.text?.slice(0, 60)}"; settled ${gen.settledAt} ms on attempt ${gen.attempt}`);
  await L.shot(page, OUT, `${vp}-settled`, true);

  // T1 tuples
  const type = await page.evaluate(L.TYPE, "main");
  fs.writeFileSync(path.join(OUT, `${vp}-type-tuples.json`), JSON.stringify(type, null, 1));
  const sizes = [...new Set(type.map((t) => t.key.split("|")[1]))].sort((a, b) => parseFloat(a) - parseFloat(b));
  const withRole = type.filter((t) => t.tr).length;
  rec({ vp, surface: "census", p: "P5", verdict: "measured", what: "T1 distinct type tuples on the settled page", measure: `${type.length} tuples; ${sizes.length} sizes ${sizes.join(" ")}; ${withRole} carry a tr-* role` });

  // T3 axe color-contrast
  const axe = await L.runAxe(page, OUT, `${vp}-settled`);
  const cc = axe.find((v) => v.id === "color-contrast");
  check(vp, "T3 axe color-contrast 0 (settled)", !cc, cc ? `${cc.nodes.length} node(s): ${cc.nodes.slice(0, 6).map((n) => n.target).join(" ; ")}` : "0 nodes");
  rec({ vp, surface: "census", p: "P10", verdict: "measured", what: "T3b axe full run (all rules)", measure: axe.map((v) => `${v.id}×${v.nodes.length}`).join(" ; ") || "0 violations" });

  // T4 section role ink
  const sec = await page.evaluate(() => { const el = document.querySelector(".tr-section"); return el ? getComputedStyle(el).color : null; });
  check(vp, "T4 .tr-section reads --ink-bright", sec === "rgb(255, 255, 255)", `computed ${sec}`);
  await page.close();
}
await browser.close();
log(`RESULT ${fail === 0 ? "ALL PASS" : "FAIL"} ${pass}/${pass + fail} · frontend ${FRONT_SHA} · backend ${hz.sha}`);
flush();
process.exit(fail === 0 ? 0 : 1);
