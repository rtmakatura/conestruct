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
