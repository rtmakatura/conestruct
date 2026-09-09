// s2-arc26 live check — #254 + #255 the site-conditions block, at
// 1440×1000 and 380×800, against a LOCAL stack (next dev on 3001 → the
// local FastAPI on 8001, whose /healthz carries GIT_SHA = the checkout).
//   node s2a26-lc.js <outDir> <expectSha> [base] [healthz]
// Legs, per viewport (one page, one plan):
//   G   pin → Generate on the live Overpass (Denver; a refusal is retried
//       once, then recorded and the block legs skipped — no figures faked).
//   R1  every .sc-row rect after settle: scan rows (kind, h) — 46 ±1 at
//       1440 (#255 F-S4-5); ≤420 may grow (#153), recorded.
//   C1  Dismiss on a detected row → each .reason-chip: box centre vs
//       .reason-text centre ±1 (#255 F-S4-2); the note slot laid out, hidden.
//   C2  Confirm rect BEFORE and AFTER choosing "Other" — identical (F-S4-3);
//       Confirm enabled after a reason (title gone); click with the empty
//       note → focus on the note + aria-invalid (F-S4-4).
//   S1  Fenced off → Confirm; Assert on an absent row → two staged rows
//       (h, the word, the intent); Apply row (h, "2 corrections staged");
//       no band, no lock, the results dimmed behind the ribbon, download
//       buttons live (#254 disclose-don't-lock).
//   A1  Apply → the band sampled at 100 ms: rising edges (mounts) = 1,
//       object "after 2 corrections"; fetch log via performance entries:
//       exactly +1 audit and +1 device-breakdown.
//   A2  after settle: two record rows (h; 46 ±1 at 1440), the advisory
//       once, "no corrections staged", Apply disabled with its title, the
//       dim gone.
//   U1  Undo on a record → staged "undo" row, no band; Undo on it → the
//       record back, no request.
//   X   axe on the settled block state (1440: 0; 380: the audit's named
//       four, none in the block).
const L = require("C:/Users/rtmak/Documents/traffic-control-tool/.claude/worktrees/batch-a-block/validation-artifacts/committed/s2-audit-1/audit-lib.js");
const { fs, path } = L;
const OUT = process.argv[2]; const EXPECT = process.argv[3];
const BASE = process.argv[4] || "http://localhost:3001";
const HEALTHZ = process.argv[5] || "http://127.0.0.1:8001/healthz";
const { log } = L.mkLog(OUT);
const results = [];
const check = (tag, id, ok, detail) => { results.push({ tag, id, ok, detail }); log(`[${tag}] ${ok ? "PASS" : "FAIL"} ${id} — ${detail}`); };
const info = (tag, id, detail) => { log(`[${tag}] info ${id} — ${detail}`); };
const SETTLED = /READY FOR TCS REVIEW|PLAN DECLINED|VERIFICATION UNAVAILABLE|REVIEW WARNINGS|REVIEW FLAGS|NEEDS ATTENTION|VERIFIED/;
const AXE_NAMED = { "1440x1000": [], "380x800": ["scrollable-region-focusable", "target-size"] };
const AXE_BASELINE = { "1440x1000": 0, "380x800": 4 };

// ── in-page probes ──
const SAMPLE = () => {
  const band = document.querySelector(".working-band");
  return {
    band: band ? { verb: band.querySelector(".wb-verb")?.textContent ?? null, object: band.querySelector(".wb-object")?.textContent ?? null } : null,
    strip: document.querySelector(".status-bar")?.textContent.trim().replace(/\s+/g, " ") ?? null,
    refusal: !!document.querySelector(".scan-refusal"),
    locked: document.querySelector(".workbench")?.classList.contains("ws-locked") ?? null,
    audits: performance.getEntriesByType("resource").filter((e) => /\/api\/render\/audit(\?|$)/.test(e.name)).length,
    breakdowns: performance.getEntriesByType("resource").filter((e) => /\/api\/render\/device-breakdown/.test(e.name)).length,
  };
};
const ROWS = () => {
  const b = document.getElementById("site-corrections"); if (!b) return null;
  const r = (el) => { const x = el.getBoundingClientRect(); return { top: Math.round(x.top * 10) / 10, h: Math.round(x.height * 10) / 10, left: Math.round(x.left), right: Math.round(x.right), w: Math.round(x.width) }; };
  const rows = Array.from(b.querySelectorAll(".sc-row")).map((el) => ({
    kind: el.classList.contains("sc-apply") ? "apply" : el.classList.contains("sc-staged") ? "staged" : el.classList.contains("sc-record") ? "record" : el.classList.contains("sc-sub") ? "picker" : "scan",
    name: el.querySelector(".sc-name")?.textContent ?? el.querySelector(".sc-disclosure")?.textContent?.slice(0, 40) ?? el.querySelector(".sc-apply-text")?.textContent ?? "",
    word: el.querySelector(".sc-result")?.textContent ?? null, evidence: el.querySelector(".sc-evidence")?.textContent ?? null,
    glyph: el.querySelector(".sc-glyph, .sys-glyph")?.textContent ?? null,
    button: el.querySelector("button") ? { name: el.querySelector("button").textContent.trim(), disabled: el.querySelector("button").disabled, title: el.querySelector("button").getAttribute("title"), right: Math.round(el.querySelector("button").getBoundingClientRect().right), h: Math.round(el.querySelector("button").getBoundingClientRect().height) } : null,
    ...r(el),
  }));
  const dl = Array.from(document.querySelectorAll(".dl-btn"));
  const foot = b.querySelector(".sc-foot");
  return {
    blockW: Math.round(b.getBoundingClientRect().width), rows,
    advisory: b.querySelectorAll(".sc-foot-advisory").length, footText: foot?.textContent.trim().replace(/\s+/g, " ") ?? null,
    stale: !!document.querySelector(".results-stale"), ribbons: Array.from(document.querySelectorAll(".stale-ribbon")).map((x) => x.textContent.trim().replace(/\s+/g, " ")),
    dlAll: dl.length, dlOn: dl.filter((x) => !x.disabled && x.getAttribute("aria-disabled") !== "true").length,
    band: !!document.querySelector(".working-band"), locked: document.querySelector(".workbench").classList.contains("ws-locked"),
  };
};
const CHIPS = () => {
  const p = document.querySelector(".site-correction-picker"); if (!p) return null;
  const chips = Array.from(p.querySelectorAll(".reason-chip")).map((c) => {
    const b = c.getBoundingClientRect(); const t = c.querySelector(".reason-text").getBoundingClientRect();
    return { label: c.querySelector(".reason-text").textContent, box: [Math.round(b.left * 10) / 10, Math.round(b.right * 10) / 10], text: [Math.round(t.left * 10) / 10, Math.round(t.right * 10) / 10], boxC: Math.round(((b.left + b.right) / 2) * 10) / 10, textC: Math.round(((t.left + t.right) / 2) * 10) / 10, h: Math.round(b.height) };
  });
  const note = p.querySelector(".site-correction-note"); const nb = note.getBoundingClientRect(); const ncs = getComputedStyle(note);
  const confirm = p.querySelector("button.confirm"); const cb = confirm.getBoundingClientRect();
  return {
    chips, note: { w: Math.round(nb.width), h: Math.round(nb.height), left: Math.round(nb.left), top: Math.round(nb.top), visibility: ncs.visibility, display: ncs.display, isVoid: note.classList.contains("is-void"), disabled: note.disabled, ariaHidden: note.getAttribute("aria-hidden"), tabIndex: note.tabIndex, ariaInvalid: note.getAttribute("aria-invalid"), placeholder: note.placeholder, focused: document.activeElement === note },
    confirm: { left: Math.round(cb.left), top: Math.round(cb.top), w: Math.round(cb.width), h: Math.round(cb.height), disabled: confirm.disabled, title: confirm.getAttribute("title") },
    pickerH: Math.round(p.getBoundingClientRect().height),
  };
};

async function pin(page) {
  await page.goto(BASE + "/sandbox", { waitUntil: "networkidle", timeout: 120000 }); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Enter manually", exact: true }).click();
  const fill = async (l, v) => { await page.locator(`label:text-is("${l}")`).locator("xpath=following-sibling::input[1]").fill(v); };
  await fill("Latitude", "39.726900"); await page.getByRole("button", { name: "Edit manually", exact: true }).click();
  await fill("Longitude", "-104.987300"); await fill("Bearing (° from N)", "180"); await fill("Work zone (ft)", "1000");
  const t0 = Date.now(); while (Date.now() - t0 < 40000) { const s = await page.evaluate(SAMPLE); if (s.strip && !/VERIFYING/.test(s.strip)) break; await page.waitForTimeout(300); }
}
// Sample until the band has been seen and gone and the strip is settled
// (or a refusal container is up).  Returns the samples + band mounts.
async function sampleUntilSettled(page, label, maxMs, requireBand) {
  const t0 = Date.now(); const samples = []; let seen = false, settledAt = null, mounts = 0, prevBand = false;
  while (Date.now() - t0 < maxMs) {
    const s = await page.evaluate(SAMPLE); s.t = Date.now() - t0; samples.push(s);
    if (s.band && !prevBand) mounts++; prevBand = !!s.band; if (s.band) seen = true;
    const settledNow = !s.band && (s.refusal || ((seen || !requireBand) && SETTLED.test(s.strip ?? "")));
    if (settledAt === null && settledNow && (seen || !requireBand)) settledAt = s.t;
    if (settledAt !== null && Date.now() - t0 - settledAt > 1500) break;
    await page.waitForTimeout(100);
  }
  fs.writeFileSync(path.join(OUT, `${label}-samples.json`), JSON.stringify(samples));
  return { samples, settledAt, seen, mounts, last: samples[samples.length - 1], objects: [...new Set(samples.filter((s) => s.band).map((s) => `${s.band.verb} · ${s.band.object}`))] };
}
const block = (page) => page.locator("#site-corrections");
const rowByName = (page, name) => block(page).locator(".sc-row", { hasText: name }).first();
// The radio is the 1px opacity-0 input behind the chip (#245): click the
// chip itself — what a pointer does.
const chip = (page, label) => page.locator(".site-correction-picker .reason-chip", { hasText: label }).first().click();

(async () => {
  const hz = await (await fetch(HEALTHZ)).json();
  log(`healthz ${HEALTHZ} sha ${hz.sha} expect ${EXPECT}`);
  if (hz.sha !== EXPECT) { log("SHA GATE FAILED"); process.exit(2); }
  log(`B1 healthz ${hz.sha} == ${EXPECT}: PASS · base ${BASE}`);
  const browser = await L.chromium.launch();
  for (const vp of [{ width: 1440, height: 1000 }, { width: 380, height: 800 }]) {
    const tag = `${vp.width}x${vp.height}`;
    const page = await browser.newPage({ viewport: vp });
    await pin(page);
    // G — generate on the live scan (a refusal retried once)
    await page.getByRole("button", { name: /Generate plan/ }).click();
    let s = await sampleUntilSettled(page, `${tag}-G`, 120000, true);
    if (s.last.refusal) {
      info(tag, "G", `natural refusal on the live Overpass (#256) — retrying once`);
      await page.getByRole("button", { name: "↻ Retry scan", exact: true }).click();
      s = await sampleUntilSettled(page, `${tag}-G2`, 120000, true);
    }
    if (s.last.refusal) { check(tag, "G generate", false, `refused twice on the live Overpass — block legs skipped (recorded, not faked); strip "${s.last.strip}"`); await page.close(); continue; }
    check(tag, "G generate", !!(await page.$("#site-corrections")) && s.mounts === 1, `settled ${s.settledAt} ms; band mounts ${s.mounts}; ${s.objects.join(" | ")}; strip "${s.last.strip}"`);
    // R1 — every row after settle
    let m = await page.evaluate(ROWS); fs.writeFileSync(path.join(OUT, `${tag}-R1-rows.json`), JSON.stringify(m, null, 1));
    const scan = m.rows.filter((r) => r.kind === "scan"); const applyRow = m.rows.find((r) => r.kind === "apply");
    const tol = vp.width === 380 ? (h) => h >= 45 : (h) => Math.abs(h - 46) <= 1;
    check(tag, "R1 scan rows", scan.length === 5 && scan.every((r) => tol(r.h)), `block ${m.blockW}px; ` + scan.map((r) => `${r.name} ${r.h}`).join(" · ") + ` | ${await L.shot(page, OUT, `${tag}-R1-settled`)}`);
    check(tag, "R1 apply row at zero", !!applyRow && tol(applyRow.h) && applyRow.name === "no corrections staged" && applyRow.button.name === "Apply 0 corrections" && applyRow.button.disabled && applyRow.button.title === "stage a correction first" && m.rows[m.rows.length - 1].kind === "apply",
      applyRow ? `h ${applyRow.h}; "${applyRow.name}"; button "${applyRow.button.name}" disabled ${applyRow.button.disabled} title "${applyRow.button.title}"; button right ${applyRow.button.right} vs scan action right ${scan[0].button.right}` : "no apply row");
    check(tag, "R1 one edge", !!applyRow && Math.abs(applyRow.button.right - scan[0].button.right) <= 1, applyRow ? `Apply right ${applyRow.button.right}; row action right ${scan[0].button.right}` : "no apply row");
    check(tag, "R1 footer", /· apply re-generates the plan$/.test(m.footText) && m.advisory === 0, `"${m.footText}"; advisory ×${m.advisory}`);
    const detected = scan.filter((r) => r.word === "detected"); const absent = scan.filter((r) => r.word !== "detected");
    info(tag, "R1 detected", detected.map((r) => r.name).join(", ") || "none");
    if (detected.length === 0 || absent.length === 0) { check(tag, "R1 rows mix", false, `need a detected AND an absent row for the legs (detected ${detected.length}, absent ${absent.length})`); await page.close(); continue; }
    // C1/C2 — the picker
    await rowByName(page, detected[0].name).getByRole("button", { name: "Dismiss" }).click(); await page.waitForTimeout(150);
    let c = await page.evaluate(CHIPS); fs.writeFileSync(path.join(OUT, `${tag}-C1-chips.json`), JSON.stringify(c, null, 1));
    const off = c.chips.map((x) => Math.round((x.textC - x.boxC) * 10) / 10);
    check(tag, "C1 chip centre", off.every((d) => Math.abs(d) <= 1), c.chips.map((x, i) => `"${x.label}" box ${x.box[0]}..${x.box[1]} text ${x.text[0]}..${x.text[1]} Δ ${off[i]}`).join(" ; ") + ` | ${await L.shot(page, OUT, `${tag}-C1-picker`)}`);
    check(tag, "C1 note slot", c.note.isVoid && c.note.visibility === "hidden" && c.note.display !== "none" && c.note.w === 184 && c.note.disabled && c.note.ariaHidden === "true" && c.note.tabIndex === -1, `void ${c.note.isVoid}; visibility ${c.note.visibility}; display ${c.note.display}; ${c.note.w}×${c.note.h} at ${c.note.left},${c.note.top}; disabled ${c.note.disabled}; aria-hidden ${c.note.ariaHidden}; tabIndex ${c.note.tabIndex}`);
    check(tag, "C2 confirm until a reason", c.confirm.disabled && c.confirm.title === "choose a reason", `disabled ${c.confirm.disabled}; title "${c.confirm.title}"`);
    const before = { ...c.confirm };
    await chip(page, "Other (say what)"); await page.waitForTimeout(150);
    c = await page.evaluate(CHIPS);
    const same = ["left", "top", "w", "h"].every((k) => c.confirm[k] === before[k]);
    check(tag, "C2 confirm still", same && !c.confirm.disabled && c.confirm.title === null && !c.note.isVoid && c.note.visibility === "visible", `before ${before.w}×${before.h} at ${before.left},${before.top}; after ${c.confirm.w}×${c.confirm.h} at ${c.confirm.left},${c.confirm.top}; disabled ${c.confirm.disabled}; title ${c.confirm.title}; note visible ${c.note.visibility} | ${await L.shot(page, OUT, `${tag}-C2-other`)}`);
    await page.getByRole("button", { name: "Confirm dismiss", exact: true }).click(); await page.waitForTimeout(150);
    c = await page.evaluate(CHIPS);
    check(tag, "C2 empty note answers at the note", !!c && c.note.focused && c.note.ariaInvalid === "true" && c.note.placeholder === "say what — required" && (await page.evaluate(SAMPLE)).band === null, c ? `focused ${c.note.focused}; aria-invalid ${c.note.ariaInvalid}; placeholder "${c.note.placeholder}"` : "picker gone");
    // S1 — stage two
    await chip(page, "Fenced off"); await page.getByRole("button", { name: "Confirm dismiss", exact: true }).click(); await page.waitForTimeout(200);
    await rowByName(page, absent[0].name).getByRole("button", { name: "Assert" }).click(); await page.waitForTimeout(300);
    const sBefore = await page.evaluate(SAMPLE);
    m = await page.evaluate(ROWS); fs.writeFileSync(path.join(OUT, `${tag}-S1-rows.json`), JSON.stringify(m, null, 1));
    const staged = m.rows.filter((r) => r.kind === "staged"); const ap = m.rows.find((r) => r.kind === "apply");
    check(tag, "S1 staged rows", staged.length === 2 && staged.every((r) => tol(r.h) && r.glyph === "◌" && r.word === "staged — not yet applied" && r.button.name === "Undo") && staged.some((r) => r.evidence === "dismiss · fenced off") && staged.some((r) => r.evidence === "assert"),
      staged.map((r) => `${r.name} h ${r.h} ${r.glyph} "${r.word}" [${r.evidence}] ${r.button.name}`).join(" ; ") + ` | ${await L.shot(page, OUT, `${tag}-S1-staged`)}`);
    check(tag, "S1 apply row", !!ap && tol(ap.h) && ap.name === "2 corrections staged · not yet applied" && ap.button.name === "Apply 2 corrections" && !ap.button.disabled && ap.button.title === null, ap ? `h ${ap.h}; "${ap.name}"; "${ap.button.name}" disabled ${ap.button.disabled}` : "no apply row");
    check(tag, "S1 disclose, don't lock", !m.band && !m.locked && m.stale && m.ribbons.includes("Previous answer — 2 corrections staged, not yet applied.") && m.dlAll > 0 && m.dlOn === m.dlAll, `band ${m.band}; locked ${m.locked}; stale ${m.stale}; ribbons ${m.ribbons.map((r) => `"${r}"`).join(", ") || "none"}; downloads ${m.dlOn}/${m.dlAll} live; audits ${sBefore.audits}, breakdowns ${sBefore.breakdowns} (unchanged by staging: see A1)`);
    // A1 — apply once
    await block(page).getByRole("button", { name: "Apply 2 corrections", exact: true }).click();
    s = await sampleUntilSettled(page, `${tag}-A1`, 120000, true);
    check(tag, "A1 band once", s.mounts === 1 && s.objects.length === 1 && s.objects[0] === "RE-GENERATING · after 2 corrections", `band mounts ${s.mounts}; objects ${s.objects.join(" | ") || "none"}; settled ${s.settledAt} ms`);
    check(tag, "A1 one request each", s.last.audits === sBefore.audits + 1 && s.last.breakdowns === sBefore.breakdowns + 1, `audit ${sBefore.audits} → ${s.last.audits}; device-breakdown ${sBefore.breakdowns} → ${s.last.breakdowns}`);
    // A2 — settled records
    m = await page.evaluate(ROWS); fs.writeFileSync(path.join(OUT, `${tag}-A2-rows.json`), JSON.stringify(m, null, 1));
    const rec = m.rows.filter((r) => r.kind === "record"); const ap2 = m.rows.find((r) => r.kind === "apply");
    const recTol = vp.width === 380 ? (h) => h >= 45 : (h) => Math.abs(h - 46) <= 1;
    check(tag, "A2 record rows", rec.length === 2 && rec.every((r) => recTol(r.h) && r.button.name === "Undo") && m.rows.filter((r) => r.kind === "staged").length === 0, rec.map((r) => `"${r.name}…" h ${r.h} ${r.glyph}`).join(" ; ") + `; block ${m.blockW}px | ${await L.shot(page, OUT, `${tag}-A2-records`)}`);
    check(tag, "A2 advisory once + reset", m.advisory === 1 && !!ap2 && ap2.name === "no corrections staged" && ap2.button.disabled && !m.stale && m.ribbons.length === 0 && !m.band, `advisory ×${m.advisory}; apply "${ap2?.name}" disabled ${ap2?.button.disabled}; stale ${m.stale}; ribbons ${m.ribbons.length}; foot "${m.footText}"`);
    check(tag, "A2 verify sentence not per row", !rec.some((r) => /verify it in the field/.test(r.name)), rec.map((r) => `"${r.name}"`).join(" ; "));
    // U1 — undo on a record stages; undo on the staged row un-stages; no request either way
    const a0 = (await page.evaluate(SAMPLE)).audits;
    await block(page).locator(".sc-row.sc-record").first().getByRole("button", { name: "Undo" }).click(); await page.waitForTimeout(300);
    m = await page.evaluate(ROWS);
    const undoRow = m.rows.find((r) => r.kind === "staged");
    check(tag, "U1 undo stages", !!undoRow && undoRow.evidence === "undo" && m.rows.filter((r) => r.kind === "record").length === 1 && !m.band && m.ribbons.includes("Previous answer — 1 correction staged, not yet applied."), undoRow ? `"${undoRow.name}" [${undoRow.evidence}] h ${undoRow.h}; records ${m.rows.filter((r) => r.kind === "record").length}; ribbons ${m.ribbons.map((r) => `"${r}"`).join(", ")}` : "no staged row");
    await block(page).locator(".sc-row.sc-staged").first().getByRole("button", { name: "Undo" }).click(); await page.waitForTimeout(300);
    m = await page.evaluate(ROWS); const a1 = (await page.evaluate(SAMPLE)).audits;
    check(tag, "U1 unstage", m.rows.filter((r) => r.kind === "record").length === 2 && m.rows.filter((r) => r.kind === "staged").length === 0 && a1 === a0 && !m.stale, `records ${m.rows.filter((r) => r.kind === "record").length}; staged 0; audits ${a0} → ${a1}; stale ${m.stale}`);
    // X — axe
    const axe = await L.runAxe(page, OUT, `${tag}-axe`);
    const wcag = axe.filter((v) => v.tags.some((t) => /wcag2a$|wcag2aa$|wcag21aa$|wcag22aa$/.test(t)));
    const nodes = wcag.flatMap((v) => v.nodes.map((n) => ({ id: v.id, t: n.target })));
    const inBlock = nodes.filter((n) => /site-correction|sc-/.test(n.t));
    check(tag, "X axe", nodes.length <= AXE_BASELINE[tag] && nodes.every((n) => AXE_NAMED[tag].includes(n.id)) && inBlock.length === 0, `${nodes.length} wcag node(s) (baseline ${AXE_BASELINE[tag]}): ${nodes.map((n) => `${n.id}[${n.t}]`).join(" ; ") || "none"}; in the block ${inBlock.length}`);
    await page.close();
  }
  await browser.close();
  const fails = results.filter((r) => !r.ok);
  log(`RESULT ${fails.length === 0 ? "ALL PASS" : "FAIL"} ${results.length - fails.length}/${results.length}${fails.length ? " — " + fails.map((f) => `[${f.tag}] ${f.id}`).join(", ") : ""}`);
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
})().catch((e) => { log("ERR " + e.stack); process.exit(1); });
