# #290 checkpoint — the pin marks the work (s2-arc35 investigate)

**Base:** `6fe391e` (= `main` = prod healthz, 2026-09-25). **Branch:** `issue-290-pin-work`.
**Authority:** `rulings.md` (#290's body, FLOW.md §5a and §7, verbatim). **Evidence:** `probes/`
(README there). Investigation only. The only code written was probes, and they live in `probes/`.

---

## 0. Read this first: the brief's premise is inverted on shipped code

The brief and FLOW.md §5a (line 49) say that today "the pin marks where the *advance warning*
begins". **The code says the opposite, and prod draws it that way:**

- **The pin is the corridor's downstream end (station 0), not the first sign.**
  - `src/rules/corridor.py:22-23`: "`anchor_lat`/`anchor_lng` is the **downstream-most** point of
    the corridor (the end of the downstream taper, where drivers exit)."
  - `:24-27`: the bearing points "FROM the anchor TOWARD the upstream end … the *reciprocal* of
    vehicular direction of travel".
  - Both production callers pass the pin straight in (`src/api/site_scan.py:655-665`,
    `src/rendering/plan_sheet.py:4050-4051`).
  - The frontend mirrors agree: `lib/corridor-zones.ts:17-26`, `lib/corridor-map.ts:113-117`,
    `lib/centerline.ts:3-4`. `cross-street.ts:85-90` says "the anchor pin sits at the corridor's
    downstream tip".
- **The field the backend reads as "toward upstream" is labelled "Direction of travel (°)"**
  (`components/LocationPickerModal.tsx:2928`, aria-label `:2957`; marker comment `:307-309`).
- **Detection fills that field with OSM vertex order** (`app/api/road-bearing/route.ts:406`, the
  nearest segment's A→B).
  - On a `oneway=yes` way, vertex order *is* the legal direction of travel.
  - On two-way ways it is arbitrary.
- **So on every one-way road the corridor is drawn and scanned against traffic.** Measured on
  prod 2026-09-25 (`probes/`):

| pin | detected, as the picker words it | where the corridor is laid | for traffic |
|---|---|---|---|
| N Broadway, 39.73370, −104.98753 | "NORTH BROADWAY SOUTHBOUND (PRIMARY, 180°)" | south of the pin; advance warning furthest south, near W 8th Ave | southbound drivers meet the work, then the taper, then the warning signs |
| E Colfax, 39.74020, −104.95600 (the #289 standing spot) | "EAST COLFAX AVENUE WESTBOUND (PRIMARY, 270°)" | west of the pin; advance warning past York St | westbound drivers meet the work before its warning |

Prod screenshots: `probes/overlay-broadway-2-corridor.png`, `probes/overlay-colfax-2-corridor.png`.
`stations.json` has the stations: the first sign sits 1,600 ft along the sent bearing, in the
direction of travel.

**What this does and does not affect today:**
- **Not affected.** The plan itself — the schematic, the device list, the counts, the quote, the
  crew sheet — is built in a work-relative frame with no lat/lng (`layout.py:186-189`: station 0
  is the downstream end of the work).
- **Affected.** Everything geographic:
  - the picker overlay;
  - the scan bbox, whose real upstream approach is covered only by the 152.4 m end pad;
  - the scan's zone labels (`classify_distance`, `corridor.py:681-750`), which say which zone a
    detected intersection, school or sidewalk falls in;
  - the 250 ft relevance window;
  - the page-2 aerial;
  - the near-intersection near/far-side call (`cross-street.ts:106-123` subtracts the downstream
    taper on the assumption that the pin is at the downstream tip).

**What the operator sees, which is why FLOW.md read it the other way.** The arrow points along
traffic. The work (teal) starts about 50 ft from the pin in the arrow's direction, and the amber
advance warning is drawn at the far end. Reading the arrow as the picker labels it, the pin
already sits just before the work, and the approaches are drawn on the wrong side of it.
- The Phase 2 band already *says* so: move-ledger row 2 is "Work starts" (`move-ledger.ts:129`).
- The band's provenance is "the work — not the first sign" (`band-facts.ts:191`).
- So since `#289` the label says "work start" while the backend still reads "corridor
  downstream end". **That is P21's forbidden label-fix, shipped ahead of the model.** I built it
  in #289, per §2.2's ledger text; it is recorded here rather than argued away.

**What this changes in the brief:**

| the brief / FLOW says | the evidence says |
|---|---|
| today's pin = the first sign | today's pin = the corridor's downstream end in the math, and in the picture ≈ the start of the work with the approaches drawn downstream of it |
| the anchor moves "~2,300 ft" | the work moves **50 ft** (the downstream taper, placed floor), or 50 + workLen if "start" is read on the backend's axis. **The approaches flip sides.** It is the *direction* that changes meaning, not mainly the distance. |
| version literal `anchor_semantics: "first_sign"` | that literal would record a false meaning. The v1 value is "the corridor's downstream end, bearing toward upstream" (g). |
| "approaches roughly double the scan bbox on a flagger job" | ×1.2–1.6 on a N–S or E–W road, ×2.0–2.3 on a diagonal; shoulder and near-intersection ×1.00 (e) |
| the pre-scan lever is the tag's hard dependency | the lever as specified cannot produce the tag. The bucket carries no cross-street names, and the memo cannot be shared with Generate (f). |
| the typed bearing field retires | agreed, and it is the fix, not just a cleanup: the typed field is the element whose meaning is inverted |

The shipped mirror is a Rule 10 defect independent of #290's model. I recommend filing it now so
the record says so, but **not hot-fixing it** (the issue draft is at the end). Any interim flip
changes what every pin means, which is exactly what the version field exists to prevent. The
structural fix is this arc: direction derived from road and side, with the `oneway` tag honoured.

---

## (a) The anchor today, in stations, with citations

All stations are feet from the pin, measured along `bearing_deg` (`corridor.py:313-352`). With a
centerline, the walk follows the road's arc length. The typed bearing then sets only the sign,
+1 or −1, from a ±90° test against the local tangent (`corridor.py:384-385`; `centerline.ts:88-116`).

| zone | from | to | length source |
|---|---|---|---|
| downstream taper | 0 | D | `downstream_taper_length(n, use_max)` (`corridor.py:847-851`). Printed and placed: the 50 ft floor, CHOSEN (#257, `layout.py:424`). Scan frame: the 100 ft ceiling (`site_scan.py:684`). |
| work zone | D | D+W | `work_zone_ft` = `scenario.workLen` (`schemas.py:986+`) |
| buffer | D+W | D+W+B | Table 6B-2 (`spacing.buffer_space`, `tables.py:167-180`) |
| taper / transition | D+W+B | D+W+B+T | `_resolve_taper_ft` (`corridor.py:758-776`) |
| advance warning | D+W+B+T | total | A+B+C (`corridor.py:842-843`, Table 6B-1, `tables.py:101-146`) |

The same order is walked by `classify_distance` (`corridor.py:737-747`) and
`work_zone_endpoints` (`:306-311`).

**Denver shoulder plan (the #289 standing spot), 30 mph, `urban_low`, workLen 1000:**
- A+B+C = 300, T = 50, B = 200, D = 50.
- The work occupies **50 → 1,050 ft from the pin**. Its traffic-side (upstream) edge is at
  1,050 ft and its downstream edge at 50 ft.
- The first sign is at 1,600 ft; the scan frame adds 50 to each.

So, in the backend's own terms, the work *begins* for traffic 1,050 ft from the pin. In the
picture the operator sees, it begins 50 ft from the pin (a).

---

## (b) The reader map: anchor vs zone start, per reader

"Anchor" = reads the raw pin. "Station" = reads a zone start or station derived from
`build_corridor`. "Work frame" = the layout's own frame (station 0 is the work's downstream end;
no lat/lng).

| # | reader | reads | must read after |
|---|---|---|---|
| 1 | scan frame: `site_scan.py:655-684` → bbox `:699-702` | anchor | the envelope of every approach, plus the work |
| 2 | `corridor_bbox` (`corridor.py:501-589`) | station | a hull over every approach's first sign (e) |
| 3 | the #256 fold's road set around the pin (`site_detection.py:690, 716`; `site_scan.py:733`) | anchor | unchanged; the work start is on the road |
| 4 | zone classification (`site_detection.py:746-749` → `classify_distance`) | station | per-approach zones, measured from the work start |
| 5 | "nearest N ft from anchor" (`site_detection.py:749-772`, `audit_blocks.py:341`, `lib/tiering.ts:116`) | anchor | the distance from the work start. This is what #285's tag wants. |
| 6 | "[zone @ N ft]" printout (`site_detection.py:774`) | station | the new origin |
| 7 | 250 ft relevance (`site_detection.py:447-456`, `_is_feature_relevant :478-510`, CHOSEN) | station | the window past *each approach's* outer end (c, guardrail 6) |
| 8 | `validate_corridor_against_osm` (`audit.py:1343-1370`) | anchor | the work start; the bearing becomes derived |
| 9 | `corridor_spec` (`audit.py:1489-1494`) and `/render/corridor-spec` (`render_api.py:964-1018`) | lengths | per-approach lengths, and per-approach geometry in the response (h) |
| 10 | page-2 aerial corridor (`plan_sheet.py:4011-4073`), crop centre (`:3516-3518, 3627-3631`), work overlay (`:3564-3574`) | anchor + station | the work segment first, then the approaches |
| 11 | second OSM bearing check (`plan_sheet.py:3541-3545`, outside the #256 fold) | anchor | same as #8, or deleted into the fold |
| 12 | CORRIDOR DETAILS "Anchor", "Bearing" rows (`plan_sheet.py:3704-3709`); page-2 caption (`:3879-3881`) | anchor | "Work starts" + a derived bearing (a Rule 5 text change) |
| 13 | title-block coordinates / "Site bearing not provided" (`plan_sheet.py:2100, 2114, 4156`) | anchor | the work start; the bearing is derived |
| 14 | layout stations, crew narrative, `placed_downstream_taper_ft` (`layout.py:186-189, 619-622`; `crew_narrative.py:345-394`; `corridor.py:867-888`) | work frame | **unaffected** |
| 15 | TA-21/22 near/far side (`plan_sheet.py:3998-3999`; `layout.py:1259-1302`) | work frame | unaffected, *if* #16 is rebased |
| 16 | `alongStationFromPins` (`lib/road-detection/cross-street.ts:106-123`, called at `LocationPickerModal.tsx:1055-1064`) | anchor | the work start, and **moved to the backend**. It is frontend corridor math today (Rule 3). |
| 17 | picker overlay (`LocationPickerModal.tsx:677-688` → `lib/corridor-polyline.ts:91-137`, `lib/centerline.ts:66-116`) | anchor | the work first, then per-approach channels from the response |
| 18 | picker legend / extent panel (`LocationPickerModal.tsx:1289, 1342-1350, 3395-3406`) | lengths | per approach |
| 19 | WHERE band extent rows (`components/bands/WhereBand.tsx:70-79, 503-525`) | lengths | per approach |
| 20 | band staleness key and "pin at …" provenance (`lib/scenarios/band-facts.ts:121-132, 193, 320`; `centerline-relay.ts:21`) | anchor | the work start (same coordinate, new meaning) |
| 21 | `meta.intersection` (#234; `lib/scenarios/types.ts:363-373`) | second pin | unaffected; provenance only, dropped by the backend |
| 22 | quote distance (`QuotePanel.tsx:206-220` → `app/api/distance/route.ts:57`) | anchor | the work start; no visible change (5 mi rounding) |
| 23 | jurisdiction suggestion (`GeneratorShell.tsx:793-796`, `render_api.py:920`) | anchor | the work start; no visible change |
| 24 | debug snapshot / replication (`DebugSnapshotButton.tsx:170-182`, `replication_snapshot.py:81`) | anchor | must carry the version field (g) |
| 25 | corridor-check disclosure copy (`AuditTrail.tsx:1299-1315, 1540`) | anchor | copy only |
| 26 | `lib/corridor-map.ts:193-222` | anchor | **dead code**: the route it names does not exist (`WhereBand.tsx:28-31`). Delete it rather than migrate it. |

**Senders of the wire** (every one posts the whole `Scenario`; there is no serializer, and
`render-proxy.ts` applies `withRelayedCenterline` at `:109, 173, 220, 262, 354`):
- device-breakdown (`GeneratorShell.tsx:445-448`);
- audit (`:503-506`);
- preview (`:623-629`);
- bundle (`:1057-1064`);
- single downloads (`OutputCards.tsx:351-354`);
- quote and quote-breakdown (`QuotePanel.tsx:250-253, 276-279`);
- save / update plan (`PlanSaveButton.tsx:78-83, 104-107`);
- replication snapshot (`DebugSnapshotButton.tsx:286-289`);
- pin-only: jurisdiction (`GeneratorShell.tsx:796`), distance (`QuotePanel.tsx:217-220`), road-bearing (`LocationPickerModal.tsx:876-879, 1021-1024`);
- corridor-spec (lengths, no pin; `LocationPickerModal.tsx:624-635`);
- legacy Streamlit (`src/api/app.py:102-122`).

**Writers of the pin and bearing:**
- the picker's save via `withPin` (`GeneratorSidebar.tsx:296-300`);
- `ManualFallback.tsx:61, 72` (lat/lng);
- `ManualFallback.tsx:78-97` (a second typed bearing field, "Bearing (° from N)").

---

## (c) "Upstream" per kind — the primary question

Live kinds: `shoulder`, `flagger_lane_closure`, `near_intersection` (`index.ts:283-287`;
`render_api.py:108-110`). "Side" below means **which edge of the road is occupied**, from which
the travel direction follows for right-hand traffic (d).

| kind | where the work is | approaches that reach it | start + length + side enough? | what the user must add |
|---|---|---|---|---|
| **shoulder** (TA-3 / TA-5) live | the occupied shoulder, from start for `workLen` downstream | **1**: the traffic whose right shoulder it is. The undivided generator does not sign the opposing direction (`layout.py:617-619`); the divided one mirrors signs onto the median side (`:224-240`). | **yes** | nothing. The side gives the direction on a two-way road; on a one-way it is fixed by the `oneway` tag. |
| **flagger_lane_closure** (TA-10) live | the closed lane, from start for `workLen` | **2**. The closed lane's direction gets taper + buffer + a flagger 100 ft upstream + A, B, C, C. The opposing direction gets a flagger 300 ft past the work's far end (CHOSEN, `tables.py:69`) + A, B, C, C (`layout.py:1650-1760, 1972-2000`). | **yes, if side = which lane is closed.** That orients both approaches: the closed lane's approach is upstream of *start*; the opposing approach is upstream (for opposing traffic) of *start + workLen*. | nothing more. "Start" must be ruled as **the upstream end for the closed lane's traffic** (h). Swapping the ends without a side would swap which approach gets the taper, so the side is essential here, not optional. |
| **near_intersection** (Cases 18/19) live | on the main road, near a cross street | 1 on the main road, plus 1–2 cross-street legs each in its own frame (0 = the curb; `layout.py:1365-1374, 1596-1633`). The opposing main-road direction is not signed. | **no** | which cross street (today the second pin, `meta.intersection`), plus per-leg speed, lanes, signal and bearing. After: the leg's along-station is computed **on the backend** from the work start (b #16). #234's `meta.intersection` stays the leg's provenance, and the #285 tag must agree with it. |
| lane_closure_divided (TA-19) gated | the closed lane of one carriageway | 1, signed on both sides | yes (side = carriageway + lane) | which lane, once lanes other than the right one are modelled (`layout.py:118-152`, CHOSEN rightmost) |
| work_beyond_shoulder (TA-1) gated | beyond the shoulder | 1 | yes | nothing |
| mobile_op_2lane / multilane (TA-35 / TA-26) gated | the truck at station 0, moving; no fixed segment (`layout.py:2266-2272`) | 1, a snapshot | **no**: a length means nothing | **start + direction only.** The model keeps `work.start` + `work.travel` and allows `length_ft` to be absent for this kind, without designing more (FLOW §5a's last bullet). |

**The known hard cases:**

- **Flagger, "which end is start".** Rule it as the upstream end for the closed lane's traffic.
  The length then runs in that traffic's direction. Tapping the other end first is legal: the
  second point sets the extent, and the backend orders the two ends by the travel direction the
  side implies. The operator never has to think in "start vs end", only "the work runs from here
  to here, on this lane".
- **Flagger today already reaches past its own corridor.**
  - At 45 mph the opposing W20-1 is at station −1,700. The scan covers only to about −550 (the
    500 ft pad), so about 1,150 ft of the second approach is unscanned today (about 150 ft at
    25–35 mph).
  - The primary chain (flagger + A + B + C + C) ends at 2,360 against the corridor's 1,910.
  - And `site_scan.py:671` passes `closure_type="lane"` (`schemas.py:1006-1010`), so the scan
    frame uses the 540 ft merging taper where the plan sheet uses 100 ft (`plan_sheet.py:4036-4047`
    remaps; the scan does not).
  - All three are pre-existing and fall out of the per-approach envelope in (e).
- **Near-intersection, an approach running through the intersection.**
  - The main-road taper is pushed to at least 100 ft upstream of the upstream curb
    (`layout.py:1315-1318`, `_INTERSECTION_TAPER_CLEARANCE_FT :1206`, Sheet 10). The A/B/C signs
    ignore the intersection, as today.
  - The cross-street approach is the leg set, which is unaffected in its own frame.
  - Guardrail 6: the 250 ft window is measured past each approach's outer end. No second number.
- **Divided and one-way.**
  - One direction of travel, fixed by the carriageway, or by `oneway=yes` / `-1`.
  - The side control offers only the edges of that carriageway.
  - A one-way primary is classified divided (`classify.ts:131-138`), so Note 8's both-sides
    signing already touches the other edge (`validators.py:904-953`, `audit.py:855-872`).
  - **#243 is orthogonal:** the site-adjustment signs are one-sided by design, and the fix stays
    in the checker.
- **Mobile.** Keep a place for `start` + `travel` only (above).

---

## (d) Direction and side: what the side control writes

**Today:**
- Direction is typed (`LocationPickerModal.tsx:2952-2957`; `ManualFallback.tsx:78-97`) or
  auto-adopted from vertex order (`:930-941`).
- Flip adds 180° (`:1656-1661`).
- #140's stitched centerline gives an **axis, not a direction**. Its vertex order "carries no
  meaning" (`centerline.ts:89-90`), and the typed value picks the sign (#214).
- There is **no side field** on the wire (`schemas.py`, `types.ts`).
- Right-side work is hard-coded: `W21-5aR` (`layout.py:224-230, 656`), rightmost lane
  (`:118-152`, CHOSEN), flagger right lane (`:1777-1780`).
- `layout.py:186-189` says offsets are "+ to the right when facing **upstream**", which
  contradicts the right-shoulder signs. It looks like a docstring slip and needs confirming in
  the build.

**After (the recommendation):**
- The direction is **derived on the backend** (Rule 3) from the confirmed road plus the side.
- The side control writes two enums relative to the confirmed centerline, which is already on
  the wire as `meta.centerline`:

```
meta.work = {
  start:     { lat, lng },               // the pin, snapped to the centerline (move 2)
  length_ft: number | null,              // one producer, two controls (move 3; null only for mobile)
  travel:    "with_geometry" | "against_geometry",  // which way the occupied lane's traffic runs
  side:      "right" | "left",           // the occupied edge, relative to that traffic
}
```

- **The control does not show the enums.** It shows the road's two edges in compass words,
  computed from the geometry at the pin, for example:

  > East side · northbound traffic
  > West side · southbound traffic

  One choice writes both enums (right-hand traffic: the east edge of a N–S road is the northbound
  lane's right side).
- On a one-way road `travel` is **fixed by the `oneway` tag** (`yes` = with the geometry, `-1` =
  against), and the control offers the two edges of that direction.
- Only `side: "right"` is live, because the layout models only the right side. `"left"` renders
  gated (Rule 8), and the median / left-shoulder case is named, not built.
- **With no confirmed road** (manual mode), there is no geometry to derive from. Recommendation:
  ManualFallback offers a four-way compass choice ("traffic heads N / E / S / W") that writes a
  coarse travel bearing, labelled as coarse. The free-typed degree field is retired either way
  (Rule 5). **This needs your ruling:** manual mode is the one place a direction still has to be
  said.
- **#214's disclosure retires with the typed field**, as FLOW §5a rules. That covers:
  - the producer: `detected-rows.ts:375-386` (`bearingCaveat`, switched at `:129`), rendered at
    `WhatBand.tsx:311-313`;
  - the hand-written picker copy: `LocationPickerModal.tsx:2992-3001`;
  - the byte-identity pin: `WhatBand.density.test.tsx:331-337`, plus its regex copy in
    `WhatBand.detection.test.tsx:146-165`;
  - comments at `FieldCell.tsx:9, 26` and `WhatBand.tsx:279, 689`.

  **Retires, not moves:** its sentence describes a field that no longer exists. The detection
  footer's "Bearing" line (`WhatBand.tsx:306`) becomes the derived direction, printed as a
  measured fact.

---

## (e) The bbox growth per kind, and its effect on the scan

Probe: `probes/bbox_probe.py`. Straight road, no centerline. Scan frame: `use_max`, 100 m lateral
pad, 152.4 m end pad (`site_detection.py:466, 475`). "After" = the per-approach envelope.

| kind | mph | total ft, today → after | 0° km², today → after | × | 45° km², today → after | × |
|---|---|---|---|---|---|---|
| shoulder | 25 / 35 / 45 | 1583 / 1704 / 2630, unchanged | 0.158 / 0.165 / 0.222 | 1.00 | 0.488 / 0.526 / 0.855 | 1.00 |
| near_intersection | 25 / 35 / 45 | 1180 / 1395 / 2550 | 0.133 / 0.146 / 0.217 | 1.00 | 0.374 / 0.433 / 0.824 | 1.00 |
| flagger, urban | 25 | 1080 → 1560 | 0.127 → 0.156 | 1.23 | 0.349 → 0.482 | 1.38 |
| flagger, urban | 35 | 1295 → 1990 | 0.140 → 0.183 | 1.30 | 0.405 → 0.619 | 1.53 |
| flagger, urban | 45 | 2450 → 4300 | 0.211 → 0.324 | 1.54 | 0.785 → 1.652 | 2.10 |
| flagger, rural | 45 | 2900 → 5200 | 0.238 → 0.379 | 1.59 | 0.966 → 2.188 | 2.26 |

For scale, arc 31's Denver box was 0.273 km².

**Effect on the scan:**
- The measured evidence says size did **not** drive time on the fast mirror. Denver 4,381.5 ms
  total, 4,377.6 ms of it time to first byte (`s2-arc31-scan-budget/README.md:22-26`).
  `use_max` is 1.1 % (`:116`).
- Every remaining refusal after #256 is a mirror-3 read timeout at the full budget. Mirrors 1 and
  2 used their 7 s caps and left mirror 3 about 6 s (`issue-256-scan-chain/README.md:155-159`,
  #292). Mirror 3 is the one where payload costs time: 230–303 ms to transfer 79 KB.
- **Prediction, not measured:** a 2.19 km² diagonal flagger box is about 3,200 elements / 640 KB,
  so about 2 s of transfer alone on mirror 3 against about 6 s of headroom. **Yes, a diagonal
  flagger corridor pushes toward refusal.** A N–S or E–W one (×1.2–1.6) probably does not.
- **The shaping finding: the north-up box is the waste, not the approaches.** At 45° the box pays
  about 3× the corridor's real area, today, for every kind. A road-following strip (Overpass
  `around:R, lat1,lon1, …` along the centerline, or `poly:`) is constant in any bearing: the
  rural-45 flagger drops from 2.188 to **0.378 km²** at 45°. Two boxes, one per approach, are
  worse at 0° (0.440).
  - **Caveat:** `around` and `poly` cost more per element server-side, which is unmeasured.
- **Recommendation:** the approach envelope lands as a union of per-approach hulls, keeping
  today's box shape so the diff is one change. The strip-vs-box question gets a prod measurement
  (N=20, flagger at a diagonal Denver pin, both query shapes) as a pre-commit of the flagger ship,
  before anything is ruled on it.

---

## (f) The pre-scan lever: its own arc, re-scoped, and not this arc's gate

Three measured facts make #256 lever 2, as specified ("warm the memo so the first Generate
memo-hits"), unable to deliver #285's tag:

1. **The memo cannot be shared with Generate.**
   - The key hashes every Generate input: lat, lng, bearing, speed, workLen, closure type, road
     type, widths, centerline and **bbox** (`site_scan.py:357-367, 582-594`).
   - At confirm, speed, length and kind are not known.
   - Worse, the memo stores **buckets already sorted against one corridor**, keeping the first 5
     per bucket (`site_detection.py:743-761`), not the raw payload.
   - A fixed box around the pin big enough for every live kind is about ±6,500 ft plus the
     length, about 16 km² (`probes/radius_probe.py`).
2. **The memo is per container** (`site_scan.py:575`, `max_containers=8`, `modal_app.py:134`).
   Arc 31 measured 59 % / 69 % hits on *immediate* repeats and called the lever "partial at best"
   (`s2-arc31-scan-budget/README.md:122-133`). The TTL is 120 s (`site_scan.py:79`), probably
   shorter than confirm-to-Generate.
3. **The intersection bucket cannot name a cross street.**
   - It is filled from `traffic_signals` and `crossing` nodes (`site_detection.py:324-325`),
     which usually carry no `name` ("unnamed at lat, lng", `:153-157`). Many crossings are
     crosswalks.
   - Its nearest distance carries no label (`:776-781`).
   - The stored five are in Overpass order, not nearest-first.

**Recommendation.** Split #285's producer from the memo lever:

- **#285's producer is its own arc, before the tag commit and not before this arc.** It is a
  backend read at pin confirm:
  - it finds the nearest **named-way intersection** along the confirmed road (the node shared
    by the confirmed way and another named `highway=*` way);
  - it returns the name and the along-road offset from the work start;
  - no lock, no write, no memo: a read, within suggest-never-set;
  - on refusal or no match, it returns no cross street, and the tag keeps today's interim (road
    name, lat/lng in provenance). That interim is already built (`move-ledger.ts:115-146`;
    `band-facts.ts:144-150, 190`).
  - The fetch radius is a new number and would be marked CHOSEN in that arc.
  - The 250 ft threshold is **not** that radius. It is an along-corridor tolerance past the
    ends. Guardrail 6 applies to near-intersection *detection* (proposing the kind when a work
    end is within 250 ft of an intersection), and there it is reused unchanged.
  - **"The tag names a cross street only from a bucket"** (#290 acceptance) then means this
    read's result, not the site scan's intersection bucket. That wording needs your ruling.
- **The memo-warming lever is deferred** until a shared memo exists (a Modal Dict, arc 31's
  "structural version"). If it is ever built, whether a cache write counts as "a read" needs a
  ruling: #281 rules previews "never memoised, never written".
- **So #290's gate should be re-scoped.** The work-segment model (version field, anchor move,
  side, approaches) does not need a pre-scan at all; only the tag does. Phase 3 can build its
  model while the tag stays on the ruled interim.

---

## (g) Migration: the version field, v1 under v2, fixtures

**Field.**
- `ScenarioMeta.pinModel: "corridor_end" | "work_start"`.
  - The name is proposed; the brief's `anchor_semantics` works too.
  - **Not `"first_sign"`:** the evidence says v1 was never that.
- **Backend default when absent = `"corridor_end"`**, so every existing sender, saved plan and
  fixture keeps meaning what it meant.
  - Pydantic drops unknown keys (`ScenarioMeta` has no `model_config`, `schemas.py:97`), so the
    backend lands first.
- The field is **read first**: `scenario_to_call` dispatches on it before anything touches the
  pin.
- It is echoed into the audit JSON and the replication snapshot.
- `MEMO_KEY_VERSION` (`site_scan.py:101`) is bumped with v2, so no v1-frame buckets are served
  to a v2 corridor.

**v1 under v2 code: never silently re-read.** A v1 record's direction is ambiguous. The UI told
its author the arrow was the direction of travel, and the backend used the reciprocal. Two
honest renderings:

- **Recommended:** the pin opens as the v2 work start, 50 ft off, which is disclosed in
  provenance.
  - `length_ft` = the old workLen.
  - **`travel` and `side` unset.**
  - The ledger's row 4, "Which side is occupied?", is ⚠ needs you.
  - Nothing is guessed. The first Generate after the operator's confirm writes v2.
- Alternative: keep a v1 code path forever. Rejected: two frames, double the readers in (b).

**Saved plans.** Neon `plans.data` is the raw Scenario JSON (`db/schema.ts:20-38`; POST
`app/api/plans/route.ts:60-68`, PUT `[id]/route.ts:30-47`), unvalidated. `toScenario()`
(`lib/scenarios/index.ts:603-607`) is the only load gate, and it stamps absent as `corridor_end`.
The prod row count is **unconfirmed**: I have no DB access and no admin route exists. One
read-only query, in the Neon console or `npm run db:studio`, confirms it:

```sql
SELECT count(*) AS plans,
       count(*) FILTER (WHERE (data->'meta'->>'lat')::float <> 0) AS pinned
FROM plans;
```

**Fixtures.** Backend math fixtures convert *per the backend's v1 meaning*: they test geometry,
not a user's intent.

| family | files with a pin | disposition |
|---|---|---|
| `pdf_worst_case` scanned-{ok,asserted,dismissed,not-checked} | 4 (Lakewood 39.7113, −105.0815, bearing 180) | convert (pin → the v1 work's traffic-side edge, travel = bearing + 180) |
| `tiering` scanned wire responses | 4 | convert |
| `site_scan/lakewood_overpass.meta.json` | 1 | convert (bbox restated) |
| `centerline/lookout_mountain_road.json` | 1 | **re-baseline along the centerline**, not a straight shift. Its tests exist to show the chord leaving a curve. |
| everything else (23 files, 90 Python snapshots) | 0 (0/0 or no pin) | nothing |

- The expectation-JSON pin (`tests/fixtures/tiering/tiering-expectations.json`, read by
  `lib/tiering.test.ts` and `tests/test_tier_ledger.py:91`) holds no coordinates. It still moves
  both sides together if a tier changes.
- **Single-leaf proof in the build:** convert `pdf_worst_case/scanned-ok` alone, then assert that
  its audit JSON and PDF text are identical before and after conversion, before converting its
  siblings. The geodesic round trip is already exact to 7.1e-15° (`probes/leaf_proof.py`, a sketch
  only).

---

## (h) Option (a) / (b) / (c)

**Recommendation: (a), with the per-approach geometry returned in the response, not carried on
the request.**

- **(a) Move the anchor in `build_corridor`.**
  - The corridor takes `work.start`, `length_ft`, the derived travel bearing, and the kind.
  - It returns the work segment plus a list of approaches, each with its own station frame
    (0 = its first sign … the work edge).
  - Shoulder: one approach. Flagger: two, the second upstream of `start + length` for opposing
    traffic. Mobile: a start and a direction.
  - Every station reader in (b) moves once, behind the version field.
  - Rule 3: all of it on the backend.
  - Rule 10: the version field makes the change visible.
  - P21: the model changes, not the label.
  - **Flagger:** expressed directly.
- **(b) Translate at the edge (the frontend walks the work pin back to a "first sign").** This is
  the label-fix P21 forbids ("the label is never the fix"):
  - The wire would carry a coordinate the user never chose, and the saved plan would store it.
  - The walk needs every MUTCD zone length and the station frame, which is exactly the
    corridor-spacing failure Rule 3 names.
  - Changing speed or length would silently move the stored pin, against P1: nothing moves that
    the user did not ask to move.
  - **Flagger:** it cannot be expressed. One translated anchor has one direction, and flagger
    needs two approaches.
  - It would also keep today's inversion, because the walk direction comes from the same
    mislabelled bearing.
- **(c) Two anchors on the wire (`work_start` chosen, `first_sign` derived per approach).**
  - Derived points are outputs. On the request wire they are a second writer of a backend fact,
    against P2 and Rule 3.
  - Stripped of that, (c) *is* (a) plus a response field, which is what the recommendation
    already does.
  - **Flagger:** it needs two derived anchors. That is fine as response data, wrong as request
    data.

---

## (i) The WHERE band's five moves; which modal pieces migrate now

**The ledger after** (the rows exist since #289; `move-ledger.ts:115-195`):

1. **Found the spot** · CHANGE. Unchanged.
2. **Work starts** · MOVE.
   - The label finally becomes true.
   - Value: the road name (interim), or "210 ft N of W 38th Ave" once #285's producer lands.
3. **Extent** · CHANGE. "1,000 ft, typed". One producer; the length box is the only producer at
   380 (rule 171).
4. **Which side is occupied?** · ⚠ needs you, the only washed row (rule 69).
   - It returns with the side control (d).
   - The kind chips stay below it. After the hand-check the kind was folded into this row as
     "Kind of work"; it goes back to side here.
   - The kind stays confirmed-never-inferred. #284's proposal only pre-selects, and only from a
     producer (suggest-never-set).
5. **See the plan grow** · ◌ until side and kind are confirmed, then ✓.

**The aerial:**
- Before the side is confirmed: the pin, the work segment (#3fd3a8), and a dotted "not yet laid
  out" channel. Legend: two rows. **Nothing upstream is drawn speculatively** (rule 112).
- After: the approaches lay out upstream of the work (rule 110's five channels), and the legend
  goes to five rows.
- On a flagger job: two advance-warning channels, one at each end, each labelled with its
  direction ("northbound approach" / "southbound approach"), so no channel's meaning rides on
  position alone (rule 111, P9).

**Modal pieces, named before → after (§8.40, ruling 189):**

| piece | before | after (this arc) |
|---|---|---|
| Direction of travel field + Use detected + Flip + #214 caveat (`LocationPickerModal.tsx:2922-3001`) | in the modal | **retired** (Rule 5), not migrated |
| ManualFallback "Bearing (° from N)" (`ManualFallback.tsx:78-97`) | on the band | **retired**; replaced by the coarse compass choice pending your ruling (d) |
| side control | does not exist | **new, on the band** (move 4), plain chips; phones use it |
| work-zone length field in the modal (`LocationPickerModal` "Work zone length (ft)") | modal and band both write `workLen` | **modal copy removed.** The band's Extent is the one control (P2); the second-point tap is its second producer, in the modal until the aerial migrates |
| corridor extent panel and legend (`:1289, 1342-1350, 3395-3406`) | in the modal | stays in the modal, redrawn per approach |
| aerial map and overlay | modal only (`WhereBand.tsx:10-37` records the deviation) | **stays in the modal this arc**, redrawn under the new model. Migrating the map (3,416 lines of modal state, plus a static-image route that does not exist) is its own arc after this one. |
| search / FIND, candidates, jurisdiction and street-class suggestions | modal | unchanged |

---

## (j) Rule 5 churn, predicted

**Python** (2,117 collected; baseline 2,115 passed, 2 skipped). The anchor move alone, simulated
by the `probes/anchor_shift_probe.py` plugin, fails **4 tests in 3 files**, the same 4 at either
shift size:
- `test_classification_frame.py` ×2 (Lookout)
- `test_corridor_centerline.py` ×1 (Lookout)
- `test_plan_sheet_location.py::TestPageTwoCaption` ×1 (the caption prints the anchor)

Added on top:
- the side/travel enums;
- flagger's two approaches: new tests, plus the flagger scan-frame taper fix (`site_scan.py:671`),
  which moves every flagger scan bbox, predicted in each flagger scan-reading test;
- the CORRIDOR DETAILS rows "Anchor" → "Work starts" and "Bearing" → derived (the caption and
  plan-sheet text tests).

Predicted total: **about 8–15 Python tests** across `test_corridor*.py`, `test_classification_frame.py`,
`test_plan_sheet_location.py`, and the site-scan flagger tests. 17 test files (599 tests) touch
corridor geometry, and the rest held under the shift.

**Site** (1,421 tests in 167 files):
- `lib/corridor-polyline.coverage.test.ts` (4), `lib/corridor-zones.test.ts` (7),
  `lib/centerline.test.ts` (13): the mirror changes or is replaced by response geometry.
- the #214 pins: `WhatBand.density.test.tsx:331-337`, `WhatBand.detection.test.tsx:146-165`.
- the direction-of-travel tests in `LocationPickerModal.road-pick.test.tsx:233, 249, 276`.
- the ledger and band-facts tests for row 4.

Predicted: **about 35–45 site tests.**

**Fixtures:** 9 convert, 1 re-baselines (g). **Snapshots:** 0 of 90 Python; no vitest snapshots
exist.

**Harnesses:** 133 tracked code files pin 110 distinct coordinates, 85 of them in
validation-artifacts. None is CI-gated, and all drive the UI or the wire.
- From the v2 ship on, their pins mean the work start.
- The coordinates stay valid as *locations*. Every *recorded* plan output keyed to them is v1
  evidence and stays as history, not as an expectation.
- The #289 standing spot (E Colfax 39.74020, −104.95600) is WESTBOUND: its approaches move from
  west of the pin to east of it.

**Reference pins:** 14 in memory.md (6 with coordinates). They are road locations, valid under
both meanings; memory.md gains one line on what v1 records meant.

**Citation counter** stays at **19**: no new citation is planned. The spec sources quoted here
are the code's own, not new claims.

---

## (k) Commit sequence: backend-first, each ship naming its visible change

| # | commit(s) | ship | visible change |
|---|---|---|---|
| 1 | **the version field**: `ScenarioMeta.pinModel` (default `corridor_end`), read first in `scenario_to_call`, echoed in audit + snapshot | backend | **none (backend-only ship)** |
| 2 | every sender enumerated in (b) stamps `corridor_end` explicitly; `toScenario()` stamps absent on load; `PlanSaveButton` persists it | frontend | **none** |
| 3 | backend v2 corridor behind `pinModel == "work_start"`: work start, `travel` / `side` enums, derived bearing, the approach list (shoulder 1, flagger 2), the envelope bbox; the flagger scan-frame taper fixed; `MEMO_KEY_VERSION` bumped; `alongStationFromPins` moved backend-side; v1 path byte-identical (asserted) | backend | **none (backend-only ship)** |
| 4 | fixture conversion: the single-leaf proof on `scanned-ok` first, then 8 siblings; Lookout re-baselined along its centerline | backend, tests only | **none** |
| 5 | flagger bbox measurement on prod, box vs strip, N=20 at a diagonal Denver pin | evidence | none |
| 6 | **the pin marks the work**: senders send `work_start`; the side control on the band (row 4 back to "Which side is occupied?"); the modal's direction field, Flip, #214 caveat and length copy retired; ManualFallback's typed bearing replaced; the overlay draws the work first and the approaches after confirm (rules 110–112) | frontend | **yes, the arc's visible ship.** The picker loses Direction of travel. The band asks which side. On Broadway and Colfax the approaches now lay out *upstream* of the work. |
| 7 | plan sheet: CORRIDOR DETAILS "Work starts" + derived bearing; page 2 draws the approaches | backend | **yes, PDF page 2** (text + overlay). Containment zero re-run. |
| 8 | #284 proposed-kind producer (backend) + chip "✓ proposed" | backend → frontend | yes: a proposal renders only from the producer |
| — | #285 named-intersection read: **its own arc** (f), after 6 | — | the tag, when it lands |
| 9 | evidence: every S2 state on prod at 1440 and 380; then Ryan's hand-check | evidence | none |

Commits 1 and 2 can ship together (two commits, one ship line). Commits 3 and 4 likewise. Commit 6
must not ship before 3 is live on prod (backend-first).

---

## (l) Principles table

Surfaces:
- **W** — the WHERE band: FLOW step 1, the rep and the estimator.
- **M** — the picker modal and aerial: step 1, same users.
- **S** — the scan and site conditions: step 4, the estimator; the TCS reads the audit.
- **P** — the plan sheet page 2: step 5, the TCS and the crew.
- **D** — the saved-plan / version path: step 5 + the second visit, the estimator.

| P | holds how | surfaces |
|---|---|---|
| P1 nothing moves unasked | the pin is the user's; derived points never overwrite it ((b) rejected); a v1 plan's pin stays put | W, M, D |
| P2 one voice per fact | one extent producer; the modal's length copy removed; direction derived once on the backend | W, M |
| P3 next thing visible | row 4 is the only washed row until the side is confirmed | W |
| P4 edges | no layout change beyond the existing ledger row | W |
| P5 hierarchy | the existing `tr-*` roles; no new sizes | W |
| P6 content never dictates layout | the side chips carry compass words that vary in length, inside the grid | W |
| P7 reversible before irreversible | choosing a side stages; Confirm writes; the pre-scan / tag read writes nothing | W, S |
| P8 honest waits | no fake "laying out"; the dotted channel says "not yet laid out" | M |
| P9 symbol + word | every overlay channel has a legend word; the two flagger approaches are named by direction | M, P |
| P10 targets | side chips at the existing chip size (≥44 px) | W |
| P11 consistency | the same five channels on the picker and page 2 | M, P |
| P12 polish is trust | a corridor drawn against traffic is the least trustworthy thing on the screen; fixing it is the trust fix | M, S, P |
| P13 simple first | the side is two chips; bearing degrees are gone | W |
| P14 empty states | before the side: two legend rows plus "not yet laid out", never a blank map | M |
| P15 undo, record stays | a v1 plan's re-confirm is recorded; undo of a side choice restores the byte-identical wire | W, D |
| P16 no fake progress | nothing upstream drawn speculatively (rule 112) | M |
| P17 named person, named job | each surface above names its step and user | all |
| P18 one question per step | row 4 asks one question; Confirm names the choice | W |
| P19 80 % default | shoulder on the right is one tap; left is gated | W |
| P20 zones by the user's question | the WHERE band answers "where is the work", not "where is the first sign" | W |
| P21 the model matches the mental model | **the arc's point.** Today the label says "Work starts" over a model that says "corridor end", and the arrow says "direction of travel" over a model that reads its reciprocal. (a) changes the model on the backend. | W, M, S, P |
| P22 revision is a mode | a side change after Generate goes through the S7 preview / apply path unchanged | W |

---

## Questions for your ruling

1. **Premise.** Accept that today's pin is the corridor's downstream end (§0), and that the
   version field records `corridor_end`, not `first_sign`?
2. **The shipped mirror.** File the defect (draft below) and let this arc fix it structurally,
   with no interim flip?
3. **Option (a)**, with per-approach geometry in the response?
4. **Side control** writes `travel` + `side` relative to the confirmed centerline, shown as
   compass-worded edges; `left` gated. **Manual mode** gets a coarse four-way direction choice?
5. **Flagger "start"** = the upstream end for the closed lane's traffic, with the ends ordered by
   the backend?
6. **v1 under v2:** open with `travel` / `side` unset and row 4 ⚠, never re-read?
7. **Gate re-scope:** #290's model proceeds without the pre-scan. #285's producer is a named-way
   intersection read in its own arc. The memo lever is deferred to a shared memo. "From a bucket"
   in #290's acceptance means that read.
8. **Aerial:** stays in the modal this arc (redrawn); the map's migration to the band is the next
   arc.
9. **Bbox:** union of per-approach hulls now; box vs strip decided by the prod measurement in
   commit 5.

---

## Draft issue: the shipped mirror (paste-ready; `gh` is read-only here)

```
Title: Corridor is laid against traffic on one-way roads: "Direction of travel" is read by the corridor math as the direction toward the first sign
Labels: bug, priority-high, backend, frontend, ux, p12, p21

## Problem

The picker's bearing field is labelled "Direction of travel (°)" (`conestruct/site/components/LocationPickerModal.tsx:2928`, aria-label `:2957`), and detection pre-fills it from the nearest OSM segment's vertex order (`conestruct/site/app/api/road-bearing/route.ts:406`). On a `oneway=yes` way that order *is* the legal direction of travel. The corridor math reads the same value as the bearing "FROM the anchor TOWARD the upstream end … the *reciprocal* of vehicular direction of travel" (`src/rules/corridor.py:22-30`), with the pin as the downstream-most point (station 0). The frontend mirrors agree (`lib/corridor-zones.ts:17-26`, `lib/corridor-map.ts:113-117`, `lib/centerline.ts:3-4`).

Result: on every one-way road the geographic corridor is laid against traffic. The advance warning is drawn and scanned *downstream* of the work. Behaviour-changing, and it currently produces wrong output on every geographic surface: the picker overlay, the scan bbox (the true upstream approach is covered only by the 152.4 m end pad), the scan's zone labels (`classify_distance`, `corridor.py:681-750`), the 250 ft relevance window, the page-2 aerial, and the near-intersection near/far-side call (`lib/road-detection/cross-street.ts:106-123`). The plan's schematic, device counts, quote and crew sheet are unaffected: they use the work-relative layout frame (`src/generation/layout.py:186-189`), with no lat/lng.

Violates P21 (the model matches the mental model): the field says one thing and the math does the opposite. Violates P12 (polish is trust): a corridor drawn backwards is the first thing a reviewer sees.

## Reproduction

1. Prod `/sandbox` at `6fe391e`, 1440 × 1000. Pick on map → "Or enter coordinates manually" → 39.73370, −104.98753 (N Broadway at 11th Ave).
2. The candidate reads "NORTH BROADWAY SOUTHBOUND (PRIMARY, 180°)" (way 131232822, `oneway=yes`). Pick it; the direction field reads 180. Save & Close → Shoulder work → Confirm → CHANGE → Edit on map.
3. Expected: the advance warning north of the pin, upstream for southbound traffic. Actual: work, then taper, then **advance warning furthest south, near W 8th Ave**.
4. Same at 39.74020, −104.95600 (E Colfax, "EAST COLFAX AVENUE WESTBOUND (PRIMARY, 270°)"): the advance warning is drawn west, past York St.

Evidence: `validation-artifacts/committed/issue-290-pin-work/probes/overlay-broadway-2-corridor.png`, `overlay-colfax-2-corridor.png`, `stations.json` (the first sign 1,600 ft along the sent bearing).

## Impact

- The estimator and the TCS see a site-conditions block whose zones ("intersection in advance warning") describe the wrong side of the work, on exactly the roads (downtown one-way couplets) where those conditions matter most.
- On two-way roads the vertex order is arbitrary, so the same inversion happens on about half of pins unless the operator flips.
- Silent. No surface discloses which way the corridor was laid relative to traffic.

## Proposed solution

Not an interim flip. Any flip changes what every recorded pin means, and #290 lands a version field before anything re-reads a pin (Rule 10). The structural fix is #290's model: the pin marks the work start; direction is derived on the backend from the confirmed road plus the occupied side, with the `oneway` tag honoured; the typed direction field retires (FLOW.md §5a). Fixed when #290's visible ship lands.

## Acceptance

- At the Broadway and Colfax pins above, the advance warning renders upstream of the work for the road's legal direction, on the picker and on PDF page 2.
- A scan at a one-way pin classifies a feature upstream of the work as advance warning / transition, never as downstream or outside.
- Saved plans and fixtures recorded before the fix render with their direction unconfirmed, never silently re-read.

## Reference

- `src/rules/corridor.py:22-30, 281-289, 681-750`; `src/api/site_scan.py:655-702`; `src/rendering/plan_sheet.py:4011-4073`
- `conestruct/site/app/api/road-bearing/route.ts:406`; `components/LocationPickerModal.tsx:2922-3001`; `lib/road-detection/cross-street.ts:106-123`
- `validation-artifacts/committed/issue-290-pin-work/checkpoint.md` §0; FLOW.md §5a; DESIGN-PRINCIPLES P21
- Priority-high. Fixed by #290's visible ship; not separately hot-fixed, by ruling.
```
