# s2-arc17 — #224 phase 3: site conditions become counted tier facts

Arc of record. Branch `issue-224-phase3` from main `9814b67`. GO of
2026-09-03 (all checkpoint recommendations adopted; sub-ruling: the
backend adds the feet twin). Seven commits; the ship line is
`.\scripts\ship.ps1 -Branch issue-224-phase3`.

## What shipped, per commit

1. `df4e9ed` — **the pin grows.** `tiering-expectations.json` gains two
   recorded scanned fixtures (`scanned-lakewood`, `scanned-not-checked`,
   TestClient over the pdf_worst_case scanned scenarios + Lakewood, the
   Overpass stub the containment harness uses); the two s2-arc7 entries
   byte-identical. The `audit:scan:*` family on BOTH mirrors in the one
   commit: absent key ⇒ checked (named pass); detected key ⇒ no second
   fact (the evidence rides `audit:site:<flag>`); keyless bucket ⇒
   reference, uncounted; unavailable + proceeded ⇒ ONE counted attention
   fact `audit:scan:not_checked`; not_run / missing bucket ⇒ nothing.
   `SiteScanBucket.nearest_distance_ft` = m / 0.3048 to 0.1 ft, derived
   once backend-side (rule 3/12). Red run `red-run-c1-pin.txt`: JSON +
   fixtures + harness lists staged, mirrors at main — 4 TS + 4 Python
   failures, all the missing scan facts.
2. `c70dfd4` — **sheet + narrative NOT-CHECKED.** One predicate
   (`site_scan.not_checked_disclosure`) for every surface; the sheet
   prints the sentence as a fixed-obligation notes-box line before the
   DRAFT trailer (2 lines reserved, never cut); the narrative prints a
   `## Site Conditions` block before Site-Specific Notes; the three
   render lambdas hand the provenance through. Six real-route tests
   (`red-run-c2-surfaces.txt`: 4 failed / 2 passed at commit 1 — the two
   "prints nothing" cases were already true).
3. `d8478b3` — **audit-PDF body parity (ruling e2).** An ok scan prints
   a Site Conditions table: one row per rule-bearing condition (DETECTED
   with `<count> found · nearest <ft> ft from anchor · <first detail>`,
   or "None along the corridor"; a bucket missing from the wire reads
   "not reported"), reference rows for the keyless buckets, overridden
   manual values disclosed (`red-run-c3-audit-table.txt`: 4 / 5).
4. `1bef92d` — **section 03 rows (rulings b/c/d/e3).** `scanEvidence()`
   and the exported bucket→flag mapping in `lib/tiering.ts`; `CheckRow`
   grows an `evidence` line; detected rows carry the wire's numbers,
   absent conditions render as ✓ "none along the corridor · scanned
   <measured_at>" (OPENSTREETMAP), keyless buckets in the i tier under
   "Site scan — measured, no rule applies"; NOT-CHECKED counted, the ⚠
   chip opens on its count and the phase-2 rider is retired
   (`red-run-c4-scan-rows.txt`: 3 / 2).
5. `1d94e29` — **checkbox retirement (ruling a).** The slim control:
   `limited_sight_distance` + `driveways_present` under "Site conditions
   you assert"; same FieldGroup, same `siteStep`, step numbers untouched
   (`red-run-c5-checkboxes.txt`).
6. `ef7a95d` — **`/render/detect-site` retires end to end (ruling e1).**
   Proxy route + 4 tests, `render-proxy.ts` helpers, backend
   `DetectSiteRequest` + handler + 6 tests; the parity test's path A now
   calls `detect_along_corridor` over the same corridor; ARCHITECTURE.md
   ×3; the schemas.py workLen-cap comment no longer cites the retired
   model. `detect_site_conditions` (point mode) stays — live callers.
7. this commit — evidence: this README, `s2a17-lc-prod.js`, the local
   run, `test-accounting.txt`.

## Local run — `outS2A17Local/` — ALL PASS 17/17 (+2 INFO)

`next dev` on the working tree at `ef7a95d` with `MODAL_RENDER_URL`
pointed at a local uvicorn of the same tree; every wire leg through the
Next proxy routes; Playwright on the real `/sandbox`; the classifier line
computed by the Python mirror over the SERVED audit (the function that
prints the audit-PDF cover). Overpass was slow from this machine, which
handed the run what prod cannot be made to do on demand:

- **A** — a live budget refusal on attempt 1 (`scan budget exceeded
  (20 s)`, 23.9 s), then an ok scan: all five keyed buckets on the wire;
  each detected bucket's `nearest_distance_ft` equals m / 0.3048 to
  0.1 ft (intersections 10.4 m → 34.1 ft, sidewalks 14.2 → 46.6, bike
  21.7 → 71.2) — the rule-12 trace measured on the wire.
- **B** — the scanned audit PDF's Site Conditions table names all five
  conditions; its cover reads `2 changes · 1 needs attention · 12
  checked · 1 pending · reference` — the SAME line the browser's ledger
  showed in E6 over its own served audit (screen == PDF cover ==
  classifier, on the same detected set). B3 logged INFO instead of PASS
  because the script's DETECTED-row regex matched both "Adjacent…" rows
  (counted 4, not 3); fixed in the committed script after the run, the
  captured lines themselves already agree.
- **C** — a LIVE proceeded plan: the plan sheet (43.2 s: 20 s corridor
  budget + 20 s scan budget + layout) and the narrative (20.8 s) both
  carry `SITE CONDITIONS NOT CHECKED — service unavailable at generation.`
  (`C-proceed-sheet.pdf`, `C-proceed-narrative.md`).
- **D** — `/api/render/detect-site` → 404.
- **E** — pre-generate: "Site conditions you assert" with exactly the two
  manual checkboxes and none of the five scanned labels; Generate sends
  `site_scan` on both fetches; the FIRST Generate was refused live in the
  browser (PLAN DECLINED, `F-refused.png`); Retry succeeded; the
  on-screen ledger equals the classifier line over the browser's own
  served audit (`E-browser-served-audit.json`); section 03 names every
  scanned condition per that audit — detected rows with `N found ·
  nearest X ft from anchor`, absent rows "none along the corridor", the
  reference group present.
- **F** — the retry succeeded, so the counted NOT-CHECKED item was not
  exercised in the browser (INFO; proven mounted on the recorded
  `scanned-not-checked` fixture, and on the wire in leg C).
- **G** — axe post-generate: 1 violation ≤ baseline 2 — `color-contrast`
  on `.opacity-80`, the s2-arc7 "Scope: federal MUTCD + CDOT…" line
  inside the ✓ chip, which this check opens before running axe (the
  s2-arc16 check ran with the chip collapsed). Pre-existing chrome, not
  this arc's rows; none of the new rows or evidence lines is a target.
  Noted for the a11y pile.

## Rule 5 — churn predicted vs actual

| suite | predicted | actual |
|---|---|---|
| `TieredReference.site-scan.test` | 1 pin flips | 1 flipped (in commit 1, where the count moved, not commit 4) |
| `SiteConditionsField.rows.test.tsx` | rewritten 7→2 | rewritten 7→2 |
| `route.test.ts` | deleted (4) | deleted (4) |
| `test_render_api_detect_site.py` | deleted (6) | deleted (6) |
| `test_site_scan_ingenerate.py` | path A rewritten, count unchanged | as predicted |
| `GeneratorSidebar.prepin-gating` | 0 | 0 |
| `tests/snapshots` (17) | 0 | 0 |
| containment BASELINE (6 fixtures) | 0 | 0 |
| `deriveRail` sentinel suite | 0 | 0 |
| `test_scan_never_writes_the_wire_scenario` | 0 | 0 |
| **not in the table:** `test_audit_blocks_site_scan.py` | — | 1 pin flipped (`test_ok_scan_prints_nothing_this_phase` → the table), the direct consequence of ruling e2; recorded here honestly |

Test accounting (`test-accounting.txt`, measured against a detached
worktree of main): vitest 883 → 893 (9 removed: 4 route + 3 rows
rewritten + 2 site-scan pins renamed; 19 added), pytest collected
1981 → 1992 (7 removed: 6 detect-site + 1 renamed; 18 added).

## Contracts — how each was proven

- **Pin:** commit 1 is the only commit touching `tiering.ts` /
  `tier_ledger.py` (`git log --stat main..HEAD`); both suites run against
  the one JSON; the two pre-existing entries unchanged (the JSON diff's
  only removed line is the `_provenance` sentence).
- **#198 byte-identity:** no `.sys-event` string changed; the container
  suites (`GeneratorShell.disclosure-container`, `SetupStrip.disclosure`,
  `scan-refusal`, `scan-disclosure`) unmodified and green.
- **Rail / #228:** `RailEntryId` unchanged; `ProgressRail.single-voice`
  unmodified and green.
- **Suggest-never-set:** `test_scan_never_writes_the_wire_scenario` green.
- **Containment:** zero on all six fixtures, every full run.
- **Rule 3:** every rendered number is a wire field (the ft twin derived
  once backend-side; `scanEvidence` joins, never converts).
- **Rule 10:** absent ⇒ named ✓ row; NOT-CHECKED ⇒ counted; not_run and
  a missing bucket ⇒ nothing (pinned on both mirrors and mounted).
- **Rule 13:** glyph + words on every new row (`.ck` ✓ / ℹ, tag column);
  axe measured in the run above.
- **Citation counter 19:** no citation minted; row tags reuse the
  backend-derived `citation` and the OPENSTREETMAP / REFERENCE provenance
  tags.

## Prod runs — `outS2A17Prod/` — ALL PASS 18/18 (+2 INFO) on `371ed5c`

Shipped 2026-09-04; `/healthz` == `origin/main` == `371ed5c` (gate line in
`s2a17-lc.md`). Two runs, minutes apart, both sha-gated, on the evidence
branch `s2a17-live-checks`:

- **Run 1** (`s2a17-lc-run1-superseded.md`, 15:09Z): 17/18. Its single
  FAIL was a script judgement, not a product defect: B3 compared the
  audit-PDF cover line to the classifier over leg A's audit, and the two
  requests differed in a per-request fact — A's corridor check read
  `check_unavailable` (the #241 budget; A took 26.5 s) while the PDF's
  own request had a clean corridor check (`audit:corridor:clean`, +1
  checked). The cover was right for its own audit (`E6` proved the same
  13-checked line against the browser's own served audit). Fixed: B3
  now also requires the corridor outcome to match before claiming
  parity, otherwise INFO.
- **Run 2** (`s2a17-lc.md`, 15:12Z): ALL PASS 18/18. On the wire: every
  keyed bucket present; each detected bucket's `nearest_distance_ft`
  equals m / 0.3048 (10.4 → 34.1, 14.2 → 46.6, 21.7 → 71.2). The
  audit-PDF cover, the on-screen ledger, and the Python classifier over
  the browser's own served audit all print `2 changes · 1 needs
  attention · 13 checked · 1 pending · reference`. Section 03 names all
  five conditions per the served scan; the Setup step is the slim
  control; `/api/render/detect-site` → 404. Axe post-generate 1 ≤ 2
  (the pre-existing `.opacity-80` scope line, as in the local run).
  INFO ×2: both proceed-anyway scans succeeded (the sheet and narrative
  correctly print no disclosure — rule 10's negative, PASS C3) and no
  refusal landed in 4 Generate cycles (8 across both runs), so the
  counted NOT-CHECKED item was not captured on prod; it is captured
  live in `outS2A17Local/` (leg C, sheet + narrative) and pinned mounted
  on the recorded fixture. Never faked.

Latencies on prod, run 2: scanned audit 12.2 s (cold), scanned audit
PDF 4.1 s, proceed-anyway sheet 8.2 s, narrative 0.5 s (memo), browser
Generate 5.6 s; run 1's cold scanned audit 26.5 s and sheet 26.8 s
(corridor check at the 20 s budget). None over 45 s.

## Post-ship remaining

Ryan's hand-confirm on a hard-refreshed tab (#242 window); the #224
phase-3 re-scoping comment chat-drafted; janitorial — the arc branch,
`fix-224-snapshot-wire` (merged), and this evidence branch after it
ships.
