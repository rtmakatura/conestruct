# #450 walk evidence (2026-11-07)

This is a local walk; the production check follows the ship. Setup: `next dev` on the issue-450 worktree, with the local backend from `ux-group3-where/evidence/script/serve_replay.py` (Overpass replayed from a scratchpad copy of the recorded answers) and `/api/road-bearing` stubbed from the recorded fixture. Plan: 1600 E Colfax Ave, Denver, kind Shoulder, One-way, Generate through the page. Browser: Chromium at DPR 2, 1440x900 and 390x844. Scripts: `script/walk.mjs`, then `script/pdf_page1.py` on the audit PDF. Numbers are in `walk/walk.json` and, for the PDF fetch, in a 1440-only pass, `walk/walk-pdf-pass.json`. The gate header went through `scripts/gate.cjs` `newGatedContext`; the dev server ran with a walk-only token (rulings X12).

## Results (both widths unless named)

| Check | Result |
|---|---|
| Strip, questions open | "Plan ready. Answer 3 quick questions before you send it." (the field-check sentence shows only once no question is open) |
| Strip, after answering the 3 NEEDS YOU questions with their first option | "Plan ready. 1 item above and 3 under Not checked yet need a check before field use." |
| Rule-check rows closed, lines per title line | 1440: 1,1,1,1,1,1,1,1 (all 8 on one line). 390: 2,2,3,2,3,3,2,2 (walk.json order: both sides, G20-5P, speed, lighting, AADT, intersection, interchange, school) |
| Ruling 2's example | "Signs on both sides of one-way street: Not required · 0 left, 10 right", letter for letter |
| One row opened | The full sentence first, then Fig. 6P-3 Note 1's quote and the Denver line, then "Source: CDOT S-630-1 (July 2026) Sheet 2, General Note 8", the same text as before |
| Search for "Signs placed" (now only in the detail) | "7 matching lines, in 2 sections"; the both-sides row opens with "Opened because the match is inside." and "Signs placed" marked in its sentence |
| Placeholder | 390: "Search: taper, 6B, sidewalk", whole (scrollWidth ≤ clientWidth, box 360 px). 1440: #443's wording, whole (878 px) |
| axe (strip; checked section closed, opened, search) | 0 violations in every state |
| 44 px sweep | 17 targets closed and opened, 12 in search, 0 under 44 px; horizontal overflow 0 |
| Page errors | 0 |
| Audit PDF (`/api/render/audit-pdf`, the page's own audit body) | 4 pages. Page 1 "Plan status: 2 changes · 4 needs attention · 13 checked · 3 not checked yet · reference". Page 4: heading "Not checked yet", "2 reference(s) not checked yet.", and the site table's "No devices added: the cross-street approach layout isn't generated. See Not checked yet." "pending" anywhere in the PDF: none |
| Gate header (walk-script rule) | Origins the page itself requested (`hostsSeen`): localhost:3450, api.mapbox.com, events.mapbox.com, the Clerk dev host. `gatedHosts` (localhost:3450 only) is the helper's `isSiteRequest` predicate applied to `hostsSeen`, not a measurement of the header on the wire, and redirect hops the helper follows inside `route.fetch` never reach the page's listener. The hop-level proof is the unit tests in `conestruct/site/tests/gate-helper.test.ts` (site → Clerk → site chain: header on the site hops only; a GET after a 303 sends no body). The walk's own result: the generator rendered and a plan generated at both widths, which the gate allows only with the header on the site's hops |

Cover vs list: page 1 counts 3 (the tier ledger, which also counts the unknown work-hours row), and page 4's list counts 2 (the backend's `pending_verification.count`). That split predates this branch; the strip's 3 matches the cover's 3.

## Crops (`walk/`), each opened and checked

- `1440-01-strip.png`, `390-01-strip.png`: the strip with the questions open ("Answer 3 quick questions").
- `1440-06-strip-no-question-open.png`, `390-06-strip-no-question-open.png`: "… 3 under Not checked yet need a check before field use." on one line at 1440.
- `1440-02-placeholder.png`: #443's wording. `390-02-placeholder.png`: "Search: taper, 6B, sidewalk", whole, no ellipsis.
- `1440-03-checked-rows-closed.png` (re-cropped in repair round 1): "Checked and passed" opened, every row closed; the 8 rule-check rows each read title, then the short result, on one line, and the intersection row reads "No devices added · cross-street layout not generated". `390-03-checked-rows-closed.png`: the same rows at 390, 2 to 3 lines each and no longer a paragraph.
- The driveways and no-move sight-distance rows aren't on this plan, so their short results ("Keep access gaps · no devices across driveways", "No signs moved · Engineer sets locations · add signs where sight is blocked") are pinned by `tests/test_not_checked_yet_450.py`, not walked. Their one-line fit at 1440 is not measured.
- `1440-04-checked-one-row-open.png`, `390-04-checked-one-row-open.png`: the both-sides row open: the sentence, the quote and the Source line inside the detail, the short result on the head.
- `1440-05-search-inside-detail.png`, `390-05-search-inside-detail.png`: "Signs placed" found inside the both-sides row's detail and marked.
- `pdf-page-1.png`: the audit PDF cover; "Plan status … 3 not checked yet · reference". `pdf-page-4.png`: the "Not checked yet" heading, its first line, and "See Not checked yet." in the Site Adjustments table.

## What the walk found, and where it went

- **The gate header reached Clerk** on the first walk with `newGatedContext`. Cause: a `route.continue`'d request keeps the added header on every redirect hop. Recorded in `first-walk-gate-hosts.txt` (that run's console line; its walk.json was overwritten by the re-runs). The fix went into the shared helper (rulings X11 amendment), and the walk was re-run; the standing proof is the chain test in `conestruct/site/tests/gate-helper.test.ts`.
- **The local gate refused a copy of the real token**, because Next's dotenv expansion rewrites its `$`. The walk now uses a walk-only token (X12).
- **The PDF fetch first returned 400**: `include_scan_token` and `include_breakdown` are accepted only on `/render/audit`. The walk drops both before posting.
- First full pytest run: 5 failures in `tests/test_audit_pdf.py` (`pytest-failures-1.txt`), all deterministic, fixed by checkpoint Amendment 1.

Red proofs on the base: `red-pytest-on-base.txt` (11 of the new backend tests fail) and `red-vitest-on-base.txt` (5 of 9 new mounted tests fail; the 4 that pass are guards that hold on the base too: Rule 10, a failing check in section 3, the wide placeholder, the section's name). Snapshot re-baseline: `rebaseline-output.txt` (78 snapshots, 395 changed paths, every one inside the prediction) and, after repair round 1, `rebaseline-output-2.txt` (3 snapshots, one `short_result` path each). The walk above is the repair-round run; every number in the table was the same on the first run except the intersection row: its text, and its line count at 390, which went from 2 to 3 with the longer short result.
