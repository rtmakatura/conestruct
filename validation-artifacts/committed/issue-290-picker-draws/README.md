# #290 hand-check — the picker draws nothing after the side is chosen

Ryan's hand-check on prod, N Broadway southbound (way 131232822), 2026-09-25.

## Probe

`probes/sidecheck.cjs` drives /sandbox: picker → manual lat/lng
(39.73370, -104.98753) → road candidate → Save → Shoulder → Confirm →
the WHERE band's side control → reopen "Edit on map".  It logs every
`/api/render/corridor-geometry` request (what the modal sent) and response
(what the backend answered), and saves the reopened picker.

## repro-prod/ — the defect, on https://www.conestruct.com/sandbox (main 659d800)

The modal sent the side correctly (`meta.work = {side: right, travel:
with_geometry}`, the road and the pin intact).  The backend answered:

> status `corridor_unbuildable` — "work-start corridor does not return to
> the pin (11.0 m off): the road geometry cannot carry the corridor this
> far downstream of the work"

and the picker drew nothing and said nothing (`broadway-3-picker-after-side.png`).

## Cause

The pin was typed, not snapped: 11 m east of the way's centerline.  The
work-start build walks the corridor along the road, so the work's upstream
edge lands on the pin's projection onto the road — and the round-trip
invariant compared that with the RAW pin.  Every pin not exactly on the
centerline missed by its lateral offset, in both directions of travel
(reproduced offline from the captured request).  The way is 3.4 km long;
this was not an end-of-geometry case.

## fix-local/ — the fix, on a local stack (this branch's backend + site)

Same probe, same pin, `AUDIT_SITE=http://127.0.0.1:3290/sandbox` with the
backend on 127.0.0.1:8765.  `laid_out`: the work 1,000 ft running SOUTH from
the pin with the traffic, the advance warning NORTH of it
(`broadway-local-fix-3-picker-after-side.png`).  `*-sided-request.json` is
the exact request replayed offline.

The prod screenshot of the fix is taken after the ship (the fix is in the
Modal backend, which only a deploy puts on prod).

## prod-after/ — the fix on prod (main ddc142c, 2026-09-25)

Same probe, same pins, against https://www.conestruct.com/sandbox after the ship.

- `broadway-prod-after-*`: N Broadway SB (way 131232822).  `laid_out`: the work runs 1,000 ft
  SOUTH from the pin with the traffic, and the advance warning is NORTH of it
  (`broadway-prod-after-3-picker-after-side.png`).  The side control offers the one buildable
  side, "West side · southbound traffic" (hand-check item 2), and the subtitle reads "Drop a pin
  where the work starts" (item 4).
- `lafayette-flagger-prod-after-*`: the flagger at 39.74362, -104.97070 (Lafayette St, way
  581254411).  `laid_out` with BOTH approaches: primary northbound 359.9°, opposing southbound
  180.3° (`lafayette-flagger-prod-after-3-picker-after-side.png`).

## The flagger case ("check the flagger case draws both approaches on prod")

Same probe with `AUDIT_KIND=flagger`.

- **flagger-prod/** — prod, main 659d800.  It does NOT draw.
  - `colfax-flagger-prod-*`: E Colfax (39.74020, -104.95600).  Detected as one-way way
    1547338997, so the band asked to confirm two-way traffic.  The corridor was
    `corridor_unbuildable`, "3.8 m off" — the same defect.
  - `17th-flagger-prod-*`: 39.74362, -104.97070.  Detected as Lafayette St, a two-way
    residential street 19 m from the pin (way 581254411).  Both sides were offered, and the
    corridor was `corridor_unbuildable`, "82.9 m off".
- **flagger-local/** — this branch's stack, at the same Lafayette pin.  `laid_out` with BOTH
  approaches:
  - primary: northbound, 359.9°;
  - opposing: southbound, 180.3°;
  - each: downstream 50, buffer 495, taper 100, advance warning 1,050.

  `17th-flagger-local-3-picker-after-side.png` shows the work north of the pin, the primary
  advance warning south of it, and the opposing advance warning north of the work's far end.
  Its Centerline row reads "covers 265–2,382 ft": the way ends 265 ft short of the anchor, the
  end-tangent case the frame fix also carries.

## page2-local/ — checkpoint (k) commit 7: the PDF's page 2 (this branch, local)

`probes/page2.py` replays a prod-captured request (`prod-after/*-sided-request.json`) through
this branch's `POST /render/pdf`, with the relay the site's proxy applies and a real Mapbox
server token read from the environment (never written to disk), and rasterises page 2.

- `broadway-page2.png`: N Broadway SB.  The work runs south from the pin and the advance
  warning is drawn north of it (#298's acceptance, on page 2).  The whole corridor is framed,
  with the legend under the image and "Direction of travel: 180°".
- `lafayette-flagger-page2.png`: the Lafayette flagger.  Both approaches are drawn: the
  primary south of the pin, and the opposing one north of the work's far end.  The opposing
  one is faded, because the OSM way ends there ("covers 265–2,381 ft").  The legend reads
  "Two approaches: northbound (the work's side) and southbound", and the direction reads
  "0°" (it printed "360°" before this commit).