# s2-arc18 — #224 phase 4: corrections and overrides (the last phase)

Arc of record. Branch `issue-224-phase4` from main `9aee784`. GO of
2026-09-04 (all six checkpoint recommendations adopted: home = the
post-generate strip; wire = `meta.siteConditionOverrides`; tier = the
#177 precedent; dismiss needs a reason from a fixed vocabulary; undo per
correction, re-generating; `siteAdjustmentsItem` retires). Six commits;
the ship line is `.\scripts\ship.ps1 -Branch issue-224-phase4`. The #224
close comment comes out of this arc, chat-drafted after the prod run.

## What shipped, per commit

1. `5e4ef0a` — **backend wire + precedence + pin.** `SiteConditionOverride`
   on `ScenarioMeta.siteConditionOverrides` (Pydantic first: an older
   backend drops the key silently). `_apply_corrections` runs AFTER the
   scan's precedence and BEFORE `effective_flags` leave `site_scan.py`,
   on every path: dismiss a detected key ⇒ applied, the flag leaves;
   assert an absent key ⇒ applied, the flag joins; a correction the scan
   agrees with ⇒ moot, disclosed, never dropped (rule 10); without an
   ok scan an assert applies and a dismiss is moot. Each correction is
   disclosed on `provenance.corrections` with the scan's verdict at
   apply time and ONE backend-composed sentence. The cross-field rules
   (a dismiss needs a reason; note iff `other`; an assert takes none;
   one per condition) are an honest 400 `site_condition_override_invalid`
   with `recovery.field`. One `pending_verification` item per applied
   correction, `site_condition_overridden`, label = the sentence (the
   #177 shape and emission point — ruling c). `manual_flags_discarded`
   untouched: a discard and a dismissal never share a field. The pin
   grew by two recorded fixtures (`scanned-dismissed` 1/5/13/3,
   `scanned-asserted` 3/5/11/3 against `scanned-lakewood`'s 2/5/12/2),
   both mirrors + JSON + three harnesses in the one commit, the four
   existing entries byte-identical (the JSON diff's only removed line is
   the `_provenance` sentence). Red run `red-run-c1-pin.txt`: 7 Python +
   7 TS failures with the mirrors at main. Snapshots: `corrections` is
   always present (the phase-1 convention), so 70 corpus + 8 endpoint
   baselines moved by EXACTLY one leaf — `check-only-corpus.txt` proves
   it before the re-baseline (`rebaseline_check.py` /
   `rebaseline_endpoint.py`, the phase-1 scripts adapted).
2. `6beed1a` — **sheet + narrative.** `corrections_disclosure` (the
   sheet's one fixed-obligation line, applied corrections only — the
   notes box has room for a line) and `correction_sentences` (every
   sentence, applied and moot) in `site_scan.py`; the sheet prints
   `SITE CONDITIONS CORRECTED BY OPERATOR — …` before the DRAFT trailer
   (2 lines reserved, never cut); the narrative's `## Site Conditions`
   block renders for NOT-CHECKED, for corrections, or both. Two
   containment fixtures added at zero (eight now). Red run
   `red-run-c2-surfaces.txt`: 7 / 3.
3. `7d62650` — **audit PDF.** The Site Conditions table's Result cell
   says what the plan was built to without losing the scan's verdict
   (`DETECTED — dismissed by operator (<reason>)` keeps the evidence;
   `ASSERTED by operator (scan: none | not reported)`); every sentence
   follows the table verbatim; the proceeded block lists them after the
   NOT-CHECKED detail; the cover follows the classifier. Red run
   `red-run-c3-audit-table.txt`: 6 / 9.
4. `0d6b6f9` — **frontend.** `lib/scenarios/site-corrections.ts` owns the
   markers (one per condition; undo drops the key when the list
   empties — `meta` byte-identical, the #179 shape; a pin move clears
   the list). The strip's "Site conditions — scanned" block: five
   read-only rows from the SERVED scan, Dismiss → reason picker (fenced
   / removed / not in the work zone / other + note) → Confirm, Assert at
   once; a click writes `meta.siteConditionOverrides` (an explicit
   operator action; suggest-never-set) and the plan re-generates; the
   row re-renders as the #227 record (× / ✓ / ⚠ moot + the backend
   sentence as ONE text node + Undo) in the existing `.sys-event`
   variants — no new CSS. Section 03 discloses, never writes: the
   dismissed condition keeps its ✓ row (tag OPERATOR, the sentence as
   evidence), the asserted one's changed row carries the sentence, a
   moot correction is an ℹ reference row. `onPickerSave` clears the
   corrections on a pin move; the snapshot gains the meta line. Red run
   `red-run-c4-frontend.txt`: 13 / 18.
5. `59e9e9a` — **`siteAdjustmentsItem` retires** (ruling f) with its #104
   describe; the five citation-freshness pins rewritten to read
   `SITE_ADJUSTMENT_DETAIL.<flag>.rule` directly, so every pin survives.
6. this commit — evidence: this README, `s2a18-lc-prod.js`, the local
   run, `test-accounting.txt`.

## Local run — `outS2A18Local/` — ALL PASS 42/42 (+5 INFO)

`next dev` on the working tree at `59e9e9a` with `MODAL_RENDER_URL`
pointed at a local uvicorn of the same tree; every wire leg through the
Next proxy routes; Playwright on the real `/sandbox`; the classifier
line computed by the Python mirror over the SERVED audit. Run 1
(`s2a18-lc-run1-superseded.md`) aborted at F3 on a script bug of mine —
a relative output path handed to a Python call with cwd = the repo — and
two device-list checks that read the wrong row field; both fixed in the
committed script; the 22 legs before the abort agreed with run 2.

- **A** — the baseline scanned audit detects intersections, sidewalks
  and bike facilities at Lakewood; R9-9 on the device list; no
  corrections disclosed, no pending item.
- **B** — DISMISS the sidewalk (fenced): applied with `scan_detected`
  true and the sentence `Operator dismissed the scan's pedestrian
  sidewalks: fenced off. The plan is built to the correction — verify it
  in the field or on imagery before deploying.`; `pedestrian_facility`
  leaves the flags and its record no longer fires while the scan still
  says detected; ONE pending item with the sentence verbatim; pending
  1 → 2; `is_clean` false; the device list has no R9-9 — the backend
  re-generated.
- **C** — ASSERT a school zone: applied with the scan's verdict (none);
  `school_zone` joins the flags, its record fires, S1-1 on the device
  list; pending 1 → 2.
- **D** — asserting the detected sidewalk is moot: disclosed, records as
  the baseline, no pending item.
- **E** — a dismiss without a reason: HTTP 400,
  `site_condition_override_invalid`, `Dismissing pedestrian sidewalks
  needs a reason (fenced, removed, not in work zone, other).`,
  `recovery.field = meta.siteConditionOverrides`.
- **F** — the dismissed plan's audit PDF: the Result cell names the
  dismissal, the lead sentence is in the body, and the cover reads
  `1 change · 1 needs attention · 14 checked · 2 pending · reference` —
  the classifier's line over the served dismissed audit (same detected
  set, same corridor outcome).
- **G** — the dismissed plan's sheet carries `SITE CONDITIONS CORRECTED
  BY OPERATOR — pedestrian sidewalks dismissed (fenced off).` before the
  DRAFT trailer; the narrative's `## Site Conditions` block carries the
  sentence verbatim.
- **H** — browser: Generate at Lakewood (8.4 s); the on-screen ledger
  equals the classifier over the browser's own served audit (`2 changes
  · 1 needs attention · 13 checked · 1 pending`); the strip shows "Site
  conditions — scanned" with the sidewalk row; Dismiss → the confirm is
  disabled until a reason is chosen → fenced → Confirm: the next audit
  request carries the marker, the plan re-generates (1.4 s), the ledger
  equals the classifier over the served corrected audit (`1 change · 1
  needs attention · 14 checked · 2 pending`), the row is the × record
  with the sentence and Undo, section 03 shows the dismissed ✓ row with
  the sentence, pending 1 → 2 on the browser's own audits; **Undo: the
  next request's `meta` is byte-identical to the pre-dismiss request's
  `meta`** and the ledger returns to its pre-dismiss line.
- **I** — Assert on the absent School zone row: the marker rides the
  next request, the plan re-generates, the row is the ✓ record, section
  03's changed row carries the sentence with tag OPERATOR.
- **J** — INFO: the pin-move affordance was not reachable by the
  script's selector after "Edit full setup"; the clearing is pinned on
  the real `onPickerSave` (`GeneratorShell.picker-reapply.test`: same pin
  keeps, new pin drops the key).
- **K** — axe post-generate with the block open and a record showing: 1
  violation ≤ baseline 2 in both states — the pre-existing
  `.opacity-80` scope line (s2-arc17's finding, the a11y pile); none of
  the new rows, records, picker controls or buttons is a target.
- **L** — INFO: saved-plan reload carries the corrections — proven at
  test level (the picker-reapply test seeds them through
  `initialScenario`); the sandbox has no save.
- **#243 boundary, recorded not judged:** the Note 8 check reads
  pass=false on the baseline (`6 left, 10 right`), on the asserted plan
  (`7 left, 11 right`) and in the browser with the asserted school zone
  (`8 left, 12 right`). Expected on this divided road; not this arc's
  defect; nothing in the Note 8 checker was touched.

## Rule 5 — churn predicted vs actual

| suite | predicted | actual |
|---|---|---|
| `TieredReference.site-scan.test` | 0 | 0 |
| `SiteConditionsField.rows.test` | 0 | 0 |
| `test_site_scan_ingenerate.py` | discard test 0; suggest-never-set +1 case | discard test 0; the corrected-payload case lives in the new `test_site_scan_corrections.py` (+1 there), the original untouched |
| `AuditTrail.test.tsx` | −12 to −15 at commit 5 | −4 deleted, 5 rewritten in place (the citation pins were worth keeping) |
| `GeneratorShell.suggestion-records.test` | +1 (pin move clears) | 0 — the clearing lives in `onPickerSave`, which that file's stubbed sidebar never reaches; asserted in `GeneratorShell.picker-reapply.test` instead (+2: same pin keeps, new pin drops) |
| expectation entries (4 existing) | 0 | 0 |
| `tests/snapshots` (17) | 0 (additive keys) | **8 endpoint + 70 corpus, one line each** — `provenance.corrections` is always present (the phase-1 convention); proven single-leaf before re-baselining |
| containment | 0 on six; +2 at zero | 0 on six; +2 at zero |
| `deriveRail` sentinel | 0 | 0 |
| `.sys-event` strings | 0 existing changed | 0 existing changed (new strings are new) |
| `test_audit_blocks_site_scan.py` | +2 to +4 | +6 |
| **not in the table:** `test_site_scan_corrections.py`, `test_site_scan_corrections_surfaces.py` | — | new, 14 + 10 |

Two misses go to the #175 ledger: the snapshot leaf (the GO table's
"0 (additive keys)") and the pin-move test's home. Test accounting
(`test-accounting.txt`, measured against a detached worktree of main):
vitest list 893 → 919 (4 removed, 30 added), pytest collected
1992 → 2038 (46 added, 0 removed).

## Contracts — how each was proven

- **Pin:** commit 1 is the only commit touching `tiering.ts` /
  `tier_ledger.py`; both suites run against the one JSON; the four
  pre-existing entries unchanged.
- **#198 byte-identity:** no existing `.sys-event` string changed; the
  container suites unmodified and green.
- **Rail / #228:** `RailEntryId` unchanged; the sentinel suite green.
- **Suggest-never-set:** `test_corrections_never_write_the_wire_scenario`
  (a corrected payload; `sc.model_dump() == before`, `meta.siteConditions`
  stays `{}`); in the browser only the Dismiss / Assert / Undo clicks
  write the marker (H5, I1, H11).
- **Containment:** zero on all eight fixtures, every full run.
- **Rule 3:** every rendered word is a wire field — the sentences are
  the backend's `disclosure`, the reason prose is composed once
  backend-side; the frontend decides rendering and marker shape only.
- **Rule 10:** a moot correction renders as reference, disclosed (D, the
  strip's ⚠ record, section 03's ℹ row, the audit body); undo restores
  `meta` byte-identically (H11, the helper test); a bucket missing from
  the wire renders no row.
- **Rule 13:** glyph + words on the × / ✓ / ⚠ records and the ✓ / ℹ
  rows; axe measured in the run above.
- **Citation counter 19:** no citation minted; the OPERATOR tag mints
  nothing; the five citation pins survive the retirement.
- **Payload senders:** re-grepped before commit 4 — `GeneratorShell.tsx:275,
  327, 632`, `OutputCards.tsx:234`, `QuotePanel.tsx:246, 270`,
  `TieredReference.tsx:155`, `DebugSnapshotButton.tsx:284`,
  `PlanSaveButton.tsx:78, 104` — every one posts the scenario object
  whole; `corridor-spec` posts three spec fields, not the scenario.

## Prod run — `outS2A18Prod/` — 43/44 (+4 INFO) on `6ad83c0`, one real FAIL

Shipped 2026-09-05; `/healthz` == `origin/main` == `6ad83c0` (gate line in
`s2a18-lc.md`). One sha-gated run on the evidence branch
`s2a18-live-checks`, with the pin-move leg rewritten to use the
affordance that is actually on `/sandbox` (the Location step's manual
entry — `GeneratorSidebar` `ManualFallback`, whose Latitude field writes
`meta.lat` through `setMeta`).

Measured on prod: the wire legs A–G all as the local run (baseline
detected set `bike_facilities, intersections, sidewalks`; dismiss
applied with the sentence, R9-9 gone, pending 1 → 2, `is_clean` false;
assert applied, S1-1 present; moot disclosed and inert; the 400 with
its code; the audit-PDF cover `1 change · 1 needs attention · 14 checked
· 2 pending · reference` equal to the classifier over the served
dismissed audit; the sheet's CORRECTED BY OPERATOR line; the narrative
block). In the browser: Generate 5.7 s; the pre-correction ledger
equals the classifier; Dismiss → reason → Confirm carried the marker,
re-generated (24.1 s, a cold container), the × record with the
sentence, section 03's dismissed row, pending 1 → 2, the ledger equal
to the classifier over the served corrected audit; **Undo: the next
request's `meta` byte-identical to the pre-dismiss request's `meta`**
and the ledger back to `2 changes · 1 needs attention · 13 checked · 1
pending`; Assert → the ✓ record, section 03's changed row with tag
OPERATOR. Axe 1 ≤ 2 in both states (the pre-existing scope line).
#243's Note 8 false FAIL recorded on all three divided-road plans, as
expected.

**J1 FAIL — a real defect, not a script judgement.** With the assert on
the wire, editing the Latitude field in the Location step's manual
entry (39.7113 → 39.7114) re-generated at the new pin with
`meta.siteConditionOverrides` still present. The arc's pin-move clearing
lives in `GeneratorSidebar.onPickerSave` (the map picker's Save), and
the manual coordinate fields write `meta.lat` / `meta.lng` through
`setMeta` without passing through it — so a manual pin move keeps the
corrections whose subject (this corridor's scan) no longer exists.
Rule 10. The fix is small and backend-free: clear the corrections in
`GeneratorSidebar.setMeta` (or the two coordinate `onChange`s) whenever
`lat` / `lng` change, the same `withoutSiteCorrections` the picker path
uses, with a mounted test through the manual field. Ryan's call whether
it ships as `fix-224-manual-pin-move` before the #224 close or is filed.
Until then, the corrections survive a manual coordinate edit and are
disclosed everywhere they apply — never silent, but stale.

## J re-check — `outS2A18Prod-J/` — ALL PASS 5/5 on `eb06add`

`fix-224-manual-pin-move` shipped 2026-09-05 (`eb06add`; its own README
under `validation-artifacts/committed/fix-224-manual-pin-move/`). The
script gained `ONLY_J=1`: the gate, then the browser pin → Generate →
Assert → the pin-move leg → axe, nothing else; the J leg itself moved
into `pinMoveLeg`, shared by the full run and the re-check, and now
logs the corrections on the wire at entry. Sha-gated on `/healthz` ==
`origin/main` == `eb06add`: Generate 4.7 s; the assert put
`[{school_zone, assert}]` on the wire (21.6 s, a cold container); the
manual Latitude edit 39.7113 → 39.7114 re-generated (7.3 s) with the
next request carrying `meta.lat 39.7114` and **no
`siteConditionOverrides`** — J1 PASS, the prod defect closed at its own
affordance. Axe after the pin move: 0 violations.

## Post-ship remaining

Ryan's hand-confirm on a hard-refreshed tab; the #224 close comment
chat-drafted; janitorial (`issue-224-phase4`, `fix-224-manual-pin-move`,
`s2a18-live-checks`).
