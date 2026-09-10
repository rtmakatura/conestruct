# s2-arc26 — Bucket A: the site-conditions block (#254 batch corrections · #255 layout · #269 CI)

Branch `batch-a-block`, stacked on `issue-269-ci-fix` (800254e), both cut from
`main 224feb9` (prod tip a88caad; healthz == a88caad at the start). GO: Ryan's
ruling of 2026-09-09 (`GO.md`, Bucket A + the three cross-bucket rulings).
Stack order for shipping: `issue-269-ci-fix` (800254e, alone, first) → `batch-a-block`.

## What shipped

| commit | what |
|---|---|
| `800254e` | **#269 CI** — `generate()` in `GeneratorSidebar.manual-pin-move.test.tsx` waits for `.workbench.ws-locked` to drop before the reopen click. Test-only. Ships alone. |
| `95719df` | **backend split (backend-first)** — `SiteScanCorrection.record_clause` (= `disclosure` minus `_VERIFY`, by suffix strip), `SiteScanProvenance.corrections_advisory` (= `_VERIFY.strip()` once when any record applied, else `None`); `disclosure` byte-identical (#198 pinned: pending label == disclosure == clause + `_VERIFY`). pytest +2 (2075 passed, 2 skipped). Two tiering fixtures +2 leaves each; **78 audit snapshots +1 leaf each** (`"corrections_advisory": null`, single-leaf, see Rule-5 churn). `render-types.ts` two optional fields. |
| `031ec1d` | **#255 layout** — chip `justify-content:center` + mirror `::after` 10 px slot; `--sc-row-h: 46px` scoped on `.site-corrections`, `min-height` on every `.sc-row`; `.sc-record` centred, inset 9, `margin: 0 -12px` (≤420: `start`, #153); note input always mounted `flex: 0 0 184px`, `.is-void` (hidden / disabled / aria-hidden / tabIndex −1) until Other; Confirm disabled with `title="choose a reason"` until a reason, then enabled, empty Other note → focus + `aria-invalid` + placeholder "say what — required"; the record row prints `record_clause`; the advisory once as the footer's second line. Red-proved 8. |
| `d62f810` | **#254 lib** — `StagedCorrection { flag; marker \| null }`; `stage` / `unstage` / `applyStaged` / `deriveCorrectionsStanding` / `stagedSentence`; `working-band.ts` +1 branch "after N corrections" (counted by flag; one flag keeps the #252 sentence). Red-proved 6. `WorkingBand.tsx` untouched. |
| `111beec` | **#254 shell + block** — `staged` state in the shell (one owner), `onReopen` clears it; Dismiss→Confirm / Assert / Undo-on-record stage, Undo on a staged row un-stages, **Apply = one `setScenario`**; `.sc-staged` rows (◌ `--none` + "staged — not yet applied" + the intent + Undo); `.sc-apply` row always present post-scan ("no corrections staged" / `stagedSentence`, "Apply N corrections" `.confirm` `data-write`, disabled at 0 with `title="stage a correction first"` and under `inFlight`); footer "apply re-generates the plan"; **disclose, don't lock** — `.results-stale` dim + ribbon "Previous answer — N corrections staged, not yet applied." while staged and settled, downloads live; `SetupStrip.tsx` "None — baseline" → "Not set" (#257 fold, Refs #260, B's hand-off). New `GeneratorShell.batch-corrections.test.tsx` (4). Red-proved 20. |
| `2c85613` | **fix from the local run** — the Apply row's inset is 8/8 (its filled control is 30 tall; 46 − 30 = 16), and its button keeps the action edge when the row wraps at ≤420 (`margin-left: auto`). CSS + pin. |
| this | **evidence** — this README, `s2a26-lc.js`, the run directories. |

## The rulings recorded (GO.md, Bucket A — quoted)

> (1) Staged state in the **shell**; (2) **disclose, don't lock** while staged (`.results-stale` dim + ribbon "Previous answer — N corrections staged, not yet applied."; downloads/quote/save live); (3) additive backend split `record_clause` + `corrections_advisory` (= `_VERIFY.strip()`, once, `None` when no record) — `disclosure` byte-identical, #198 untouched; (4) `--sc-row-h: 46px` on every `.sc-row` kind incl. staged and record; ≤420 may grow (#153); (5) churn as tabled.

> Apply row always present post-scan (P1): "no corrections staged" / `stagedSentence`, button "Apply N corrections" in `.confirm`, `data-write`, disabled at 0 with `title="stage a correction first"`, disabled under `inFlight`. Footer "apply re-generates the plan". Undo on a staged row = `unstage`, no request. Band branch "after N corrections" (declared, `WorkingBand.tsx` untouched).

> #255: chip `justify-content:center` + mirror `::after` slot (measure centre ±1); note input always mounted, `flex:0 0 184px`, `is-void` when not Other; Confirm `title="choose a reason"` until a reason, then enabled; empty Other note → focus + `aria-invalid` + placeholder "say what — required"; record row prints `record_clause`, advisory once in the footer (footer +1 line on first record — recorded P1 residual).

> Commits: 1 CI `waitFor` (**push this alone first so main goes green**) → 2 backend split + two fixture re-baselines (backend-first; Modal + healthz before 3) → 3 #255 layout → 4 #254 lib → 5 #254 shell + block → 6 evidence.

Cross-bucket ruling 3 (the `#fff` hand-offs): *"D's seven `#fff` literals outside its ranges are swapped by their owners … each owner cites `--ink-bright` from D, so D's commit 5 (the token) ships first"* — A's three (`globals.css` :1894 / :2673 / :2710 on 224feb9; :1903 / :2682 / :2719 after D's shift) are **untouched here, pending D's slice**; they swap in the rebase commit. Cross-bucket ruling 3 also hands `SetupStrip.tsx:678` ("None — baseline") to A — folded in 111beec as "Not set" (Refs #260).

## Deviations declared (Rule 5)

- **78 audit snapshots re-baselined** (`tests/snapshots/**`, every file carrying `sections.site_scan.corrections`), one added line each: `"corrections_advisory": null,`. The checkpoint table said "expectation JSON 0; PDF/XLSX/narrative snapshots 0" and listed only the two tiering fixtures; the phase-1 convention ("always present") makes the new provenance field a leaf on every audit answer. Predicted before the diff in the commit message, proven single-leaf: `git diff --numstat 800254e..95719df -- tests/snapshots` → 78 rows of `1 0`; the re-baseline script (`rebaseline_255.py`, below) asserts a byte-identical round-trip through `tests/_snapshot_helper.serialize_snapshot` before inserting the one leaf. The full pytest run (2075 passed) is the proof that the 78 equal the live route. `tiering-expectations.json`, PDF/XLSX/narrative snapshots: 0.
- **`SetupStrip`'s `staged` / `setStaged` props are required** (one owner; a silent no-op default setter would stage into nowhere — rule 10). Five other direct `SetupStrip` test mounts (`disclosure`, `focus`, `jurisdiction` ×2, `schedule`) each gain one line. Not in the table.
- **WriteLock "own reason" case**: at settle, `stillOff` is now exactly `['button.confirm "Apply 0 corrections"']` (its title says why) instead of `[]`. Not in the table (the table named `:140-156`, the held-flow; this is `:192-206`).
- **Apply row layout**: spans both tracks (`grid-column: 1 / -1`, flex `space-between`) rather than sitting in the 92 px action column — "APPLY 2 CORRECTIONS" in the mono register is ~150 px; the button shares the action column's right edge (measured: Apply right 1252 = row action right 1252 at 1440). The checkpoint said "col 2"; the edge is the same.
- **Apply row inset 8/8** (2c85613): the filled control is 30 tall; 46 − 30 = 16.
- **"Apply 0 corrections"** at zero — the literal ruling text ("Apply N corrections"); the 0 traces to the staged set (rule 12).
- **Record-row fallback**: the row prints `c.record_clause ?? c.disclosure` — the whole sentence is the wire before 95719df shipped, never a fabricated value; every test pins `record_clause`.

## Rule-5 churn (predicted → actual)

| test / fixture | predicted | actual |
|---|---|---|
| `manual-pin-move.test.tsx:105` | +1 `waitFor` | +1 `waitFor` (+4-line comment) |
| `scanned-dismissed.json:441`, `scanned-asserted.json:463` | +`record_clause`, +`corrections_advisory` | as predicted (+4/−2 lines each, the −2 = trailing commas) |
| `test_site_scan_corrections.py:172,199` | +clause ==, +advisory once | as predicted, inline; **+2 tests** |
| `tests/snapshots/**` | 0 | **78 × +1 leaf** (declared above) |
| `SetupStrip.corrections.test.tsx:83,96,116` footer | "· apply re-generates the plan" | as predicted (4 occurrences incl. the `#251` short forms) |
| `:136-151` Assert | `setScenario` 0; Apply → 1 | as predicted (+ staged-row shape) |
| `:153-171,167,211` Confirm | enabled after Other; empty note → `aria-invalid` | as predicted (+ title "choose a reason", placeholder, focus) |
| `:209` note absent | present, disabled, aria-hidden | as predicted (+ `is-void`, tabIndex −1) |
| `:225-275,284-296,372-387,396-406,421-439` `getByText(disclosure)` | `getByText(record_clause)`; advisory once in `.sc-foot` | as predicted (+ "none on moot") |
| `:308-332,347-368,414-445` row counts | +1 `.sc-row` | as predicted (6; Apply last; spec-34 buttons +"Apply 0 corrections") |
| `grid-tokens.test.tsx:32-52` | pins `--sc-row-h`, record margin 0 | pins `--sc-row-h`, `min-height`, record `center` + `margin: 0 -12px` + `padding: 9px 11px 9px 9px`, ≤420 `start`; **+1 it** (staged/apply rules; 2c85613 adds the 8/8 + `margin-left: auto` pins) |
| `corrections-tokens.test.tsx:19-31` | +2 | +2 |
| `site-corrections.test.ts` | +5 | +5 |
| `WriteLock.test.tsx:140-156`, `WorkingBand.test.tsx:206-240`, `results-head.test.tsx:331-375` | Assert then Apply; "after 2 corrections" | as predicted (+ WriteLock `:192-206` own-reason, declared) |
| `working-band.test.ts` | +1 | +1 |
| new `GeneratorShell.batch-corrections.test.tsx` | — | +4 |
| five other `SetupStrip.*.test.tsx` mounts | 0 | +1 line each (declared) |
| vitest | 978 → ~992 | **978 → 991** (134 files) |
| pytest | +2 | +2 (2075 passed, 2 skipped) |
| expectation JSON, PDF/XLSX/narrative snapshots | 0 | 0 |

## Contracts

- **#198** honoured: `disclosure` byte-identical; the pending item, audit PDF, crew narrative, plan sheet and section 03 unchanged (the new test asserts `label == disclosure == record_clause + _VERIFY`; `correction_sentences` / `corrections_disclosure` untouched).
- **Suggest-never-set** honoured: only Apply writes `meta.siteConditionOverrides`; staging never touches the scenario or a saved plan.
- **Rule 3**: the split is the backend's (`site_scan.py`); the frontend prints. `deriveCorrectionsStanding` counts and looks up only.
- **Rule 10**: `corrections_advisory` is `None` (not `""`) without an applied record and the footer prints nothing; staged rows say "not yet applied"; the standing derives from the served scan (no ok scan → buckets contribute 0).
- **Rule 12**: 46 = the measured scan row (F-S4-5); 184 = the measured note (F-S4-3); 8/8 = 46 − the measured 30 px control; "Apply 0 corrections" — the 0 is the staged set's length.
- **Rule 13**: ◌ + "staged — not yet applied" in `--none` (6.60:1 per `globals.css:748`); Apply reuses Confirm's `--sc-act-wash` + `--act-bright` (6.15:1, arc-21 measured); the staged dim carries its ribbon text.
- **Payload senders of `meta.siteConditionOverrides`** (grep on 2c85613): `GeneratorShell.tsx:363,419,751`, `OutputCards.tsx`, `QuotePanel.tsx`, `TieredReference.tsx`, `PlanSaveButton.tsx`, `DebugSnapshotButton.tsx`, `render-proxy.ts` — **none edited; shape unchanged** (the batch test reads the wire: `[{flag:"school_zone",action:"assert"},{flag:"pedestrian_facility",action:"dismiss",reason:"fenced"}]`, no `reason` on the assert, no `note` on the dismiss).
- **Write-lock declarations**: +1 `data-write` (Apply), +1 on the staged row's Undo, +1 the always-mounted note (`data-write`, disabled while void); every one enumerated by `WriteLock.test.tsx` (`walk(true)` = `[]` under the lock).
- **Band rules**: `.sugg-row` / `.sys-event` / `.sugg-name` byte-identical (pinned by `grid-tokens` "band's shared rules"); `WorkingBand.tsx` untouched; `working-band.ts` +1 branch (declared).
- **Spec 31** untouched (refusal never co-frames the band — the batch test's Apply flight samples the band only). **Citation counter 19** untouched. **Expectation JSON** untouched. **Containment** untouched (backend prints nothing new).
- `getByText` reads direct text nodes only — every new pin uses it that way; the record sentence stays ONE text node.
- **D's type census** (hand-off note): selectors added in `globals.css` — `.reason-chip::after`, `.site-correction-note.is-void`, `.site-correction-note[aria-invalid="true"]`, `.sc-foot .sc-foot-advisory`, `.sc-glyph.sc-staged`, `.sc-result.sc-staged`, `.sc-row.sc-apply` (+ its ≤420 twin), `.sc-apply .sc-apply-text`, `.sc-apply button.confirm` (+ hover, + ≤420 `margin-left`), `.sc-row.sc-record` inside ≤420. **Zero `font-size` declarations added or changed**; the Apply row's text takes `.tr-prov`, its button the picker's Confirm register. Components: no new `text-*` classes.

## Local run (`s2a26-lc.js`)

Stack: `next dev -p 3001` with `MODAL_RENDER_URL=http://127.0.0.1:8001`; the local FastAPI `uv run --extra dev uvicorn src.api.render_api:app --port 8001` with `RENDER_API_SECRET` = the worktree `.env.local`'s `MODAL_RENDER_SECRET` and `GIT_SHA` = the checkout, so the harness's sha gate reads the LOCAL `/healthz` (the backend answered every request: its log shows `POST /render/audit 200` for the run below). Live Overpass, Denver pin 39.7269, −104.9873 (the arc-25 pin). Both viewports on one page each: pin → Generate → the block legs → Apply → Undo → axe.

### Run 1 — sha `111beec` — **39/42** (the three fails are the two findings fixed in 2c85613)

The console log, verbatim (the run directory was deleted by the operator before run 2 — my error; the samples / screenshots / JSON of this run are lost, the log survives here; Ryan's prod run re-takes every figure):

```
[1440x1000] PASS G generate — settled 6978 ms; band mounts 1; GENERATING · new plan · pin 39.7269, -104.9873; strip "VERIFIED · 3 plan flags ▸REVIEW FLAGS"
[1440x1000] PASS R1 scan rows — block 1100px; Adjacent at-grade intersection 46 · Adjacent interchange (highway ramps) 46 · Pedestrian sidewalks 46 · Bike lane / cycleway 46 · School zone 46
[1440x1000] FAIL R1 apply row at zero — h 48; "no corrections staged"; button "Apply 0 corrections" disabled true title "stage a correction first"; button right 1252 vs scan action right 1252
[1440x1000] PASS R1 one edge — Apply right 1252; row action right 1252
[1440x1000] PASS R1 footer — "scancorridor scan · 9 sep · 19:05 utc · 3.4 s · memoised · apply re-generates the plan"; advisory ×0
[1440x1000] info R1 detected — Adjacent at-grade intersection, Adjacent interchange (highway ramps), Pedestrian sidewalks, Bike lane / cycleway
[1440x1000] PASS C1 chip centre — "Fenced off" box 580.8..690.8 text 605.8..665.8 Δ 0 ; "Removed" box 696.8..788.8 text 721.8..763.8 Δ 0 ; "Not in the work zone" box 794.8..964.8 text 819.8..939.8 Δ 0 ; "Other (say what)" box 970.8..1116.8 text 995.8..1091.8 Δ 0
[1440x1000] PASS C1 note slot — void true; visibility hidden; display block; 184×27 at 188,569; disabled true; aria-hidden true; tabIndex -1
[1440x1000] PASS C2 confirm until a reason — disabled true; title "choose a reason"
[1440x1000] PASS C2 confirm still — before 135×30 at 380,568; after 135×30 at 380,568; disabled false; title null; note visible visible
[1440x1000] PASS C2 empty note answers at the note — focused true; aria-invalid true; placeholder "say what — required"
[1440x1000] PASS S1 staged rows — Adjacent at-grade intersection h 46 ◌ "staged — not yet applied" [dismiss · fenced off] Undo ; School zone h 46 ◌ "staged — not yet applied" [assert] Undo
[1440x1000] FAIL S1 apply row — h 48; "2 corrections staged · not yet applied"; "Apply 2 corrections" disabled false
[1440x1000] PASS S1 disclose, don't lock — band false; locked false; stale true; ribbons "Previous answer — 2 corrections staged, not yet applied."; downloads 4/4 live; audits 5, breakdowns 5
[1440x1000] PASS A1 band once — band mounts 1; objects RE-GENERATING · after 2 corrections; settled 17986 ms
[1440x1000] PASS A1 one request each — audit 5 → 6; device-breakdown 5 → 6
[1440x1000] PASS A2 record rows — "Operator dismissed the scan's adjacent a…" h 46 × ; "Operator asserted school zone — the scan…" h 46 ✓; block 1100px
[1440x1000] PASS A2 advisory once + reset — advisory ×1; apply "no corrections staged" disabled true; stale false; ribbons 0
[1440x1000] PASS A2 verify sentence not per row
[1440x1000] PASS U1 undo stages — "Adjacent at-grade intersection" [undo] h 46; records 1; ribbons "Previous answer — 1 correction staged, not yet applied."
[1440x1000] PASS U1 unstage — records 2; staged 0; audits 6 → 6; stale false
[1440x1000] PASS X axe — 0 wcag node(s) (baseline 0): none; in the block 0
[380x800] PASS G generate — settled 14449 ms; band mounts 1; GENERATING · new plan · pin 39.7269, -104.9873; strip "VERIFIED · 3 plan flags ▸REVIEW FLAGS"
[380x800] PASS R1 scan rows — block 332px; Adjacent at-grade intersection 84.6 · Adjacent interchange (highway ramps) 118.8 · Pedestrian sidewalks 84.6 · Bike lane / cycleway 84.6 · School zone 57.8
[380x800] PASS R1 apply row at zero — h 70; "no corrections staged"; button "Apply 0 corrections" disabled true title "stage a correction first"; button right 207 vs scan action right 338
[380x800] FAIL R1 one edge — Apply right 207; row action right 338
[380x800] PASS R1 footer — "scancorridor scan · 9 sep · 19:07 utc · 3.9 s · apply re-generates the plan"; advisory ×0
[380x800] PASS C1 chip centre — "Fenced off" box 42..148 text 65..125 Δ 0 ; "Removed" box 154..242 text 177..219 Δ 0 ; "Not in the work zone" box 42..208 text 65..185 Δ 0 ; "Other (say what)" box 42..184 text 65..161 Δ 0
[380x800] PASS C1 note slot — void true; visibility hidden; display block; 184×27 at 42,606; disabled true; aria-hidden true; tabIndex -1
[380x800] PASS C2 confirm until a reason — disabled true; title "choose a reason"
[380x800] PASS C2 confirm still — before 135×30 at 44,640; after 135×30 at 44,640; disabled false; title null; note visible visible
[380x800] PASS C2 empty note answers at the note — focused true; aria-invalid true; placeholder "say what — required"
[380x800] PASS S1 staged rows — Adjacent at-grade intersection h 84.6 ◌ "staged — not yet applied" [dismiss · fenced off] Undo ; School zone h 84.6 ◌ "staged — not yet applied" [assert] Undo
[380x800] PASS S1 apply row — h 70; "2 corrections staged · not yet applied"; "Apply 2 corrections" disabled false
[380x800] PASS S1 disclose, don't lock — band false; locked false; stale true; ribbons "Previous answer — 2 corrections staged, not yet applied."; downloads 4/4 live; audits 5, breakdowns 5
[380x800] PASS A1 band once — band mounts 1; objects RE-GENERATING · after 2 corrections; settled 20717 ms
[380x800] PASS A1 one request each — audit 5 → 6; device-breakdown 5 → 6
[380x800] PASS A2 record rows — "Operator dismissed the scan's adjacent a…" h 76.4 × ; "Operator asserted school zone — the scan…" h 76.4 ✓; block 332px
[380x800] PASS A2 advisory once + reset — advisory ×1; apply "no corrections staged" disabled true; stale false; ribbons 0
[380x800] PASS U1 undo stages — "Adjacent at-grade intersection" [undo] h 84.6; records 1; ribbons "Previous answer — 1 correction staged, not yet applied."
[380x800] PASS U1 unstage — records 2; staged 0; audits 6 → 6; stale false
[380x800] PASS X axe — 2 wcag node(s) (baseline 4): scrollable-region-focusable[.gap-8] ; target-size[.strip-edit-all]; in the block 0
RESULT FAIL 39/42 — [1440x1000] R1 apply row at zero, [1440x1000] S1 apply row, [380x800] R1 one edge
```

**Row-height table (run 1, 111beec).** 1440 (block 1100 px): scan 46 ×5 · picker row (not measured separately; Confirm 135×30) · staged 46 ×2 · record 46 ×2 · **apply 48 → 46 after 2c85613 (pending prod)**. 380 (block 332 px, under the block's own ≤420 query — #153 growth permitted): scan 84.6 / 118.8 / 84.6 / 84.6 / 57.8 (the ledger line wraps to two–three lines), staged 84.6 ×2, record 76.4 ×2, apply 70 (wrapped) — recorded, not a defect under ruling (4).

**The three fails → 2c85613.** Apply row 48 at 1440 (9/9 around a 30 px control) → inset 8/8. At 380 the wrapped Apply button sat on the start edge (207 vs 338) → `margin-left: auto`. Both are CSS in the block's ranges, pinned by `grid-tokens`. **Their browser figures are pending Ryan's prod run** (below).

**P4 chip centre**: Δ 0 on all four chips at both viewports. **P6 Confirm**: rect identical before/after Other at both viewports (135×30 at the same origin). **P7 band once**: 1 mount per Apply at both viewports, object "after 2 corrections"; audit 5→6, breakdown 5→6 (staging left both at 5). **Disclose**: downloads 4/4 live behind the dim at both viewports. **Advisory once** (×1) with two records; record rows carry no "verify it in the field". **axe**: 1440 0; 380 two of the audit's named four (`.gap-8`, `.strip-edit-all`), none in the block.

### Runs 2 and 3 — sha `2c85613` — refused by Overpass (#256), 0/2 each

`outS2A26Local-refused-run2/` and `outS2A26Local/`: at both viewports the live scan refused twice (the harness's built-in retry): strip "PLAN DECLINED · see the notice in the Results zone. SERVICE UNAVAILABLE". A direct authenticated POST to the local `/render/audit` with the same pin answered 400 `site_scan_unavailable` — `"error":"scan budget exceeded (20 s)","mirror":null,"overpass_remark":null,"duration_ms":20617` — no mirror answered inside the budget (run 1, ten minutes earlier from the same machine, scanned in 3.4 s). Recorded per the brief (retry once; do not loop); nothing was faked. The local backend's log confirms the 400s came from the scan, not auth (`POST /render/device-breakdown 200` alongside).

### Pending prod (Ryan's run, sha-gated on the merged tip)

`node s2a26-lc.js outS2A26Prod <sha> https://www.conestruct.com https://rtmakatura--conestruct-render-fastapi-app.modal.run/healthz` — every figure above re-taken; specifically the Apply row at 46 (1440) and its button on the action edge at 380 after 2c85613. Hand-check (GO): stage two corrections, Apply once, one band cycle, rows 46 px, chips centred, Other keeps Confirm still.

## Prod run at b72e358 (`outProd-b72e358/`)

First line of the run: `healthz … sha b72e358580aac0246804352cf0cb754df31b4dbd expect b72e358580aac0246804352cf0cb754df31b4dbd` — Modal == `git rev-parse HEAD` of `s2-arc26-batch-block-prod` (cut from `origin/main` b72e358). Base `https://www.conestruct.com`, live Overpass, Denver pin (no refusal — Lakewood not needed; the harness gained optional `[lat] [lng]` args for that case).

**Finding first — run 1 (`outProd-b72e358-run1-oldfrontend/`, 01:13 UTC):** Modal already answered b72e358 but www.conestruct.com still served the previous frontend (CSS `1933233096b42b58.css`, no `.sc-apply`; the footer read "a correction re-generates the plan"): `R1 apply row` / `one edge` / `footer` FAIL, then the harness stopped on the old DOM. Not a product defect — the Vercel build lagged the Modal deploy (CLAUDE.md: "Vercel ~2 min behind"). A sha-gate on Modal alone does not prove the frontend; the run polled prod's CSS for `sc-apply` (present at 01:14:07 UTC, `814f266c046586ad.css`) and re-ran. Recorded as the gap it is.

**Run 2 — ALL PASS 42/42**, both viewports:

| leg | 1440×1000 | 380×800 |
|---|---|---|
| G generate | band mounts 1, settled 1195 ms | band mounts 1, 1315 ms |
| R1 scan rows | 46 ×5 | 84.6 / 118.8 / 84.6 / 84.6 / 57.8 (≤420 growth, #153) |
| R1 Apply row at zero (**was pending**: 48 locally at 111beec) | **h 46**; "Apply 0 corrections" disabled, title "stage a correction first"; right 1252 = action right 1252 | **h 68** (wrapped); **right 338 = action right 338** (was 207 locally) |
| R1 footer | "… · apply re-generates the plan", advisory ×0 | same |
| C1 chip centre | Δ 0 ×4 | Δ 0 ×4 |
| C1 note slot | 184×27, void / hidden / disabled / aria-hidden / tabIndex −1 | same |
| C2 Confirm until a reason | disabled, title "choose a reason" | same |
| C2 Confirm still after Other | 135×30 at 380,382 → 135×30 at 380,382 | 135×30 at 44,577 → same |
| C2 empty note | focused, aria-invalid, "say what — required" | same |
| S1 staged rows | 46 ×2 (◌, "staged — not yet applied", [dismiss · fenced off] / [assert], Undo) | 84.6 ×2 |
| S1 Apply row at two | h 46, "2 corrections staged · not yet applied", enabled | h 68 |
| S1 disclose, don't lock | no band, not locked, stale + ribbon, downloads 4/4 live, audits 4 / breakdowns 4 | same |
| A1 band once | 1 mount, "RE-GENERATING · after 2 corrections", settled 1758 ms | 1 mount, 1200 ms |
| A1 one request each | audit 4→5, breakdown 4→5 | same |
| A2 record rows | 46 ×2 | 76.4 ×2 |
| A2 advisory once + reset | ×1; "no corrections staged"; stale gone | same |
| U1 undo stages / unstage | [undo] h 46; audits 5→5 | [undo] h 84.6; 5→5 |
| X axe | 0 | 2 of the named four (`.gap-8`, `.strip-edit-all`), none in the block |

Every figure equals the local run 1 at 111beec except the two the fix 2c85613 targeted (Apply row 48 → 46; 380 button edge 207 → 338). Screenshots and per-leg JSON in `outProd-b72e358/`.

## Principles (DESIGN-PRINCIPLES.md P1–P16)

| P | verdict | where |
|---|---|---|
| P1 reserve, never reflow | honoured — Apply row always present; the note slot 184 px laid out while void; `min-height` rows. Residual: the footer grows one line on the first applied record (`SetupStrip.tsx` footer, `.sc-foot-advisory`). | `SetupStrip.tsx` Apply row; `globals.css` `.site-correction-note` |
| P2 one derivation | honoured — `deriveCorrectionsStanding` / `stagedSentence` (shell state read by the block and the ribbon; handed to B's chip) | `lib/scenarios/site-corrections.ts` |
| P3 name the step | honoured — "Apply N corrections", "staged — not yet applied", "apply re-generates the plan" | |
| P4 one action edge | prod b72e358: Apply right = action right at both viewports (1252 / 338); chip label Δ 0. | `globals.css` `.sc-row.sc-apply` |
| P5 | honoured | |
| P6 one row height | prod b72e358: 46 at 1440 for scan / staged / record / Apply; 380 grows under ≤420 (#153, ruled) | `globals.css` `--sc-row-h` |
| P7 abandonable | honoured — disclose, don't lock: downloads 4/4 live while staged; Undo on a staged row un-stages without a request; band once per Apply | `GeneratorShell.tsx` `stagedDisclose` |
| P8 | honoured | |
| P9 the disable says why | honoured — Confirm `title="choose a reason"`, Apply `title="stage a correction first"`; the empty Other note answers at the note (`aria-invalid`, placeholder) | `SetupStrip.tsx` Confirm / Apply buttons |
| P10 | n/a (#153; Apply 30 px like Confirm — noted) | |
| P11 tokens only | honoured — no new hex; `--none`, `--sc-act-wash`, `--act-bright`, `--warn`, `--rule` | |
| P12 | hand-check | |
| P13 | honoured | |
| P14 | honoured | |
| P15 | honoured | |
| P16 last honest state | honoured — the staged ribbon names the count; the flight's ribbon replaces it; the advisory prints only when the wire carries it | |

## Files

- `s2a26-lc.js` — the harness (usage in its header).
- `outS2A26Local-refused-run2/`, `outS2A26Local/` — the two refused runs at 2c85613 (log, samples).
- `rebaseline_255.py` — the single-leaf re-baseline used in 95719df (round-trip asserted).
- Run 1's directory: lost (stated above).
