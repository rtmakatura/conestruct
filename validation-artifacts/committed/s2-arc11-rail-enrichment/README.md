# s2-arc11 — rail state enrichment (issue #228)

GO 2026-08-31: all eight checkpoint rulings accepted as recommended.
One derivation, never a second rail: the per-step vocabulary (state,
glyph, word, info, aria, step index) lands as fields on the entries
`deriveRail` already returns; `ProgressRail` renders verbatim.

## Rulings applied

1. Pending-proposal count on Location's `info` subline only ("N to
   confirm"), informational; NO band rail entry; Reference B's
   "classification not set" line NOT adopted (deliberate deviation
   from PDF p.10, on p.6's own "that's a product rule" basis).
2. Stale = `▲` + "detection stale", both CHOSEN (the PDF declined to
   design the fourth state's glyph, p.5); predicate = the exact
   DetectedVsApplied staleness key; attention outranks; never gates;
   `--dim` ink, measured.
3. Rail register tracking 0.08em → 0.14em (sheeted p.3); #226
   deferral comment retired.
4. Zero-padded step indexes ("02 Location"), `step` derived in
   rail.ts beside the fifth-step table.
5. Duration subline ("N days" inclusive / "1 day"), display-only date
   arithmetic, Rule-3 mirror comment.
6. Hardening: `data-testid` hooks (cta-reason, rail-blocker) replace
   the raw-class selectors in `rail-single-source`; own commit.
7. Shell computes `pendingSuggestions` from the slots' own render
   expressions, mirror comments both sides.
8. Aria stability: existing states byte-identical (asserted by pin);
   new vocabulary joins with " · " in the same format;
   Generate-slot strings stay component-side.

## Contents

- `red-proof-commit2-sentinel.txt` — the single-voice sentinel suite
  run against the #221 component BEFORE the rewrite: 3/3 fail (the
  component owned a GLYPH map, word literals, and an aria template).
  Green after the rewrite.
- `probes/contrast-measure.py` → `contrast-measurements.txt` — the
  one NEW ink pairing (`--dim` #ff8a2e on `--canvas`): 7.00:1 PASS;
  step/info faint ink 6.19:1 PASS; labels 10.68:1 PASS (AA 4.5:1).
- `live-checks/s2a11-live-checks.js` + `outS2A11LC/` — local run
  against this worktree's dev server (:3113): **ALL PASS 25/25**
  (`s2a11-live-checks.md` is the timestamped log; captures per state
  incl. grayscale; `axe-local.json`).

## Records

- Full frontend suite at the arc head: **830/830** (was 809 at
  `26b78dd`; +21 exactly: 16 rail.test extensions, 3 sentinel, 2
  mounted vocabulary — verified by `vitest list` diff, zero removed;
  the ProgressRail fixture move changed no case count).
- Live checks (2026-08-31, local): R1 pre-pin (step indexes 02–05,
  aria byte-identical, one ⚠, letter-spacing 1.4px computed); R2
  pinned ("optional · not set"); R3 count subline + dismiss-honesty
  (only the count line moved — every entry's state class unchanged);
  R4 duration ("1 day" / "4 days" inclusive, ✓ glyph); R5 stale end
  to end — real Overpass detection at the E Bayaud pin, Save & Close,
  the #173 lane-contradiction refusal surfaced and was remedied by
  its own pointer (attention outranking stale, live), then the
  post-pin **Edit manually** lat move rendered `▲ detection stale`
  in rgb(255, 138, 46), with no blocker (never gates); R6 axe sets
  `[region]` pre-pin / `[label, region]` pinned — equal to the
  committed baseline, zero new.
- Stale reachability (corrected from the checkpoint): the picker's
  Save & Close always refreshes or honestly NULLS `confirmedRoad`
  (LocationPickerModal.tsx:1649-1680), so the modal path can NOT
  produce stale; the live producer is the post-pin "Edit manually"
  fallback (GeneratorSidebar.tsx:963), which writes `meta.lat/lng`
  and leaves `confirmedRoad` untouched — exactly the flow R5 drives.
- Prod re-run happens after ship (s2a11 live-checks branch, next
  task).

## Prod run (post-ship, 2026-08-31)

- `live-checks/s2a11-lc-prod.js` + `outS2A11Prod/` — the same
  R1–R6 against https://www.conestruct.com/sandbox with prod at
  `ceba2f1` (`/healthz` == `main`, verified): **ALL PASS 25/25**.
  Step indexes + 1.4px register on the deployed bundle; "optional ·
  not set"; live suggest → "1 to confirm" → dismiss-honesty; "1 day" /
  "4 days"; the stale path end to end (real Bayaud detection, the
  #173 refusal remedied by its own pointer — attention outranking
  stale live — then the Edit-manually pin move rendering ▲ "detection
  stale" in rgb(255, 138, 46), no blocker); axe sets `[region]` /
  `[label, region]` — equal to the committed baseline, zero new.
