# Arc 11 smoke — near_intersection live on production (Refs #117)

Run 2026-08-04 against https://www.conestruct.com/sandbox at the flip
ship.  **Triple gate: healthz == origin/main == served bundle ==
`9bcc3ca950b6f3d6c170edc7998e32c9fd2e2670`.**  Headless Playwright +
pypdfium2, read-only: no accounts, no DB writes, no plan saves; PDF/MD
downloads are stateless renders through the page's own controls; zero
route interception (passive request/response observation only).

## Tally — 35/35 PASS

- **23 browser assertions** (`assertions-raw.md`, final run verbatim; 0 FAIL)
- **12 served-document text checks** (`served-docs-checks.txt`, from
  `verify-served-docs.py` over the downloaded plan PDF + crew narrative)

## What the smoke proved, per flip-GO §4

**(a) NI end-to-end at a real Denver pin.** The picker offers "Lane
closure near intersection · Cases 18/19 · S-630-1" (the other two kinds
intact); the strip reads AWAITING LOCATION until a pin exists; East
Colfax detects at the Race∩Colfax crossing (39.739776, -104.963483);
the intersection marker — placed through the picker's own armed
mark-mode — posts the crossing's exact coordinates (verified ±50 m at
the wire) and detection returns **Race Street — two-way, signal
detected, ~100 ft past the work zone** (near side).  The relays fill
the form (signalized ✓, 25 mph, per-direction counts); Generate blocks
behind the lane-count hold; "Lane count is right" clears it; the
package renders with the side-aware **TA-21** chip, 37–42 devices, and
the audit accordion's **Cross-street approaches** section: per-leg
Sheet 10 key tables (W20-1 at 2×A, R2-10 at A, R2-11 at 100 ft
departure side (Case 18)), SIGNALIZED (signal operation review
required) on both legs, source line "MUTCD §6N.12; CDOT S-630-1 SHEET
10, CASES 18/19 (ADVANCE-SIGNING KEY)".  Served documents
(`verify-served-docs.py`, 12/12): the Cases 18/19 NOT-DRAWN sheet note
with the corner-quadrant fine print naming #128, the #176 rightmost-
lane note on sheet AND narrative, the #157 COORDINATES row, the Sheet
10 Note 1 urban-block disclosure, the Cross-Street Signs section with
the sequencing-is-TCS-judgment note, the #125 ped/bike and #124
emergency-access (630.10(a)) sections, the corner-extension variant's
Fig. 6P-21 / Case 18 citations, and signal flag-and-cite.

**(b) #179 undo, live at the wire.**  The lane-count hold rendered the
DISPUTED-relay reason ("total lane count doesn't match its
per-direction counts"); confirming recorded the #177 marker — the
served render payload carries
`{"via":"approach_lane_confirm","detectedLanesTotal":2,...}` with the
relays cleared off both legs (b2, observed on the real
/api/render/pdf POST).  Post-generate the form collapses into the
setup summary; reopening via "Edit full setup" shows the confirmed
note with "Undo — restore detected lane data"; undo removes the note
(no phantom override) and the next served payload carries
`detectedLanesTotal: 2` on BOTH legs with the marker gone — the
restore is exact against the marker's own recorded value (b5,
wire-level).  The undo also correctly invalidates the staged package
(the #183/#197 stale guards); regeneration through the page's own
button precedes the post-undo download.

**(c) The served #120 400 — stated, not forced.**  Race St's picked
segment relays ONLY `lanes=2` (no per-direction tags), so the backend
predicate — which requires all three tags — cannot fire at this pin:
the hold's "disputed" copy comes from the deliberately-broader
frontend suspicion heuristic (its own docstring records the
divergence).  The capped Overpass hunt (4 probes: central-Denver and
Broadway/Speer bboxes, York St and Logan St candidates) found no
arithmetically-disputed cross street adjacent to an NI-eligible
two-way multi-lane mainline (York's crossers are all one-lane
residential; Logan's arterial is one-way Evans).  The served 400, the
"Cross street section" message, and the #180 `ni_lane_confidence`
pointer stay carried by the mounted suites
(tests/test_lane_confidence_block.py endpoint-level;
auto-apply.test.ts matcher).

**(d) Geometry refusals through the real form.**  d2: cross-street
lanes 4 at 30 ft distance → the mirror refuses in the generator's own
terms — "THE CROSS STREET'S PAVEMENT (ABOUT **48 FT** EACH WAY FROM
ITS CENTERLINE) REACHES INTO THE WORK ZONE. WORK INSIDE THE
INTERSECTION ITSELF ISN'T SUPPORTED…" (the same 48-ft half-width the
backend computes), with the #180-family one-voice chrome (INVALID
INPUT banner + GENERATION BLOCKED + audit "unavailable while
generation is declined") — screenshot `06-curb-overlap-refusal.png`.
The in-zone variant materialized naturally in an earlier run when the
relayed distance landed inside the default work zone
(`02-run14-inzone-mirror.png`).  d3: the single-lane mainline is
UNREPRESENTABLE in the form — the lanes-per-direction chips start at
2 ("NEEDS 2+").  The mirrors pre-empt the POST by design (fail-safe
direction); the served 400s for the trio are pinned endpoint-level
(tests/test_near_intersection_endpoints.py).

**(e) Compat.**  Shoulder (Lakewood control pin) and flagger (the Arc
8 quiet Park pin) both generate end-to-end post-flip; `/landing`'s
DimStrip derives "3 scenarios supported".

**(f) Axe.**  Zero violations on the settled post-generate NI surface
(wcag2a/aa/21aa/22aa), and zero on the shoulder control — the Arc 7
zero-violation baseline holds on the new kind.

## Run notes (20 runs; every failure was probe-side)

No production assertion that executed correctly against the intended
state ever failed.  The notable probe-assumption corrections, all now
encoded in the committed script:

1. The picker map does NOT fly to manually-entered coordinates (it
   stays at the state-wide view), and a too-early post-Recenter click
   posted the middle of Colorado (39.006, −105.50) to the lookup.
2. Recenter fits the CORRIDOR, not the pin — canvas center sits ~890 ft
   east of the anchor; the committed script self-calibrates from the
   lookup's own posted coordinates (two reference clicks → geo-per-
   pixel → aimed click, landing 0.1 m from the crossing).
3. The intersection mark-mode consumes ONE map click per arming;
   later clicks move the main work-zone pin.
4. "No cross street found" at Williams/Gilpin is real behavior: the
   lookup excludes non-qualifying candidates; Race St (signalized
   secondary) is the nearest qualifying crossing.
5. The axe scan initially read the ⟳ Recomputing stale-ribbon state —
   whose previous-answer dimming is deliberate (Arc 7) — and, in
   another run, a just-clicked button's focus style.  The committed
   scan waits for settle and runs before any download click.
6. The post-generate form collapse (undo behind "Edit full setup")
   and the undo-invalidates-package behavior are the app's own stale
   guards working as designed.
7. Lakewood's first candidate is a 4-lane arterial whose 12-ft
   default correctly trips the drawable-width mirror — the compat
   flow prefers a residential candidate and the flagger leg uses the
   proven Arc 9 Park pin.

## Files

`arc11-live-checks.js` (the committed script, matching the final run) ·
`assertions-raw.md` (23/23) · `verify-served-docs.py` +
`served-docs-checks.txt` (12/12) · `served-ni-plan.pdf` (815,990 B) ·
`served-ni-plan-post-undo.pdf` · `served-ni-crew.md` (8,390 B) ·
screenshots 01 (picker with the marked crossing), 02 (the disputed-
relay hold), 02-run14 (the in-zone mirror state), 03 (post-generate
package, TA-21), 04 (audit approaches section), 05 (post-undo), 06
(curb-overlap refusal) · axe JSONs (NI + shoulder control, both empty).
