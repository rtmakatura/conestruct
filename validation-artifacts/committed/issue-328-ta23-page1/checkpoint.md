# #328 📋 checkpoint: page 1 of a TA-23 plan draws the bay open

## Ryan's browser check (2026-10-15), verbatim
> Ryan's browser check on the TA-23 left far-side plan (prod 879d89e, N Broadway SB, E 11th Ave, 300 ft): the flow passes (refusal, entry, notes, audit). Page 1's drawing doesn't match TA-23:
> - the approach where the left lane is an open turn bay is shaded as the closed lane, with the generic "L = 180 ft" / "BUFFER = 200 ft" labels;
> - no bay dimension (300 ft, entered by operator), no 100 ft opening, and R3-7L only in the off-page list.
> That's a Rule 10 problem: the sheet reads as a closed lane where traffic is meant to turn. Reopen #323 (or file a follow-up) and investigate with a 📋 checkpoint: what page 1 can show within its page budget (draw the bay open with its channelizers, the opening, R3-7L and a bay dimension; or, if it truly can't fit, stop shading the bay as closed and label it as off-page). Post before/after page-1 images and stop for Ryan's look before shipping. Containment stays 0/0/0; right far-side plans stay byte-identical.

## What blocks it

Page 1 uses one frame for every lane closure:
- **The frame:** `_make_x_mapping`, `plan_sheet.py:177-245`. It lays out the work zone to scale, the Table 6B-2 buffer compressed to `BUFFER_VISUAL_FT` (80 ft) with a // break, then the *midblock* taper (`wz + buffer + L`), plus 100 ft of padding.
- **The closed-lane band:** painted across the full width (`_draw_one_way_street`, `plan_sheet.py:355-359`).
- **The dimension line:** labels that frame "L / BUFFER (NTS) / WORK ZONE" (`_draw_landmarks`, `plan_sheet.py:2017-2088`).

On TA-23, the real taper ends at `upstream curb + storage + 100` (`near_intersection_stations` → `turn_bay`). So:
- **Cross street near the work end** (Ryan's E 11th Ave, 1,000 ft work zone): the frame holds the bay and the opening, but shaded closed, under the midblock labels.
- **Cross street further on** (E 14th Ave): the whole approach falls off-page, and R3-7L lists as an "advance" sign.

## What page 1 can show: option (a), a TA-23 frame

Used only when the plan has a turn bay (`params.turn_bay_storage_ft` is set, which the bridge does only for TA-23). Every other plan keeps today's frame byte for byte.

**Stations, upstream to downstream:**

| span | how it's drawn |
|---|---|
| **Taper** (`taper_start` to `taper_end`) | to scale, shaded closed; the drums; R3-7L on the island and the far curb at its end |
| **Opening** (`taper_end` to `bay_start`) | to scale, open lane, no devices: "OPENING 100 FT" |
| **Bay** (`bay_start` to `upstream curb`) | to scale, open lane, its lane-line cones: "BAY 300 FT, ENTERED BY OPERATOR" |
| **Cross street** (`upstream curb` to `downstream curb`) | to scale, drawn as a cross street across the road (pavement band, curb strips broken), labelled "CROSS STREET" |
| **Far curb to work zone** (`downstream curb` to `wz`) | shaded closed. To scale when it's short. When longer than `BUFFER_VISUAL_FT` it's compressed to 80 ft with the // break, and its cones are represented by the dimension "CLOSED TO FAR CURB N FT (NTS)" instead of glyphs. Drawn at a compressed pitch they would collide, the reason today's buffer is device-free |
| **Work zone and downstream** | as today |

- **Upstream of the taper:** open; the left lane is still open there. Only the taper span is shaded.
- **Off-page:** `station_max_visible` = the real taper start + 50, so W4-2L / W20-5L / W20-1 / R2-10 stay in the off-page table, and their distances are measured from the real taper start (today they're measured from the midblock taper). R3-7L is drawn.
- **The scale note** reads "applies to the work zone, the bay and the taper; the stretch to the cross street compressed" when it is.

**Page budget.** The scale length grows by the intersection, the bay and the opening:
- **E 14th, 2,000 ft work zone:** about 2,900 ft against today's 2,500.
- **Ryan's E 11th, 1,000 ft:** about 1,800 ft.
- **A very long bay:** shrinks the scale, the way a long work zone does today.

Containment 0/0/0 is the gate, measured on E 11th and E 14th at several storage lengths. If a case can't fit, the fallback is (b): no shading over the bay, labelled off-page.

## Sources

- **Geometry:** TA-23, Fig. 6P-23 (p. 905) and Notes 4/5 (p. 904), as in #323's `checkpoint.md`. Nothing new.
- **The 80 ft compression:** the existing `BUFFER_VISUAL_FT`, a drawing convention, not a plan value.

## R145 self-ruled

This fits the rules and Ryan's option (a). Build it, then post before and after images of page 1 (E 11th and E 14th, plus the right far side unchanged), and stop for Ryan's look before shipping.
