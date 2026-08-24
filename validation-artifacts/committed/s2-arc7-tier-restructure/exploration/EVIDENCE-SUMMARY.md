# #217/#218 exploration — staged evidence (scratchpad, uncommitted)

Production walked 2026-08-24 at origin/main == healthz == d8419d6 (gate re-verified
in-session; served bundle carries the s2-arc5 `coverageFt` marker).
All runs headless Chromium, READ-ONLY (no saves, no DB writes).

## Files
- `walk-log.md` — the #218 NI flow walk at Race∩Colfax, state by state (A0–A11)
  plus first density pass. Screenshots A0-landing / A1-ni-selected /
  A3-road-confirmed / A4-cross-marked / A5-form-after-save / A11-post-generate /
  B1-heavy-expanded.
- `metrics2-log.md`, `metrics3-*` — density passes with jurisdiction selected.
- `metrics3-control-{default,expanded}.json` + `metrics3-control.png` — typical
  control: shoulder at 39.7113,-105.0815 (S Wadsworth sb), Lakewood selected,
  lane width nudged 12→10.5 to clear the drawable-width mirror (blocker text
  captured in control-status.txt).
- `metrics2-heavy-denver-*.json` / `metrics3-` rerun — heavy NI: Race∩Colfax,
  Denver selected via dropdown, both legs, signal detected, hold confirmed.
- `heavy-fulltext.txt`, `heavy-denver-fulltext.txt` — full post-generate page text.
- Scripts: `../explore-walk.js`, `../explore-metrics3.js`, `../control-measure.js`.

## Headline numbers (section 03 = Zone 3 "Reference — Rules, permit & audit")
| measure | typical control (shoulder+Lakewood) | heavy NI (Denver, 2 signalized legs) |
|---|---|---|
| default (all chips collapsed) | 94 words · 502 px · 6 chips | 109 words · 618 px · 8 chips |
| fully engaged | 685 words · 2,631 px | 844 words · 3,149 px (+179w approaches body closed at measure time ⇒ ~1,020w total) |
| audit items | 6 (taper/buffer/spacing/advance/colorado/reference), bodies 44/39/94/58/136/59w | **3** (approaches 179w · corridor ⚠1 warning 41w · pending 97w) |
| tables/rows | 2/12 | 2/16 |
| chip word weights | deltas 113 · mandates 51 · hours 80 · permit 154 · audit 179 · devices 83 | deltas 55 · personnel 95 · mandates 29 · hazards 73 · hours 66 · permit 222 · audit 171 · devices 112 |

## Facts with teeth found during the walk
- The chip restage (density contract) shipped 2026-07-21 (`9f80293`) — a month
  BEFORE Ryan's 2026-08-18 pass. His "overwhelming" verdict is post-restage.
- `buildScenarioItems` has NO near_intersection branch (AuditTrail.tsx:405-424)
  ⇒ the NI audit trail traces 3 values where shoulder traces 6 — no
  taper/buffer/spacing/advance/colorado rows on the flagship kind.
- Heavy-case measurements are a FLOOR: no site-condition flags fired at this pin
  (they are auto-detected, no manual checkboxes), no work-zone speed reduction
  (no fines-double item), schedule left "Not set" (no hours violation /
  auto-expand). Each would add items/tiers.
- The picker map does not fly to manually-entered coordinates (arc11 finding,
  still true); Recenter + ~3s flyTo required before the intersection click.
- The Generate blocker reason renders under the CTA (GeneratorFormPrimitives
  UX-21) but the row it points at (lane-count hold) sits ~2,000 px above it in
  a 2,837 px setup panel.
- Pin-based jurisdiction suggestion did not render within the observed
  post-save window at Race∩Colfax (class suggestion did); timing observation
  only, not asserted as a defect.
- Wadsworth control: detection filled 4 lanes × 12 ft ⇒ drawable-width mirror
  correctly blocked Generate with the honest reason (captured).
