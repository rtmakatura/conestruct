# Arc 12 live-site verification — citation recite on production (Refs #70, #83)

Run 2026-08-05 (UTC) against https://www.conestruct.com/sandbox at ship
`cac32db`. Harness: `arc12-live-checks.js` (Playwright headless,
read-only — no accounts, no DB writes, no saves; downloads are
stateless renders through the page's own controls). Raw log:
`assertions-raw.md`.

## Build gate

| Check | Value |
|---|---|
| healthz sha | `cac32db6d8a50e3f8b49fd553aee44df293df792` |
| `git rev-parse origin/main` | `cac32db6d8a50e3f8b49fd553aee44df293df792` |
| served bundle sha (`/_next/static` chunk scan) | `cac32db6d8a50e3f8b49fd553aee44df293df792` |

Gate PASS — all three equal.

## Scenario driven

Shoulder work at the Lakewood control pin (39.7113, -105.0815) →
S Wadsworth Blvd southbound (way 132831821), 40 mph; work-zone speed
reduction toggled (40→30, single-sign case); lane width narrowed to
10.5 ft through the form's own control (the detection's 4 × 12 ft +
10 ft shoulder exceeds the sheet's drawable width — the Generate
button's own remedy text). Generated; audit trail expanded row by row
(one-at-a-time accordion).

## Results — 20 PASS / 1 FAIL (plus the build-gate PASS; rows below group related assertions)

| # | Assertion | Result |
|---|---|---|
| a1/a2 | picker flow; form reduction hint cites "S-630-1 Sheet 2 Note 3", no "CO §2B.13(A)" | PASS |
| 1a | trail row 05 titled "Colorado requirements (CDOT S-630-1)" | PASS |
| 1b–1e | check citations render "CDOT S-630-1 (July 2026) Sheet 2, General Note 3 / 4 / 8 / 22" (extracted verbatim, `audit-colorado-text.txt`) | PASS |
| 1c | plaque label "G20-5P Work Zone signs every 2,640 ft" | PASS |
| 1f | AADT info row cites "Sheet 23, Case 38 Note 1" | PASS |
| 1g | "CO Supplement Sec" nowhere in the rendered page | PASS |
| **1h** | **no "COLORADO SUPPLEMENT" attribution chip in the trail** | **FAIL — residual found** |
| 2a–2c | Fines Double section cites "Sheet 12, Fines Double Signing Notes"; no "§2B.13"; no "§6C.04" | PASS |
| 2d–2h | served narrative (`served-narrative.md`, Download .md): Sheet 12 recite, "per Sheet 2 General Note 4", 15-mph bullet cites Note 3, no "CO/Colorado Supplement §" attribution, Reference inventory line intact (deliberate) | PASS |
| 3 | rendered citations name "(July 2026)" (trail chips render it uppercase) | PASS |
| 4 | CDOT "(19-Page Set)" source URL → HTTP 200 (leave-unless-404: stands) | PASS |
| 5 | control: JurisdictionSection "MUTCD + Colorado Supplement" statewide-baseline line still renders | PASS |

## The 1h residual (report, not fixed here)

When trail row 05 expands, its body's footer chip renders:

> ✓ CDOT S-630-1 · COLORADO SUPPLEMENT

Source: `conestruct/site/components/AuditTrail.tsx:1114` — a static
`CDOT {cdotSheet} · COLORADO SUPPLEMENT` literal in the Colorado
section body, sibling to the `:1153` mislabel the recite DID fix.
Same defect class (labels S-630-1 as the Colorado Supplement); missed
because it renders only when the accordion row is expanded and no test
pins it. One-line fix + the AuditTrail test that pins it — proposed as
an immediate follow-up on a code branch (this branch is evidence-only
per ground rules).

## Evidence files

`01-post-generate.png` (full page post-generate) ·
`02-audit-colorado-section.png` (trail with Colorado row expanded —
the 1h chip visible) · `audit-colorado-text.txt` /
`audit-fines-text.txt` (extracted DOM text, citations verbatim) ·
`served-narrative.md` (the served Download .md) ·
`assertions-raw.md` (timestamped log) · `arc12-live-checks.js`
(harness; local `out12/` staging dir is untracked by design).
