// s2-audit-1 — F5b: the 380 refusal, replayed from the captured body, fulfilled
// only on the Generate's own audit request (the pre-generate verification also
// posts /api/render/audit and consumed the first version's one-shot replay).
//   node audit-replay380.js <outDir> <expectSha> <replay.json>
const L = require("./audit-lib.js"); const { fs, path } = L;
const BASE = "https://www.conestruct.com"; const OUT = process.argv[2]; const EXPECT = process.argv[3]; const REPLAY = JSON.parse(fs.readFileSync(process.argv[4], "utf-8"));
const { log, rec, flush } = L.mkLog(OUT);
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|VERIFIED/;
const S = () => { const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140) }; }; const band = document.querySelector(".working-band"); return { scrollY: Math.round(scrollY), innerH: innerHeight, band: band ? { ...r(".working-band"), verb: band.querySelector(".wb-verb")?.textContent, object: band.querySelector(".wb-object")?.textContent } : null, strip: r(".status-bar"), lockup: r(".results-head-lockup"), refusal: r(".scan-refusal"), resultsTop: (() => { const z = document.querySelectorAll("section.zone")[1]; return z ? Math.round(z.getBoundingClientRect().top) : null; })(), sr: document.querySelector("div[role=status].sr-only")?.textContent ?? null, hero: !!document.querySelector(".hero"), dlOn: Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.disabled).length }; };
(async () => {
  await L.shaGate(log, EXPECT);
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 380, height: 800 }, { width: 1440, height: 1000 }]) {
    const tag = `${vp.width}x${vp.height}-denver`;
    const page = await browser.newPage({ viewport: vp }); let armed = false, used = false;
    await page.route("**/api/render/audit", async (route) => { if (armed && !used) { used = true; await route.fulfill({ status: REPLAY.status, headers: { "content-type": "application/json" }, body: REPLAY.body }); } else await route.continue(); });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Enter manually", exact: true }).click(); const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
    await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click(); await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
    // let the pre-generate verification settle first
    const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(S); if (s.strip && !/VERIFYING/.test(s.strip.text)) break; await page.waitForTimeout(300); }
    armed = true;
    await page.getByRole("button", { name: /Generate plan/ }).click();
    const t1 = Date.now(); const samples = []; let seen = false, settledAt = null;
    while (Date.now() - t1 < 90000) { const s = await page.evaluate(S); s.t = Date.now() - t1; samples.push(s); if (s.band) seen = true; if (settledAt === null && seen && !s.band && (s.refusal || SETTLED.test(s.strip?.text ?? ""))) settledAt = s.t; if (settledAt !== null && Date.now() - t1 - settledAt > 1500) break; await page.waitForTimeout(100); }
    fs.writeFileSync(path.join(OUT, `${tag}-replay-samples.json`), JSON.stringify(samples));
    const last = samples[samples.length - 1];
    const r = await page.evaluate(() => { const c = document.querySelector(".scan-refusal"); if (!c) return null; const b = c.getBoundingClientRect(); const btns = Array.from(c.querySelectorAll("button")).map((x) => { const y = x.getBoundingClientRect(); const cs = getComputedStyle(x); return { name: x.textContent.trim().slice(0, 30), w: Math.round(y.width), h: Math.round(y.height), left: Math.round(y.left), right: Math.round(y.right), vtop: Math.round(y.top), border: cs.borderTopWidth, lines: Math.round(y.height / parseFloat(cs.lineHeight)) }; }); const prov = c.querySelector(".tr-prov")?.textContent ?? ""; const pill = document.querySelector(".status-bar .pill")?.textContent ?? null; const stripR = document.querySelector(".status-bar")?.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width), btns, prov, pill, stripTop: stripR ? Math.round(stripR.top) : null, stripH: stripR ? Math.round(stripR.height) : null, stripText: document.querySelector(".status-bar")?.textContent.trim().slice(0, 120) }; });
    const sh = await L.shot(page, OUT, `${tag}-s5-refusal-replay`); await L.shot(page, OUT, `${tag}-s5-refusal-replay-full`, true);
    if (!r) { rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P8", verdict: "note", what: "replay did not produce a refusal", measure: `strip "${last.strip?.text}"`, shot: sh }); await page.close(); continue; }
    rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P3", verdict: r.vtop >= 52 && r.vbottom <= vp.height ? "honoured" : "violated", what: "refusal container inside the settle viewport", measure: `container ${r.vtop}..${r.vbottom} (h ${r.h}, w ${r.w}); strip ${r.stripTop}..${r.stripTop + r.stripH} "${r.stripText}"; results top ${last.resultsTop}; settled ${settledAt} ms`, shot: sh });
    rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P11", verdict: r.btns.length === 2 && r.btns[0].border !== r.btns[1].border ? "violated" : "honoured", what: "two actions, two treatments; the proceed button wraps", measure: r.btns.map((b) => `"${b.name}" ${b.w}×${b.h} border ${b.border} lines ${b.lines} at ${b.left},${b.vtop}`).join(" ; "), shot: sh });
    rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P10", verdict: r.btns.some((b) => b.h < 24) ? "violated" : "honoured", what: "refusal action hit sizes", measure: r.btns.map((b) => `"${b.name}" ${b.w}×${b.h}`).join(" ; "), shot: sh });
    rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P2", verdict: "violated", what: "refusal stated twice (strip + container); pill is a third", measure: `strip "${r.stripText}"; pill "${r.pill}"; hero ${last.hero}; ${last.dlOn} downloads enabled; sr "${last.sr}"`, shot: sh });
    rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P12", verdict: /\d{4}-\d\d-\d\dT/.test(r.prov) ? "violated" : "honoured", what: "raw ISO in the provenance line", measure: `"${r.prov}"`, shot: sh });
    const targets = await page.evaluate(L.TARGETS, ".scan-refusal"); const axe = await L.runAxe(page, OUT, `${tag}-axe-refusal-replay`);
    rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P10", verdict: axe.some((v) => v.id === "target-size") ? "violated" : "honoured", what: "axe with the refusal up", measure: axe.map((v) => `${v.id}×${v.nodes.length}[${v.nodes.slice(0, 4).map((n) => n.target).join(",")}]`).join(" ; ") || "0" });
    await page.close();
  }
  await browser.close(); flush(); log("done");
})().catch((e) => { log("ERR " + e.stack); flush(); process.exit(1); });
