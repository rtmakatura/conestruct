# Rule 5 prediction: `phase4-floor-320` (Phase 4 branch 4, R143)

Written 2026-10-13, off main `aeaced4`, before any change. Authority: `../rulings.md` (R143).
The measurement that led here (production, 320×800 and 360×800, every stage) is in
`measure-before/`: at 320 only results with every disclosure open overflows, the page 334 px
wide, from the audit trail's calculation rows (`.audit-head`, a five-column grid: number,
title, result, MUTCD cite, chevron).

## Deliberate changes

1. **The audit calculation row at the phone width (≤ 480 px):** the MUTCD cite drops under the
   title (a second grid row); number, title, result and chevron stay on the first. Phone-only
   CSS; the desk row is unchanged.
2. **Results tap targets at the phone width:** the pricing quote's 8 number inputs (38 px tall)
   and "Download Quote (XLSX)" reach 44 px (R138's `tap-44` class, phone-only).
3. **The floor is 320 px (R143):** `DESIGN-SPACING.md`'s "Supported sizes" names 320 as the
   floor and a fit check; 360×800 stays the one test size; no floor message.
4. **The tooling:** a fit check script that drives every stage (empty, picker, WHERE, WHAT for
   the three kinds, results with every disclosure open) at 320×800 and 360×800 and fails on any
   horizontal scroll.

## Predicted outcome

- 320×800, results with every disclosure open: page scroll width **320** (was 334); nothing past
  the edge but screen-reader-only text.
- 360×800: unchanged fit (360); the audit rows two lines tall where the cite wrapped.
- Pricing inputs 38 → 44 tall and "Download Quote (XLSX)" ≥ 44 at 320 and 360.
- 1440: nothing changes.

## Not changing

- No floor message (R143 supersedes R137 Q3's). The "Rules 160–174 · the 380 arc" names stay.
- The desk: no rule outside `@media (max-width: 480px)` changes.
