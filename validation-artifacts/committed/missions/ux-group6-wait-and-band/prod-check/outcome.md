# #470 production check on 750660c (the Generate wait)

Run 2026-11-09 against https://www.conestruct.com/sandbox. Headless Chromium, DPR 1, read-only. Live data, nothing stubbed, no hold. The gate header went only to the site's own origin (scripts/gate.cjs `newGatedContext`). The token was read from `conestruct/site/.env.local` into the env and was never printed or written.

**Result: PASS for #470's Generate target.** Layout shift from the Generate press to "Plan ready" is 0 at 1440x900, 1198x930 and 390x844 (target under 0.1). One defect turned up in the permanent check script itself (check 2).

| # | Check | Result |
|---|---|---|
| 1 | Sha gate | PASS |
| 2 | Permanent CLS check | Script as-is: FAIL to run (script defect). Corrected-wait copy: PASS, 0 / 0 / 0 |
| 3 | Visual: outline + status line, Plan ready settled, console | PASS. 0 page errors, 0 console errors |
| 4 | axe and 44 px on the settled results | PASS. 0 violations, 0 targets under 44 px |
| 5 | Live pin | 1550 E Colfax Ave (walk), 1600 E Colfax Ave (permanent check). East Colfax Avenue, eastbound |

## 1. Sha gate: PASS

- `/healthz`: `{"status":"ok","sha":"750660c00c2ecb6c1338fea3ee00d3a51523c5cb"}`
- Served frontend: `/sandbox` (gated fetch, 200) and its 12 chunks hold one 40-hex string that is a commit in this repo, `750660c00c2ecb6c1338fea3ee00d3a51523c5cb`. The other five 40-hex strings are not git objects. Method: the same as `scripts/preview-url.ps1` (chunk scan).

## 2. The permanent check

**As written, it fails to run on production** (`cls-permanent-asis.txt`): all three widths time out on a disabled Save & Close. The cause is the pick-dialog wait at `scripts/verify-generate-cls.mjs:161`. It matches `/PICK THE ROAD|Which road|Save & Close/` against the dialog text. "Save & Close" is in the dialog while it still says DETECTING ROADS AT PIN… (probe at +3 s), so the wait passes at once. The Colfax click then finds no button (the 4-road list arrives at about +8 s), and Save & Close stays disabled. Locally the stubbed road answer arrives in time, which hid the bug. This needs a one-line fix in the script, not filed here.

**The corrected-wait copy** (`script/verify-generate-cls-prodwait.mjs`) changes only that wait (it now waits for "PICK THE ROAD · N FOUND" or an enabled Save & Close) and makes the requires absolute. Output: `cls-prod.txt`.

| Width | Generate CLS (press to settled) | NEEDS YOU | Strip |
|---|---|---|---|
| 1440x900 | **0** PASS | 1025 px | ⚠ Plan ready. Answer 3 quick questions before you send it. |
| 1198x930 | **0** PASS | 1025 px | same |
| 390x844 | **0** PASS | 1135 px | same |

At `HOLD_MS=0` the script skips its outline-vs-settled box check (it runs only with a hold of 2 s or more), so that check was not run on production.

**After the answer** (the permanent script doesn't measure this; the walk does). The walk answers the first choice of each NEEDS YOU question, presses Apply answers and sums shift for about 14 s:

| Width | Run 1 | Run 2 |
|---|---|---|
| 1440x900 | 0.2469 | 0 |
| 1198x930 | 0 (window too short, see note) | 0.3756 |
| 390x844 | 0 | 0 |

Still high where it lands, as expected (#474). The sources are the NEEDS YOU collapse: a `div` 0→487 (h0→413), `#dl-cards` moving up 45 px, and `ul.ny-items` 0→194. The number swings between runs because the shift counts only while the moved boxes are in the viewport. Run 1 waited only about 4 s after Apply, so a late re-build could miss its window; run 2 waited about 14 s. Treat these as a sighting, not a measure; #474 owns the measurement.

## 3. Visual: PASS

Generate settled 6.4 s / 5.9 s / 7.1 s after the press (run 2). During the wait the outline holds the sections' places, the dimmed WHERE aerial ("Checking this stretch of road") sits in the map's place, and the status line sits in the strip's slot, reading "Checking the road and laying out the taper, buffer and devices… STEP 1 OF 1". The cold-start note shows under the map. At the settle the strip reads "⚠ Plan ready. Answer 3 quick questions before you send it." with NEEDS YOU Question 1 of 3 (sidewalks, 62.3 ft) below it. Page errors 0 and console errors 0 at every width, both runs.

Crops (`walk/`, results column at viewport height, a clip with no scroll):

- 1440x900: `1440x900-wait-0-884ms.png`, `1440x900-wait-1-2016ms.png`, `1440x900-wait-2-3584ms.png`, `1440x900-plan-ready.png`
- 1198x930: `1198x930-wait-0-900ms.png`, `1198x930-wait-1-2032ms.png`, `1198x930-plan-ready.png` (it settled before the 3.5 s shot)
- 390x844: `390x844-wait-0-906ms.png`, `390x844-wait-1-2062ms.png`, `390x844-wait-2-3541ms.png`, `390x844-plan-ready.png`

In run 1, a shot at 25 ms after the press showed the strip slot still empty (the status line not yet painted). From about 0.9 s on, every crop shows the line. That frame was replaced by run 2's timed crops.

One known transition, not a fail: the outline's map place shows the dimmed WHERE aerial, and the settled NEEDS YOU map is a different, zoomed-in view. This is the open question recorded in issue-470/evidence.md ("The blank map frame").

## 4. axe and 44 px: PASS

On `section.results` once settled, both runs:

| Width | axe violations | Targets measured | Under 44 px |
|---|---|---|---|
| 1440x900 | 0 | 21 | 0 |
| 1198x930 | 0 | 21 | 0 |
| 390x844 | 0 | 17 | 0 |

## 5. Live data vs stub

The live pick dialog found 4 roads at 1600 E Colfax (Franklin St SB 18 m, East Colfax Ave EB 21 m, Park Ave NW 27 m, Franklin St NB 27 m). The walk at 1550 E Colfax picked "East Colfax Avenue, eastbound · Primary road · 0 m from your pin". The live plan asks 3 NEEDS YOU questions, where the stub fixtures differ. The step line reads STEP 1 OF 1 on a warm backend.

## Files

- `cls-permanent-asis.txt`: the permanent script as written, against prod (fails to run), with the cause
- `cls-prod.txt`: the corrected-wait copy, against prod
- `script/verify-generate-cls-prodwait.mjs`: that copy (its header states the one change)
- `script/walk-prod.mjs`: the walk (crops, axe, 44 px, console, answer leg)
- `walk/*.json`, `walk/walk-prod-output.txt` (run 2), `walk/walk-prod-output-run1.txt` (run 1)

No dev server was started. Every browser the scripts launched was closed (`b.close()` in `finally`), and no chromium process was left running afterwards.
