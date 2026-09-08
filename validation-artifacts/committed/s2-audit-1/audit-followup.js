// s2-audit-1 — follow-up legs the walk could not cover in run 1:
//   F1 the audit PDF on an ok plan (button lives in the Checked & passed chip) + the audit expanders
//   F2 the stale dim mid-flight (P16/P9): pairs inside .results-stale + the ribbon while a correction re-generates
//   F3 the 380 picker: work-zone input vs dialog edge (P6) + disabled Save word (P9)
//   F4 refusal hunt: fresh context, Denver, ≤ N attempts 130 s apart (memo TTL 120 s) → refusal legs,
//      proceed-anyway → NOT-CHECKED legs → audit + plan PDF under NOT-CHECKED; body captured for F5
//   F5 380 replay of the captured refusal body → container geometry / targets / in-view
//   node audit-followup.js <outDir> <expectSha> [attempts]
const L = require("./audit-lib.js");
const { fs, path } = L;
const BASE = "https://www.conestruct.com";
const OUT = process.argv[2] || path.join(__dirname, "out-followup");
const EXPECT = process.argv[3] || ""; const ATTEMPTS = +(process.argv[4] || 5);
const PIN = { lat: "39.726900", lng: "-104.987300" };
const { log, rec, flush } = L.mkLog(OUT);
const DL = path.join(OUT, "downloads"); fs.mkdirSync(DL, { recursive: true });
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|VERIFIED/;
const S = () => { const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 140) }; }; const band = document.querySelector(".working-band"); return { scrollY: Math.round(scrollY), innerH: innerHeight, band: band ? { ...r(".working-band"), verb: band.querySelector(".wb-verb")?.textContent, object: band.querySelector(".wb-object")?.textContent } : null, strip: r(".status-bar"), lockup: r(".results-head-lockup"), refusal: r(".scan-refusal"), ribbon: r(".stale-ribbon"), resultsTop: (() => { const z = document.querySelectorAll("section.zone")[1]; return z ? Math.round(z.getBoundingClientRect().top) : null; })(), sr: document.querySelector("div[role=status].sr-only")?.textContent ?? null, hero: !!document.querySelector(".hero"), dlOn: Array.from(document.querySelectorAll(".dl-btn")).filter((b) => !b.disabled).length, staleNodes: document.querySelectorAll(".results-stale *").length }; };
async function sampleUntil(page, label, maxMs, stop) { const t0 = Date.now(); const out = []; let seen = false; let settledAt = null; let shot = false; while (Date.now() - t0 < maxMs) { const s = await page.evaluate(S); s.t = Date.now() - t0; out.push(s); if (s.band) seen = true; if (!shot && s.band && s.t > 400) { shot = true; await L.shot(page, OUT, `${label}-band`); } const done = stop ? stop(s, seen) : (seen && !s.band && (SETTLED.test(s.strip?.text ?? "") || s.refusal || s.lockup)); if (settledAt === null && done) settledAt = s.t; if (settledAt !== null && Date.now() - t0 - settledAt > 1200) break; await page.waitForTimeout(100); } fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(out)); return { samples: out, settledAt, last: out[out.length - 1] }; }
const pinManually = async (page) => { await page.getByRole("button", { name: "Enter manually", exact: true }).click(); const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); }; await fill("Latitude", PIN.lat); await page.getByRole("button", { name: "Edit manually", exact: true }).click(); await fill("Longitude", PIN.lng); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000"); await page.waitForTimeout(400); };
let replayBody = null;
const hook = (page) => page.on("response", async (res) => { try { const u = res.url(); if (/\/api\/render\/audit$/.test(u)) { const t = await res.text(); if (/site_scan_unavailable/.test(t) && !replayBody) { replayBody = { status: res.status(), body: t }; fs.writeFileSync(path.join(OUT, "refusal-replay.json"), JSON.stringify(replayBody)); log(`captured refusal body (${res.status()}, ${t.length} bytes)`); } } } catch {} });
const retryUntilPlan = async (page, tag) => { for (let i = 0; i < 4 && (await page.locator(".scan-refusal").count()); i++) { await page.getByRole("button", { name: /Retry scan/ }).click(); await sampleUntil(page, `${tag}-retry${i + 1}`, 90000); } if (await page.evaluate(() => /Device breakdown failed/.test(document.querySelector(".stale-ribbon")?.textContent ?? ""))) { const rb = page.getByRole("button", { name: "Retry", exact: true }).first(); if (await rb.count()) { await rb.scrollIntoViewIfNeeded(); await rb.click(); await sampleUntil(page, `${tag}-retry-bd`, 90000); } } await page.waitForTimeout(600); return (await page.locator(".hero").count()) > 0; };

async function refusalLegs(page, vpTag, label) {
  const r = await page.evaluate(() => { const c = document.querySelector(".scan-refusal"); if (!c) return null; const b = c.getBoundingClientRect(); const btns = Array.from(c.querySelectorAll("button")).map((x) => { const y = x.getBoundingClientRect(); const cs = getComputedStyle(x); return { name: x.textContent.trim().slice(0, 30), w: Math.round(y.width), h: Math.round(y.height), left: Math.round(y.left), right: Math.round(y.right), top: Math.round(y.top + scrollY), vtop: Math.round(y.top), border: cs.borderTopWidth, color: cs.color, lines: Math.round(y.height / parseFloat(cs.lineHeight)) }; }); const prov = c.querySelector(".tr-prov")?.textContent ?? ""; const msg = c.querySelector(".flex.items-start span:not(.sys-glyph)")?.textContent ?? ""; return { vtop: Math.round(b.top), vbottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width), btns, prov, msg, rawIso: /\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/.test(prov) }; });
  if (!r) return null;
  const sh = await L.shot(page, OUT, `${vpTag}-s5-refusal-${label}`);
  const x = await page.evaluate(S);
  rec({ vp: vpTag, surface: "S5 refusal", p: "P3", verdict: r.vtop >= 52 && r.vbottom <= x.innerH ? "honoured" : "violated", what: "refusal container inside the settle viewport", measure: `container ${r.vtop}..${r.vbottom} (h ${r.h}, w ${r.w}); innerH ${x.innerH}; results top ${x.resultsTop}; strip ${x.strip ? `${x.strip.vtop}..${x.strip.vbottom}` : "—"}`, shot: sh });
  rec({ vp: vpTag, surface: "S5 refusal", p: "P11", verdict: r.btns.length === 2 && r.btns[0].border !== r.btns[1].border ? "violated" : "honoured", what: "two actions in one row wear two treatments (text link vs bordered)", measure: r.btns.map((b) => `"${b.name}" ${b.w}×${b.h} border ${b.border} lines ${b.lines} top ${b.top} left ${b.left}`).join(" ; "), shot: sh });
  rec({ vp: vpTag, surface: "S5 refusal", p: "P10", verdict: r.btns.some((b) => b.h < 24) ? "violated" : "honoured", what: "refusal action hit sizes", measure: r.btns.map((b) => `"${b.name}" ${b.w}×${b.h}`).join(" ; "), shot: sh });
  rec({ vp: vpTag, surface: "S5 refusal", p: "P12", verdict: r.rawIso ? "violated" : "honoured", what: "provenance line prints a raw ISO timestamp", measure: `"${r.prov}"`, shot: sh });
  rec({ vp: vpTag, surface: "S5 refusal", p: "P2", verdict: x.hero && /PLAN DECLINED/.test(x.strip?.text ?? "") ? "violated" : (x.hero ? "note" : "honoured"), what: "strip says PLAN DECLINED while a plan (hero, live downloads, sr announcement) is on screen", measure: `strip "${x.strip?.text?.slice(0, 70)}"; hero ${x.hero}; ${x.dlOn} download buttons enabled; sr-only "${x.sr}"`, shot: sh });
  rec({ vp: vpTag, surface: "S5 refusal", p: "P2", verdict: "violated", what: "the refusal is stated twice — strip sentence and container sentence", measure: `strip "${x.strip?.text?.slice(0, 100)}" ; container "${r.msg.slice(0, 100)}"`, shot: sh });
  const pairs = await page.evaluate(L.PAIRS, ".scan-refusal"); const low = pairs.filter((p) => p.ratio < 4.5);
  rec({ vp: vpTag, surface: "S5 refusal", p: "P9", verdict: low.length ? "violated" : "honoured", what: "contrast in the container", measure: pairs.map((p) => `${p.sel} ${p.ratio}`).join(" ; ") });
  const tier = await page.evaluate(() => ({ ledger: document.querySelector(".tier-ledger")?.textContent.trim(), attention: document.querySelector(".refchip.sev-warn .chip-body")?.textContent.trim().replace(/\s+/g, " ").slice(0, 120), auditBtn: (() => { const b = Array.from(document.querySelectorAll("button")).find((x) => /Audit PDF/.test(x.textContent)); return b ? { disabled: b.disabled, title: b.title, visible: b.getBoundingClientRect().width > 0 } : null; })() }));
  rec({ vp: vpTag, surface: "S5 refusal", p: "P14", verdict: "note", what: "section 03 under the refusal", measure: `ledger "${tier.ledger}"; attention body "${tier.attention}"; audit button ${JSON.stringify(tier.auditBtn)}` });
  return r;
}

let browser;
(async () => {
  const sha = await L.shaGate(log, EXPECT);
  log(`s2-audit-1 follow-up · prod ${sha} · ${new Date().toISOString()}`);
  browser = await L.chromium.launch();

  // ── F3 the 380 picker geometry ──
  try {
    const page = await browser.newPage({ viewport: { width: 380, height: 800 } });
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(800);
    await page.getByRole("button", { name: "Pick Location on Map" }).click(); await page.waitForTimeout(2500);
    const g = await page.evaluate(() => { const d = document.querySelector("[role=dialog]"); const db = d.getBoundingClientRect(); const inputs = Array.from(d.querySelectorAll("input")).map((i) => { const b = i.getBoundingClientRect(); return { name: i.getAttribute("aria-label") || i.placeholder, left: Math.round(b.left), right: Math.round(b.right), w: Math.round(b.width), h: Math.round(b.height), overflow: Math.round(b.right - db.right) }; }); const save = Array.from(d.querySelectorAll("button")).find((b) => /Save & Close/.test(b.textContent)); const sb = save.getBoundingClientRect(); const words = (d.textContent.match(/Pick a road to continue|Detecting road…|Click the map or search to drop a pin|Drop a pin on the map/gi) || []); const foot = save.parentElement.getBoundingClientRect(); const scroller = Array.from(d.querySelectorAll("*")).find((e) => getComputedStyle(e).overflowY === "auto" && e.scrollHeight > e.clientHeight); return { dialog: { left: Math.round(db.left), right: Math.round(db.right), w: Math.round(db.width), h: Math.round(db.height), top: Math.round(db.top), bottom: Math.round(db.bottom) }, inputs, save: { disabled: save.disabled, w: Math.round(sb.width), h: Math.round(sb.height), opacity: getComputedStyle(save).opacity, title: save.title }, words, footTop: Math.round(foot.top), scroller: scroller ? { cls: scroller.className.slice(0, 40), sh: scroller.scrollHeight, ch: scroller.clientHeight } : null }; });
    const sh = await L.shot(page, OUT, "380x800-f3-picker");
    fs.writeFileSync(path.join(OUT, "380x800-f3-picker.json"), JSON.stringify(g, null, 1));
    const over = g.inputs.filter((i) => i.overflow > 0);
    rec({ vp: "380x800-denver", surface: "S1 picker", p: "P6", verdict: over.length ? "violated" : "honoured", what: "inputs overflow the dialog's right edge", measure: `dialog ${g.dialog.left}..${g.dialog.right} (w ${g.dialog.w}); ${g.inputs.map((i) => `"${i.name}" ${i.left}..${i.right} (${i.overflow > 0 ? "+" : ""}${i.overflow})`).join(" ; ")}`, shot: sh });
    rec({ vp: "380x800-denver", surface: "S1 picker", p: "P9", verdict: g.save.disabled && g.words.length === 0 ? "violated" : "honoured", what: "disabled Save & Close carries a word saying why, in the viewport", measure: `Save disabled=${g.save.disabled} opacity ${g.save.opacity} title "${g.save.title}"; gate words ${JSON.stringify(g.words)}; footer top ${g.footTop}; dialog ${g.dialog.top}..${g.dialog.bottom}; scroller ${JSON.stringify(g.scroller)}`, shot: sh });
    await page.close();
  } catch (e) { log("ERR F3 " + e.message); }

  // ── F1 + F2 on a warm plan at 1440 ──
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); hook(page);
    await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(800);
    // the first viewport on load (P3): what is visible, what is not
    const fv = await page.evaluate(() => { const els = [["h1", "h1"], ["draft banner", ".border-l-2"], ["jbar", ".jbar"], ["zone head", ".zone-head"], ["rail", ".progress-rail"], ["scenario picker", ".setup-grid, .setup-panel"], ["pick CTA", "button"], ["status strip", ".status-bar"]]; const out = []; for (const [n, s] of els) { let el = document.querySelector(s); if (n === "pick CTA") el = Array.from(document.querySelectorAll("button")).find((b) => /Pick Location on Map/.test(b.textContent)); if (!el) continue; const b = el.getBoundingClientRect(); out.push(`${n} ${Math.round(b.top)}..${Math.round(b.bottom)}`); } const gen = Array.from(document.querySelectorAll("*")).filter((e) => e.children.length === 0 && /Output requires TCS review/.test(e.textContent)).length; return { out, innerH: innerHeight, tcs: gen }; });
    rec({ vp: "1440x1000-denver", surface: "S1 empty", p: "P3", verdict: "violated", what: "first viewport on load: no actionable element (CTA below the fold)", measure: `${fv.out.join(" ; ")}; innerH ${fv.innerH}` });
    rec({ vp: "1440x1000-denver", surface: "S1 empty", p: "P2", verdict: fv.tcs > 1 ? "violated" : "honoured", what: "\"Output requires TCS review\" printed more than once (under Generate + footer)", measure: `${fv.tcs} text nodes` });
    await pinManually(page); await page.waitForTimeout(3000);
    await page.getByRole("button", { name: /Generate plan/ }).click();
    await sampleUntil(page, "1440-f1-generate", 90000);
    if (await page.locator(".scan-refusal").count()) { await refusalLegs(page, "1440x1000-denver", "natural-f1"); }
    if (!(await retryUntilPlan(page, "1440-f1"))) { log("F1: no plan"); } else {
      // F1: Checked & passed chip → audit expanders + audit PDF
      const chip = page.locator(".chip-sum", { hasText: "Checked & passed" }).first();
      await chip.scrollIntoViewIfNeeded(); if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click(); await page.waitForTimeout(500);
      const heads = page.locator(".audit-head"); const nh = await heads.count();
      const hs = await page.evaluate(() => Array.from(document.querySelectorAll(".audit-head")).slice(0, 6).map((b) => { const r = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { title: b.querySelector(".title")?.textContent.trim().slice(0, 30), result: b.querySelector(".result")?.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height), numLeft: Math.round(b.querySelector(".num")?.getBoundingClientRect().left ?? 0), titleLeft: Math.round(b.querySelector(".title")?.getBoundingClientRect().left ?? 0), citeRight: Math.round(b.querySelector(".cite")?.getBoundingClientRect().right ?? 0), chevRight: Math.round(b.querySelector(".chev")?.getBoundingClientRect().right ?? 0), size: cs.fontSize }; }));
      rec({ vp: "1440x1000-denver", surface: "S3 AuditTrail", p: "P13", verdict: nh > 0 ? "honoured" : "note", what: "audit items are expanders inside Checked & passed", measure: `${nh} audit-head buttons; ${hs.map((h) => `"${h.title}" ${h.w}×${h.h} num ${h.numLeft} title ${h.titleLeft} cite-r ${h.citeRight} chev-r ${h.chevRight} "${h.result}"`).join(" ; ")}` });
      const tl = [...new Set(hs.map((h) => h.titleLeft))], cr = [...new Set(hs.map((h) => h.citeRight))];
      rec({ vp: "1440x1000-denver", surface: "S3 AuditTrail", p: "P4", verdict: tl.length <= 1 && cr.length <= 1 ? "honoured" : "violated", what: "audit rows share the title left edge and the cite right edge", measure: `title lefts ${tl.join("/")}; cite rights ${cr.join("/")}` });
      const shA = await L.shot(page, OUT, "1440-f1-checked-open", true);
      if (nh) { await heads.first().click(); await page.waitForTimeout(400); const body = await page.evaluate(L.TYPE, ".audit-body"); const bodyPairs = await page.evaluate(L.PAIRS, ".audit-body"); const lowB = bodyPairs.filter((p) => p.ratio < 4.5); rec({ vp: "1440x1000-denver", surface: "S3 AuditTrail", p: "P5", verdict: "note", what: "type tuples in an open audit body", measure: body.slice(0, 8).map((t) => `${t.key.split("|").slice(0, 3).join(" ")} ×${t.n}`).join(" ; "), shot: shA }); rec({ vp: "1440x1000-denver", surface: "S3 AuditTrail", p: "P9", verdict: lowB.length ? "violated" : "honoured", what: "contrast in an open audit body", measure: lowB.slice(0, 5).map((p) => `${p.sel} "${p.text}" ${p.ratio} (opacity ${p.opacity})`).join(" ; ") || `${bodyPairs.length} pairs ≥ 4.5` }); await L.shot(page, OUT, "1440-f1-audit-open"); await heads.first().click(); }
      const ab = page.getByRole("button", { name: /Audit PDF/ }).first();
      if (await ab.count()) { await ab.scrollIntoViewIfNeeded(); const abr = await ab.evaluate((b) => { const r = b.getBoundingClientRect(); return `${Math.round(r.width)}×${Math.round(r.height)} border ${getComputedStyle(b).borderTopWidth}`; }); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await ab.click(); const rs = await sampleUntil(page, "1440-f1-audit-pdf", 90000, (x, seen) => seen && !x.band); const d = await dlp; if (d) await d.saveAs(path.join(DL, "1440x1000-denver-audit.pdf")); rec({ vp: "1440x1000-denver", surface: "S6 downloads", p: "P8", verdict: rs.samples.some((x) => x.band) ? "honoured" : "violated", what: "audit PDF render raises the band", measure: `band "${rs.samples.find((x) => x.band)?.band.verb} · ${rs.samples.find((x) => x.band)?.band.object}" ${rs.samples.filter((x) => x.band).length} samples; button ${abr}; file ${d ? "saved" : "not received"}` }); rec({ vp: "1440x1000-denver", surface: "S3 AuditTrail", p: "P11", verdict: "violated", what: "the audit PDF download is a text link inside a tier body while every other download is a bordered .dl-btn", measure: `"↓ Audit PDF" ${abr} vs .dl-btn 40 px bordered` }); } else rec({ vp: "1440x1000-denver", surface: "S6 downloads", p: "P8", verdict: "note", what: "no Audit PDF button found", measure: "" });
      await chip.click();
      // F2: the stale dim mid-flight — Assert from the block, probe pairs in .results-stale
      const block = page.locator("#site-corrections"); const assertBtn = block.getByRole("button", { name: "Assert", exact: true }).first();
      if (await assertBtn.count()) {
        await block.scrollIntoViewIfNeeded(); await assertBtn.click(); await page.waitForTimeout(300);
        const mid = await page.evaluate(() => { const rs = document.querySelector(".results-stale"); const rb = document.querySelector(".stale-ribbon"); const band = document.querySelector(".working-band"); const cs = rs ? getComputedStyle(rs) : null; return { staleNodes: rs ? rs.querySelectorAll("*").length : 0, opacity: cs?.opacity, filter: cs?.filter, ribbon: rb ? { text: rb.textContent.trim(), vtop: Math.round(rb.getBoundingClientRect().top), role: rb.getAttribute("role") } : null, band: band ? band.querySelector(".wb-object")?.textContent : null, scrollY: Math.round(scrollY), innerH: innerHeight }; });
        const stalePairs = await page.evaluate(L.PAIRS, ".results-stale"); const lowS = stalePairs.filter((p) => p.ratio < 4.5);
        const shM = await L.shot(page, OUT, "1440-f2-midflight");
        rec({ vp: "1440x1000-denver", surface: "S2 re-generate", p: "P16", verdict: mid.ribbon ? "honoured" : "violated", what: "previous answer stays, dimmed, labelled", measure: `results-stale opacity ${mid.opacity} filter ${mid.filter} (${mid.staleNodes} nodes); ribbon "${mid.ribbon?.text}" at vtop ${mid.ribbon?.vtop} (viewport ${mid.innerH}, scrollY ${mid.scrollY}); band "${mid.band}"`, shot: shM });
        rec({ vp: "1440x1000-denver", surface: "S2 re-generate", p: "P9", verdict: lowS.length ? "violated" : "honoured", what: "the dimmed previous answer fails 4.5:1 by construction (#192)", measure: `${lowS.length}/${stalePairs.length} text pairs under 4.5:1 in .results-stale; e.g. ${lowS.slice(0, 4).map((p) => `${p.sel} "${p.text}" ${p.ratio}`).join(" ; ")}`, shot: shM });
        rec({ vp: "1440x1000-denver", surface: "S2 re-generate", p: "P3", verdict: mid.ribbon && mid.ribbon.vtop >= 0 && mid.ribbon.vtop < mid.innerH ? "honoured" : "note", what: "the ribbon is in the viewport while the operator is at the block", measure: `ribbon vtop ${mid.ribbon?.vtop}; band fixed at bottom` , shot: shM });
        await sampleUntil(page, "1440-f2-assert", 90000); await retryUntilPlan(page, "1440-f2");
      }
    }
    await page.close();
  } catch (e) { log("ERR F1/F2 " + e.stack); }
  flush();

  // ── F4 refusal hunt (cold memo): fresh context per attempt, 130 s apart ──
  let got = null;
  for (let a = 1; a <= ATTEMPTS && !got; a++) {
    if (a > 1) { log(`waiting 130 s for the memo to expire (attempt ${a})`); await new Promise((r) => setTimeout(r, 130000)); }
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true }); const page = await ctx.newPage(); hook(page);
    try {
      await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(800);
      await pinManually(page); await page.waitForTimeout(3000);
      await page.getByRole("button", { name: /Generate plan/ }).click();
      const gen = await sampleUntil(page, `1440-f4-a${a}-generate`, 90000);
      const dur = gen.settledAt;
      if (await page.locator(".scan-refusal").count()) {
        got = a; log(`attempt ${a}: refusal after ${dur} ms`);
        rec({ vp: "1440x1000-denver", surface: "S5 refusal", p: "P8", verdict: "note", what: `natural refusal on attempt ${a}`, measure: `settled at ${dur} ms; strip "${gen.last.strip?.text?.slice(0, 80)}"` });
        await refusalLegs(page, "1440x1000-denver", "natural");
        // the strip's pill + the section-03 attention row under DECLINED
        await L.shot(page, OUT, "1440-f4-refusal-full", true);
        // proceed anyway
        await page.getByRole("button", { name: /Generate without site check/ }).click();
        const pa = await sampleUntil(page, "1440-f4-proceed", 90000);
        rec({ vp: "1440x1000-denver", surface: "S5 proceed", p: "P8", verdict: pa.samples.some((x) => x.band) ? "honoured" : "violated", what: "proceed-anyway raises the band", measure: `band "${pa.samples.find((x) => x.band)?.band.verb} · ${pa.samples.find((x) => x.band)?.band.object}"; settled ${pa.settledAt} ms; strip "${pa.last.strip?.text?.slice(0, 70)}"` });
        for (let i = 0; i < 2 && (await page.locator(".scan-refusal").count()); i++) { await page.getByRole("button", { name: /Generate without site check/ }).click(); await sampleUntil(page, `1440-f4-proceed${i + 2}`, 90000); }
        const nc = await page.evaluate(() => { const s = document.querySelector(".site-not-checked"); const sr = s ? s.getBoundingClientRect() : null; return { strip: s?.textContent.trim().replace(/\s+/g, " ").slice(0, 200) ?? null, stripH: sr ? Math.round(sr.height) : null, stripProv: s?.querySelector(".tr-prov")?.textContent ?? null, tierTags: Array.from(document.querySelectorAll(".check-list-src")).map((e) => e.textContent.trim()).filter((t) => /NOT CHECKED/.test(t)).length, ledger: document.querySelector(".tier-ledger")?.textContent.trim(), lockup: document.querySelector(".results-head-lockup")?.textContent ?? null, block: !!document.querySelector("#site-corrections"), verdict: document.querySelector(".status-bar")?.textContent.trim().slice(0, 100), attention: document.querySelector(".refchip.sev-warn .chip-sum")?.textContent.trim().replace(/\s+/g, " "), chips: Array.from(document.querySelectorAll(".chip-sum")).map((c) => c.textContent.trim().replace(/\s+/g, " ").slice(0, 36)) }; });
        const shN = await L.shot(page, OUT, "1440-f4-not-checked", true);
        rec({ vp: "1440x1000-denver", surface: "S5 proceed", p: "P14", verdict: nc.strip && nc.tierTags ? "honoured" : "violated", what: "NOT-CHECKED disclosed on the strip and in section 03 (chip counts)", measure: `strip "${nc.strip}" (h ${nc.stripH}); section-03 NOT CHECKED tags ${nc.tierTags}; ledger "${nc.ledger}"; chips ${nc.chips.join(" | ")}; lockup ${JSON.stringify(nc.lockup)}; block ${nc.block}; verdict "${nc.verdict}"`, shot: shN });
        rec({ vp: "1440x1000-denver", surface: "S5 proceed", p: "P12", verdict: /\d{4}-\d\d-\d\dT/.test(nc.stripProv || "") ? "violated" : "honoured", what: "NOT-CHECKED provenance prints a raw ISO timestamp", measure: `"${nc.stripProv}"`, shot: shN });
        // the audit PDF + plan PDF under NOT-CHECKED
        const chip = page.locator(".chip-sum", { hasText: "Checked & passed" }).first(); if (await chip.count()) { await chip.scrollIntoViewIfNeeded(); if ((await chip.getAttribute("aria-expanded")) !== "true") await chip.click(); await page.waitForTimeout(400); }
        const ab = page.getByRole("button", { name: /Audit PDF/ }).first();
        if (await ab.count()) { await ab.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await ab.click(); await sampleUntil(page, "1440-f4-audit-pdf", 90000, (x, seen) => seen && !x.band); const d = await dlp; if (d) { await d.saveAs(path.join(DL, "1440x1000-denver-audit-not-checked.pdf")); log("saved audit-not-checked.pdf"); } }
        const pb = page.locator(".dl-btn", { hasText: "Download PDF" }).first(); if (await pb.count()) { await pb.scrollIntoViewIfNeeded(); const dlp = page.waitForEvent("download", { timeout: 90000 }).catch(() => null); await pb.click(); await sampleUntil(page, "1440-f4-plan-pdf", 90000, (x, seen) => seen && !x.band); const d = await dlp; if (d) { await d.saveAs(path.join(DL, "1440x1000-denver-plan-not-checked.pdf")); log("saved plan-not-checked.pdf"); } }
      } else { log(`attempt ${a}: no refusal (settled ${dur} ms, "${gen.last.strip?.text?.slice(0, 50)}")`); rec({ vp: "1440x1000-denver", surface: "S5 hunt", p: "P8", verdict: "note", what: `attempt ${a}: no refusal`, measure: `settled ${dur} ms` }); }
    } catch (e) { log(`ERR F4 attempt ${a}: ${e.message}`); }
    await ctx.close(); flush();
  }

  // ── F5 380 replay ──
  if (!replayBody && fs.existsSync(path.join(OUT, "refusal-replay.json"))) replayBody = JSON.parse(fs.readFileSync(path.join(OUT, "refusal-replay.json"), "utf-8"));
  if (replayBody) {
    for (const vp of [{ width: 380, height: 800 }, { width: 1440, height: 1000 }]) {
      const tag = `${vp.width}x${vp.height}-denver`;
      try {
        const page = await browser.newPage({ viewport: vp }); let once = true;
        await page.route("**/api/render/audit", async (route) => { if (once) { once = false; await route.fulfill({ status: replayBody.status, headers: { "content-type": "application/json" }, body: replayBody.body }); } else await route.continue(); });
        await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 60000 }); await page.waitForTimeout(800);
        await pinManually(page); await page.waitForTimeout(3000);
        await page.getByRole("button", { name: /Generate plan/ }).click();
        const gen = await sampleUntil(page, `${tag}-f5-generate`, 90000);
        rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P8", verdict: "note", what: "replayed refusal body — settle", measure: `settled ${gen.settledAt} ms; results top ${gen.last.resultsTop}; strip "${gen.last.strip?.text?.slice(0, 60)}"` });
        await refusalLegs(page, tag, "replay");
        await L.shot(page, OUT, `${tag}-f5-refusal-full`, true);
        const axeR = await L.runAxe(page, OUT, `${tag}-axe-refusal`);
        rec({ vp: tag, surface: "S5 refusal (replayed)", p: "P10", verdict: axeR.some((v) => v.id === "target-size") ? "violated" : "honoured", what: "axe with the refusal up", measure: axeR.map((v) => `${v.id}×${v.nodes.length}[${v.nodes.slice(0, 3).map((n) => n.target).join(",")}]`).join(" ; ") || "0" });
        await page.close();
      } catch (e) { log(`ERR F5 ${tag}: ${e.message}`); }
    }
  } else rec({ vp: "—", surface: "S5", p: "P8", verdict: "note", what: "no refusal captured — replay not run", measure: "" });
  await browser.close(); flush(); log("done");
})().catch((e) => { log("ERR " + e.stack); flush(); process.exit(1); });
