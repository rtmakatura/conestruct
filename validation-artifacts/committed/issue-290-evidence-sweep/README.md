# #290 checkpoint (k) commit 9 — the prod evidence sweep

Every #290 state on https://www.conestruct.com/sandbox (main `6405803`), at 1440 and at 380,
on 2026-09-25. `sweep.cjs` walks one plan per run. At each state it saves a screenshot, the
strip, the CTA reason, the ledger rows and the side options to `prod/<run>-<width>-NN-<state>.{png,json}`,
and `prod/<run>-<width>-log.txt` has the corridor-geometry answers.

Runs:
- **shoulder:** N Broadway SB, way 131232822, one-way.
- **flagger:** Lafayette St at E 17th Ave, way 581254411, two-way. The kind is confirmed BEFORE
  the side, so AWAITING OCCUPIED SIDE shows.
- **noroad:** 39.74480, -104.95010, a pin with no road detected.

## The states, and what prod showed (identical at 1440 and 380)

| # | state | strip | ledger / control | runs |
|---|---|---|---|---|
| 1 | fresh | ◌ AWAITING LOCATION · no site chosen | CTA: "Set a location first — pick on map or enter manually." | all |
| 2 | picker, before the side | (unchanged) | The pin and "Say which side is occupied to lay out the work". No shape. Subtitle: "Drop a pin where the work starts, and review the detected road properties." | all |
| 3 | located | ◌ AWAITING KIND OF WORK | Side row ⚠ needs you, kind row ⚠ needs you, grow ◌ pending. One side offered on the one-way road ("West side · southbound traffic"), two on the two-way road. | all |
| 4 | side chosen, kind owed | ◌ AWAITING KIND OF WORK | Side row ✓ with the side; "Kind of work — confirm below" ⚠ is the washed row. The chip is checked: ✓, accent border, wash. | shoulder |
| 5 | kind confirmed, side owed | ◌ AWAITING OCCUPIED SIDE | CTA: "Say which side is occupied to lay out the work". Generate is disabled. | flagger |
| 6 | no road: the four headings | ◌ AWAITING KIND OF WORK | "East side · traffic heads north / South side · traffic heads east / West side · traffic heads south / North side · traffic heads west" | noroad |
| 7 | both answered | ✓ VERIFIED · READY FOR TCS REVIEW (shoulder); ⚠ VERIFIED · 1 validation warning (flagger, noroad) | Side ✓, kind ✓, grow ✓ | all |
| 8 | picker, laid out | (unchanged) | Shoulder: the work runs south, the advance warning north, travel 180.49°. Flagger: both approaches, 359.91° and 180.3°. | shoulder, flagger |
| 9 | generated | ⚠ VERIFIED · 2 plan flags · REVIEW FLAGS | Results shown | shoulder, flagger |
| 10 | PDF page 2 (downloaded from prod) | n/a | Shoulder: the whole corridor and the legend, 180°. Flagger: both approaches, "Two approaches: northbound (the work's side) and southbound", 0°. | shoulder, flagger at 1440 |

No horizontal scroll in any state at either width (`hScroll: false` in every record).

## Findings

1. **Defect: after the kind is confirmed with the side still owed, the column moves on to WHAT.**
   - Seen in `flagger-1440-04-kind-confirmed-side-owed.png` and the same state at 380.
   - The strip says AWAITING OCCUPIED SIDE and Generate's reason says "Say which side is
     occupied to lay out the work".
   - But the side control is inside the collapsed WHERE band, and nothing on screen leads back
     to it. The shoulder order (side first) doesn't hit this.
   - Not fixed in commit 9 (evidence only); fixed in the next commit on this branch; see local-fix/ below.
2. **Capture artifact, not a defect.** In full-page screenshots the fixed site header lands
   mid-page (for example `shoulder-380-04`, over the ledger's first row). Full-page capture
   repositions fixed elements; the page itself scrolls under the header.
3. **Not reachable in the sandbox:** a plan saved before the work-start change opening with its
   side owed (`pinModelFrom`). The sandbox has no saved plans. It is covered by
   `lib/scenarios/pin-model.test.ts` and the band's warning line.
4. **Not reachable on prod now:** a refused corridor. The picker states the backend's reason,
   and `LocationPickerModal.coverage.test.tsx` covers it. The prod pins that used to trigger it
   (`issue-290-picker-draws/repro-prod/`) now lay out.

## local-fix/ — the kind-before-side fix, re-shot (this branch's backend and site, local)

Ryan, 2026-09-25: "WHERE's Confirm doesn't move on to WHAT while the side is owed, and the side
control stays open on WHERE until chosen." This is the same `sweep.cjs flagger 1440` run with
`AUDIT_SITE=http://127.0.0.1:3290/sandbox`.

- `flagger-1440-04-kind-confirmed-side-owed.png`: the kind is confirmed and the side is owed.
  - The column stays on **STEP 1 WHERE**.
  - "Which side is occupied?" is the washed row (⚠ needs you), with both side options open
    beneath it. The kind row is ✓.
  - The strip still reads AWAITING OCCUPIED SIDE, and Generate's reason names the side.
  - On prod before the fix, the same state had the column on STEP 2 WHAT with the side control
    folded away (`prod/flagger-1440-04-kind-confirmed-side-owed.png`).
- `flagger-1440-05-both-answered.*`: once the side is chosen, the column moves on to WHAT by
  itself.
- WHAT's own CHANGE link still opens it while the side is owed. That is an explicit request, and
  only the column's own move waits.