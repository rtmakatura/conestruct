# Mission #458 production check on d360ce4 (2026-11-08)

Served sha: `/healthz` returned `{"status":"ok","sha":"d360ce4b9f5b606f8073fc415c3a354e43542c6d"}`, read before the walk; that is `origin/main`. The frontend serving d360ce4 was confirmed at the ship (SHIP VERIFIED); this check did not read the frontend's sha itself.

Run: `script/walk-prod.mjs` against https://www.conestruct.com/sandbox, headless Chromium, DPR 2 (crops at CSS scale), one browser and one viewport per run. Everything live: geocoding, `/api/road-bearing` (no stub), the tap's nearest-intersection read, the generate, the site scan, the NEEDS YOU map, the audit PDF. The gate header went through `scripts/gate.cjs` `newGatedContext` (the site's own host only); the token was read from `conestruct/site/.env.local`, never printed or saved. Nothing was saved on the site. Address for every run: **1600 E Colfax Ave, Denver** (East Colfax Avenue). Road detection answered `ok` on every Colfax run (4 candidates at the pin, 5 at the tap). Page errors 0, horizontal overflow 0, axe 0 violations on every state recorded, in every run.

Runs (`walk/<part>-<size>.json`):
- `where` at 1440x900, 390x844, 390x664: near-intersection kind, tap at Colfax & Franklin, Move by keyboard, then (not at 664) Cancel and Next.
- `plan` at 1440x900 and 390x844: Shoulder, south side, One-way, Generate; audit PDF through the page's "Download audit trail PDF" button before any answer; then NEEDS YOU, answering the first option each time (at 390 every question, at 1440 up to the bike lane).

| Issue | 1440 | 390 |
|---|---|---|
| #457 Undo links | PASS | PASS (844 and 664) |
| #448 no-line sentence | drawn: PASS. No-line: seen only induced (below) | same |
| #451 PDF "Not checked yet" | PASS | PASS |
| #449 bike lane heading | PASS | PASS |

## #457: every Undo is a plain link; focus after Move — PASS

What I saw: every Undo on the page at each recorded state is `undo-link`, text "Undo", underlined, no border, 50.8 x 44 (read from all `button`/`a` elements whose text starts "Undo", not only expected places). States: the CONFIRM card with the kind answered (U-a), the cross street's ✓ row "Near Franklin Street · Two-way street · 60 ft west of where the work starts" with Move and Undo side by side (U-e), the CONFIRM card with kind and cross answered (U-a, two Undos), the NEEDS YOU answered row "Sidewalks: yes, they're there · not applied yet" (U-b).

Focus after Move (Tab to Move, Enter):

| Size | Before Enter | After Enter |
|---|---|---|
| 390x664 | `cross-move` "Move", top 534.5 | `band-aerial-big-map` "Use the big map instead", top 228.8, on screen, scrollY 214 |
| 390x844 | `cross-move`, top 729.5 | `band-aerial-big-map`, top 228.8, on screen, scrollY 214 |
| 1440x900 | `cross-move`, top 768.8 | `band-aerial-big-map`, top 448.5, on screen, scrollY 35 |

The 390 numbers equal the local walk's after-values (top 228.8, scrollY 214).

Images (opened): `walk/where-1440x900-02-cross-row.png`, `walk/where-390x844-02-cross-row.png` (Move and Undo, both underlined blue links), `walk/where-1440x900-01-confirm-kind-answered.png`, `walk/where-390x844-04-confirm-cross-answered.png`, `walk/plan-1440x900-05-needs-you-answered.png`, `walk/where-390x664-03-after-move-viewport.png` (the button with its ring, the picture in view), `walk/where-390x664-03b-after-move-focus-crop.png` (zoom-in on the focused "Use the big map instead"). Not opened one by one: the other sizes' copies of the same states (their numbers are in the JSON and match).

Not seen: U-c (NEEDS YOU condition records), U-d (a staged acknowledgement) and U-f (the near-intersection note after "Lane count is right"): this plan offered none of them, as in the local walk. Undo's own focus after its row goes was not walked.

## #448: the sentence when the map draws no line — drawn PASS; natural no-line NOT SEEN

What I saw, drawn (both widths): every live NEEDS YOU map answered `x-map-subject: drawn` (`pedestrian_facility`, `bicycle_facility`, and at 390 `adjacent_intersection`, all 200, zoom 0). The drawn sentence is unchanged: "The map shows sidewalks 57.4 ft from the work, so we added 4 devices to protect people walking. Your answer decides whether they stay."

**A natural no-line case was not seen.** All three questions at 1600 E Colfax drew a line. A second address (1000 S Broadway, Denver) was tried at 1440; road detection answered `unavailable` with 0 candidates, so no plan was made there (output not kept).

Induced, labelled as such: on the sidewalk question the walk rewrote the browser's map request flag to `school_zone` (the #448 local walk's method) and pressed Zoom out. The production backend answered `200`, `x-map-subject: none`, and the page read: "The scan found sidewalks 57.4 ft from the work, but the map couldn't draw them. Check them at street level. We added 4 devices to protect people walking. Your answer decides whether they stay." The map then shows only "The work" in the key. After Zoom in with the request left alone, the sentence went back to "The map shows sidewalks …". This shows the production page reading a real `none` header from the production backend; it is not a case where the scan and the map disagree on their own.

Images (opened): `walk/plan-1440x900-q1.png`, `walk/plan-1440x900-q1-text-zoom.png`, `walk/plan-390x844-q1-text-zoom.png` (drawn); `walk/plan-1440x900-q1-induced-no-line.png`, `walk/plan-1440x900-q1-induced-no-line-text-zoom.png`, `walk/plan-390x844-q1-induced-no-line.png`, `walk/plan-390x844-q1-induced-no-line-text-zoom.png` (induced none). Headers: `mapRequests` in `walk/plan-*.json`.

Not seen: the failed-map and loading sentences on production; the other question kinds' no-line sentences.

## #451: the PDF's "Not checked yet" matches the cover — PASS

The PDF: `East-Colfax-Avenue_shoulder_2026-11-08_3244fe.audit.pdf`, 4 pages, downloaded through the page at each width. Extracted text (`pdf/<size>-pdf-text.txt`, `script/pdf_section.py`); the two widths' text differs only in the scan timestamp line.

Page 1, Plan status (both widths):

> 2 changes · 4 needs attention · 13 checked · 3 not checked yet · reference

Page 4 (both widths):

> Not checked yet
> 3 items not checked yet.
> • [one_way_street_widths_chosen] On a one-way street the plan builds an 8 ft shoulder and fits lanes under a 52 ft half-road less that shoulder. Both values are CHOSEN: no MUTCD, S-630-1, Colorado Supplement or Denver text found sets them. Verify against the site (#308). (https://github.com/rtmakatura/conestruct/issues/308)
> • [intersection_layout_not_generated] An adjacent intersection is flagged, but Conestruct does not generate the cross-street approach layout or evaluate traffic-signal operation, and adds no devices for it. Cross-street control design and the signal-operation review (MUTCD §6N.12, 11th Ed. p. 848; Part 4 for signal-head visibility) remain with the traffic control supervisor. Intersection support is tracked at issue #117; corner-quadrant work at issue #128. (https://github.com/rtmakatura/conestruct/issues/117)
> • Work hours not checked (schedule marked Not set: hours not evaluated)

Cover 3, section 3, three bullets, work hours last; no separate #19 link (there are bullets). The "not" twice in the hours bullet is the known wording point in the mission report.

Images (opened): `pdf/1440x900-crop-cover-status.png`, `pdf/390x844-crop-cover-status.png`, `pdf/390x844-crop-not-checked-section.png`, `pdf/1440x900-pdf-page-1.png`, `pdf/1440x900-pdf-page-4.png`. Not opened: `pdf/1440x900-crop-not-checked-section.png` and the 390 full pages (same text).

Not seen: a plan with 0 or 1 pending items on production; a schedule set to real hours.

## #449: the bike lane question — PASS

What I saw (both widths): the second NEEDS YOU question reads "Is there a bike lane at or near the work zone?", map `bicycle_facility` drawn ("Bike lane on the map", running up Franklin St). Its explanation is as before: "The map shows a bike lane 58.1 ft from the work, so we added 2 devices for people on bikes. Your answer decides whether they stay." The sidewalk question's Next line reads "Next: a bike lane at or near the work zone". axe on `.needs-you` with the bike question open: 0.

Images (opened): `walk/plan-1440x900-q2-text-zoom.png`, `walk/plan-390x844-q2.png`, `walk/plan-390x844-bike-heading.png`, `walk/plan-1440x900-bike-heading.png`. Not opened: `walk/plan-1440x900-q2.png`, `walk/plan-390x844-q2-text-zoom.png`.

The "Source: MUTCD § 9C.101" line still shows, and the plan still adds 2 M4-9a (#464, open).

## Not seen (all issues)

- A natural `x-map-subject: none` on production (above).
- #457's U-c, U-d, U-f.
- Real phones, real Safari, a screen reader. Ryan's browser check remains the visual gate.

Browsers: every run closed its own browser; no Playwright browser or node walk process was left running afterwards.
