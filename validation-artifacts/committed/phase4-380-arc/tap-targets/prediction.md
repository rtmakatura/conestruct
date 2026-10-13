# Rule 5 prediction: `phase4-tap-targets` (Phase 4 branch 2, R138)

Written 2026-10-12, off main `03fa273`, after the production "before" census and after the CSS/class
edits were drafted, but **before any "after" measurement**. Authority: `../rulings.md` (R138, R139),
rule 163 ("every interactive element to 44 px" at the phone width), rule 15 (32 px at 1440, 44 px at
the phone width), R107 ("Every control is 44 px tall" in WHAT).

## Deliberate changes

1. **WHAT's segmented controls** (street class, carriageway, hours, speed reduction): 42 → **44 px**
   tall at **every** width. The 1 px frame moves from `border` to an inset shadow, so the 44 px track
   is unchanged and nothing around it moves (R107's own number).
2. **At the phone width (≤ 480 px; measured at 360×800)**, every control on WHERE, WHAT, WHAT's
   footer and the picker reaches 44 px in its smaller dimension:
   - WHAT's footer: the windows line 32 → 44 tall; OPEN 42.2 → 44 wide.
   - WHAT's form: the cross-street type select 43 → 44; the range sliders' box 2 → 44 tall (the
     track and thumb draw as before); "Lane count is right" (and its undo) 28 → 44.
   - The picker: Close 34×26 → 44×44; the coordinate toggle 30 → 44; the address, latitude and
     longitude fields 43 → 44; STREETS 34 → 44; CHANGE 25 → 44; Re-detect roads 23.5 → 44; Cancel and
     Save & Close 35.5 → 44.
   - Mapbox's own buttons in the picker: zoom in, zoom out and the compass 32 → 44; the attribution
     toggle 24 → 44.
3. **WHERE** at 360 has nothing under 44 today (its ledger verbs are already rule 163's 44); it
   stays as it is.

## Not changing

- **The desk (1440)** keeps rule 15's 32 px hit box for the info markers, WHERE's CHANGE/MOVE and
  the footer line; the picker's desk sizes are unchanged except where a phone rule does not apply
  (none). Reported, not raised, pending a ruling.
- **Mapbox's wordmark link** ("Mapbox homepage", 88×23) is Mapbox's logo at its own drawn size; it
  is not resized. The attribution text links (14 px tall at the desk; folded behind the toggle at
  360) are attribution, not app controls, and are not restyled.
- No backend, no plan sheet, no audit, no XLSX: frontend CSS and class names only.

## Predicted outcome

- 360×800: zero controls under 44 on WHERE and WHAT (all three kinds) and in the picker, except the
  Mapbox wordmark link.
- 1440×1000: the segmented chips read 44; every other desk size is identical to the before census.
