# s2-arc36 checkpoint — #301 piece 1: the aerial on the WHERE band

**Base:** `eed4c29` = `main` = the prod `healthz` sha (checked 2026-09-25). **Branch:**
`issue-301-band-aerial`. **Authority:** `rulings.md` (committed first, next to this file): #301's
body, ruling 189, #290's pre-side ruling. Nothing below is built. The only code on this branch is
probes (`probes/`), and every number quoted here is one of their outputs.

## Plain English

**The picture moves to the band.** After #290 the band records the side, but the drawing that
proves the direction is only in the picker modal. This arc puts a read-only picture of the
laid-out corridor on the band, under the move ledger, drawn by the backend from the same
producer as the picker and PDF page 2.

**Recommendation for the image:** #301's option (a), a static image. It costs:
- about 1.1 s for a warm request;
- 94–206 KiB per image;
- no new client bundle (option (b) would add 474 KB gzip to every located page).

**The investigation also found a real defect in the one producer, reachable today.** With a
work-zone speed reduction at 65→60 or 75→65 mph, the plan builds a 570 or 650 ft buffer, and the
band's rows say so. But the picker and page 2 draw 645 or 820 ft, because `build_corridor` never
receives the work-zone speed. Putting a picture on the band, next to rows that say 570, would put
that contradiction on one screen. So the fix is commit 1, backend-first.

---

## (a) The producer map, and the agreement test

### What each consumer reads today

| Consumer | Builds its corridor with | Lays out approaches with | Draws / states | Lengths from |
|---|---|---|---|---|
| **Picker** (modal) | `render_api.py:1192` `build_corridor(**corridor_kwargs)`; kwargs at `:1181-1190` | `corridor_layout.approach_corridors` (`:1199`) | backend `parts` → GeoJSON (`lib/corridor-geometry.ts:123-200`, lat/lng swap + bbox only); `ZONE_COLOR`, `4 + widthRank` px, 0.35 / 0.9 opacity (`LocationPickerModal.tsx:1182-1292`) | `approaches[].zones[].length_ft` = `round(b − a, 1)` from `zone_spans` (`render_api.py:1234-1250`) → CORRIDOR EXTENT `ExtentRows` (`LocationPickerModal.tsx:3024+`) |
| **Page 2** (PDF) | `plan_sheet.py:4251-4272` `build_corridor(…, downstream_taper_ft=placed…)` | `corridor_layout.approach_corridors` (`:4286-4302`) | `_aerial_laid_out_overlays` (`:3643-3679`): `zone_spans` + `zone_parts`, `_LAID_OUT_ZONE_COLOR`, `1 + rank` px, 0.35 / 0.9; `_fetch_mapbox_aerial` (`:3682-3757`), `auto` + padding 60, URL guard 8,000 | the drawn spans; the CORRIDOR DETAILS box |
| **Band** (today) | none: no picture | none | text only | audit `sections.corridor_spec` (`audit.py:1489-1495`, whole feet) via `GeneratorShell.tsx:1562-1564`, only when `checksArmed` |

**The approaches and the zone walk come from one producer.** The picker and page 2 both call
`src/rules/corridor_layout.py` (`approach_corridors` `:117-147`, `zone_spans` `:65-79`,
`zone_parts` `:90-107`). The frontend computes no coordinate: it swaps lat/lng and takes a bbox.
There is one display-word mirror, `boundWord` (`lib/corridor-geometry.ts:102-105`), which re-quantizes
the backend's `cardinal`.

**But the primary corridor is built twice, from two hand-written kwarg lists** (`render_api.py:1181-1190`
and `plan_sheet.py:4251-4272`). Neither list carries everything the plan's generator uses:

| Input | Generator / audit | Geometry endpoint | Page 2 |
|---|---|---|---|
| `work_zone_speed_mph` → buffer | passed (`layout.py:205-207`, `audit.py:413`) | **not passed**: `build_corridor` has no such parameter (`corridor.py:892`) | **not passed** |
| downstream taper | placed cone run (`placed_downstream_taper_ft`, `corridor.py:1149-1170`) | §6B.08 floor (`corridor.py:893-896`) | placed run (`:4266`, `:4301`) |

**Measured** (`probes/lengths_agree.py` → `probes/lengths-agree.txt`): the picker, page 2 and the band
were compared on the two prod-captured fixtures and eight variants, every zone and both approaches,
rounded to whole feet.
- **Two rows disagree, and both are the buffer:**

  | Case | Picker, page 2 | Band's row (what the plan builds) |
  |---|---|---|
  | Broadway, 65 mph with work-zone 60 | 645 | 570 |
  | Broadway, 75 mph with work-zone 65 | 820 | 650 |

  These are the CDOT Cases 26/27 step-downs (`spacing.py:174-182`). The UI can set one: the
  "Work-zone speed limit" field (`PlanDetails.tsx`).
- **Every other row agrees**, including 45 mph with work-zone 35 and flagger 55 with work-zone 45.
  In those cases the step-down doesn't apply and the placed downstream taper equals the 50 ft floor.
- **Classification:** wrong output on the picker and page 2, narrow (65 or 75 mph with exactly
  that reduction; never a flagger plan, whose speed the schema caps at 55), and the same class as #298: the drawing disagrees with the plan. The downstream
  split is latent, with no disagreement found.

### What the band must read so it cannot drift

The band's picture is **bytes the backend drew from the scenario**. It never sees a coordinate
(Rule 3), so it cannot drift on its own. What can drift is the backend's two kwarg lists. So:

1. **One call builds every laid-out corridor:** `corridor_layout.laid_out(params, *, placements=None)
   → (primary, approaches)`. It takes every input the generator takes, `work_zone_speed_mph`
   included, and uses the placed downstream run when placements exist, the floor when not. The
   geometry endpoint, page 2 and the new image endpoint all call it. There is no kwarg list to fork.
2. **One overlay builder:** `_aerial_laid_out_overlays` and its constants move out of `plan_sheet.py`
   into a shared module (`src/rendering/static_aerial.py`). Page 2 and the band image both call it.
   Page 2's output stays byte-identical, and a test pins that.

**The agreement test (#301's acceptance).** `tests/test_corridor_agreement.py`, on the two
prod-captured requests promoted to `tests/fixtures/corridor/broadway-sb.json` and
`lafayette-flagger.json`. For each fixture it asserts:
- the geometry endpoint's `parts` points equal the parts page 2 draws, point for point;
- the band image endpoint's Mapbox overlay string is **byte-identical** to page 2's;
- the geometry's zone lengths equal the audit's `corridor_spec`, the band's rows (primary approach);
- plus the 65→60 variant, which fails on `main` today and passes after commit 1.

A second small test pins `ZONE_COLOR` in TypeScript equal to `_LAID_OUT_ZONE_COLOR` in Python. No
such test exists today (they agree by hand).

---

## (b) The image: option (a), static. Measured.

### (a) A static image

**Recommended shape: scenario in, PNG out, drawn on the backend.** Page 2's overlay builder is Python
and page 2 already holds a server-side Mapbox token on Modal (`MAPBOX_TOKEN`, `plan_sheet.py:4231`),
so the route is:
- **the backend:** `POST /render/corridor-map`, taking `{scenario, stage, width, height}`. It calls
  `laid_out` and the shared overlay builder, fetches Mapbox, and returns `image/png`;
- **the site:** a thin binary proxy at `app/api/corridor-map/route.ts`, the existing
  `renderScenarioToResponse` pattern (`lib/render-proxy.ts:96-151`), with the rate limit, 32 KB
  cap and `isScenario` check of the geometry route.

This departs from #301's wording, which says "the page-2 overlay builder moved to a shared module"
behind a Next route. That builder can't move to TypeScript without a second copy of the overlay
(Rule 3, P2). So it moves to a shared Python module, and the Next route proxies.

**Measured** (`probes/static_cost.py`, `probes/geometry_latency.py`):

| | Broadway SB (5 paths) | Lafayette flagger (11 paths) |
|---|---|---|
| Encoded overlay | 282 chars | 538 chars |
| Whole URL, token excluded | 368 chars | 624 chars |
| Mapbox limit | 8,192 | 8,192 |
| Page-2 guard | 8,000 (thinning never triggered) | 8,000 (thinning never triggered) |
| Mapbox fetch, 600×250@2x | 407 ms median (cold 832) | 411 ms (cold 1,612) |
| Mapbox fetch, 348×220@2x | 405 ms (cold 725) | 391 ms (cold 608) |
| PNG size, 600×250@2x / 348×220@2x | 180 / 94 KiB | 206 / 94 KiB |
| Prod geometry read today (the band already sends it) | 761 ms median (cold 3,103) | 632 ms median |

- **Latency:** about 1.1–1.2 s warm per image (a geometry-sized build plus about 400 ms of Mapbox).
  A cold Modal container adds about 2.5 s, the same as the geometry read the band already waits on.
- **Cache:**
  - **Mapbox:** it caches identical URLs at its CDN. Observed `max-age=43200, s-maxage=43200` and
    "Hit from cloudfront" on the second and third runs. Its docs give 12 h, and `s-maxage=604800`
    for satellite styles.
  - **The browser:** a POST isn't cached, so the band keeps an in-memory map from request body to
    object URL. Re-opening WHERE, or toggling back to the same answer, doesn't refetch.
  - **Modal:** no cache.
- **Token:** server-side only. Modal's `MAPBOX_TOKEN` is already there for page 2. The URL never
  reaches the browser, only the PNG bytes. The band's picture doesn't need
  `NEXT_PUBLIC_MAPBOX_TOKEN`, so it also works where the manual fallback shows (no public token).
- **Money:** Static Images is free to 50,000 requests a month, then $1.00 per 1,000. The rate
  limit is 1,250 requests a minute (docs.mapbox.com, mapbox.com/pricing, fetched 2026-09-25).
  A plan session requests about 3–6 images (pin, work, laid out, a length edit or two), debounced
  like the geometry read (300 ms).
- **Attribution:** "© Mapbox © OpenStreetMap" and the logo are drawn in the image. The docs
  require them.

### (b) A small mapbox-gl view

| Cost | Measured / cited |
|---|---|
| Bundle | mapbox-gl 3.23.1: **1.78 MB raw, 474 KB gzip** JS, plus 5.5 KB gzip CSS. Today it loads only when the modal opens (dynamic `import("mapbox-gl")`, `LocationPickerModal.tsx:1126`). On the band it loads on every located sandbox view. |
| Billing | a GL map load is counted "every time Mapbox GL JS initializes"; free to 50,000 a month, then **$5.00 per 1,000**. The band unmounts on collapse, so every WHERE re-open is a new load. |
| Map state pulled onto the band | the layer definitions are inline in the 3,085-line modal (`:1182-1292`, the sources, the labels layer, the marker rotation). They would have to be extracted before the band could share them; that is piece 3's work, not piece 1's. |
| 380 | a second WebGL context beside the modal's. Touch gestures fight the page scroll unless `interactive: false`, and then it's a static picture at 474 KB. |

**Recommendation: (a), confirming #301.** It is the cheaper image by every measure and needs no
client token. The picture is a read, and (b)'s interactivity is the modal's job (ruling 189: the
decision work stays in the modal).

---

## (c) The band's states, and where the image sits

**Where it sits:** directly under `MoveLedgerRows` (`WhereBand.tsx:515-522`) and above
`SideControl` (`:528`), so the side question sits right under the picture it changes.
- **Size:** full column width, at rule 104's S2 height of **300 px** and rule 172's **250 px at
  380**.
- **Request size:** the measured column width, rounded down to a 40 px bucket so Mapbox's cache
  hits. `auto` framing then fits the whole corridor inside the box with no crop.
- **Layout:** the frame is sized before the image arrives, so nothing moves when it does (P1).
- **Nothing is replaced:** the band has no image today (`WhereBand.tsx:10-38` records the
  deviation, and that comment is rewritten).

| State | What the band shows |
|---|---|
| No pin | No aerial. The find row is the question, and there's nothing to picture (P14: the ledger shows the shape). |
| Pin, side owed (`side_not_confirmed`) | The satellite image at the pin, at a backend-chosen zoom, with the pin (rule 107) and nothing directional. Centre hint (rule 106): "Say which side is occupied to lay out the work". No legend. (#290's pre-side ruling, P16, Rule 10.) |
| Side chosen, kind not confirmed | **The work segment only** (the work-zone channel) and the pin. Legend: one swatch row, "Work zone", and one line of words, "Approaches lay out after you confirm the kind" (the ledger's grow subline). Nothing upstream is drawn (rule 112). |
| Both answered (`laid_out`) | The whole corridor, the five channels and the pin. Legend: five rows. On a flagger job, page 2's sentence: "Two approaches: northbound (the work's side) and southbound". |
| Pin moved or road changed | The side is dropped (as today: the picker keeps `work` only at an unchanged pin and road, `LocationPickerModal.tsx:596-618`). The old image is removed at once, never left up stale (Rule 10), and the frame shows "Drawing the corridor…" (P8) until the pin-only image arrives. |
| Refused (`corridor_unbuildable`, `no_bearing`) | No overlay. The backend's reason, in the picker's own words: "Can't lay the corridor out here — {reason}" (`refusalReason`, `lib/corridor-geometry.ts:110-114`). The band reads the status from the geometry answer it already has (`WhereBand.tsx:377`) and asks for the image only when it's `laid_out`. |
| Image fetch failed | Words, no picture: "The aerial didn't load — the corridor is laid out; Edit on map shows it." (Rule 10: an absence renders as an absence.) |
| Stale road | No image. The stale-road warning (`:493-498`) is the band's answer. |
| Pre-change plan (`corridor_end`) | `withPinModel` (`lib/scenarios/index.ts:640-665`) converts it on load: the pin is kept, `work` is dropped, `pinModelFrom: "corridor_end"` is set. So it shows the **side-owed** row above (pin only), plus the existing warning "saved before the pin marked the work start…" (`:502-511`). Nothing from the old model is drawn. |
| In flight (the write lock) | The image stays, marked `data-read`. It is not a control and is never disabled. |
| S3, WHERE collapsed | **Not in piece 1.** Rule 104's 104 px strip can't use this framing. Measured in `probes/strip_104.py`: at 600×104, Mapbox refuses padding 60 with a 422 ("The padding cannot exceed the height or width of the requested image"). At padding 10, the north–south Broadway corridor is a sliver about 80 px tall beside the logo (`probes/broadway-strip-600x104-pad10.png`). The strip needs a backend-computed rotated view (centre, zoom, bearing), which is its own piece. |

**Two rulings are needed inside (c):**
1. **Before the kind.** Rule 112 asks for a dotted "not yet laid out" channel, but a static path
   can't dash, and an upstream channel of any kind is directional before the kind has set its
   length. I recommend words in the legend, no drawn channel.
2. **The legend's position.** Rule 109 puts it bottom-right over the map. `auto` framing can put the
   corridor anywhere in the frame, and a 5-row legend over it hides a channel. I recommend it
   **under** the image at every width. That is rule 172's 380 option, used everywhere (P11).

**Colour (a contract point to rule on).** Part 2's rules 110 and 12 name `#f4c020`, `#ff8a2e`,
`#e0a63c`, `#3fd3a8` and `#7e8da1`, with dashes. The picker and page 2 draw `ZONE_COLOR`
(`FFD166`, `F3722C`, `FF7A00`, `1EC8A5`, `8A8A8A`) with width ranks. It is registered as the
corridor's "palette source" (`lib/design/ink-exceptions.ts`), and `#3fd3a8` and `#e0a63c` appear on
no surface.
- **Recommendation:** the band uses `ZONE_COLOR`, so all three surfaces match (P11). The image's
  pixels come from the backend's mirror, and the HTML legend swatches read `ZONE_COLOR` from
  `lib/corridor-zones.ts`. **No new hex literal anywhere** (the ink census stays green).
- **What it leaves open:** moving all three surfaces to rule 110's palette is its own issue. Doing it
  on the band alone would make the band disagree with the picker it sits next to.

---

## (d) Piece 2: in, small, with the audit as the speaker

**The brief's premise needs correcting.** The band's rows (the audit's `corridor_spec`) and the
modal's CORRIDOR EXTENT (`/render/corridor-geometry`) do **not** agree by construction. They share
rule primitives (`buffer_space`, `advance_warning_spacing`, the taper formulas) but not the call:
- **Buffer:** differs on the work-zone speed. Measured to disagree (a).
- **Downstream:** placed run vs floor. Latent.
- **Taper:** the audit's own `L_required` branches vs `_resolve_taper_ft`.
- **Road type:** the audit filters through `_TABLE_6B_1_CATEGORIES`; the geometry passes it raw.
- **Rounding:** whole feet vs 0.1 ft.

They agree today on every case except the two buffer rows. That is agreement by coincidence, not
construction.

**The speaker should be the band's rows, which read the audit.** They state what the plan
**built** (`placed_downstream_taper_ft`, the work-zone speed, #257), and every other surface
prints that too.
- **The geometry's lengths:** after commit 1 they come from the same inputs (`laid_out`), and the
  agreement test pins them equal.
- **The modal:** its per-zone `ExtentRows` (`LocationPickerModal.tsx:3024-3084`) are removed. The
  panel keeps its status line and the Centerline coverage row. Coverage is the modal's decision
  work (is the road mapped far enough?), and no other surface states it.

**Size:** one frontend commit, about −90 lines plus RULE 5 churn in the modal's extent tests. The
backend half is commit 1, which piece 1 needs anyway. **In.**

---

## (e) `lib/corridor-map.ts`: delete

- **It is dead:** its only importers are `lib/corridor-polyline.ts`'s `buildCorridorPolyline`
  (itself imported only by `corridor-polyline.coverage.test.ts`) and `lib/corridor-zones.test.ts`.
  The route it names doesn't exist.
- **It can't be (a)'s client:** it computes lengths (`zoneLengthFt`, `:49-62`) and builds the URL in
  the browser's language with a token path, which is the frontend corridor math Rule 3 retired.
- **What goes with it:** `lib/centerline.ts` (191 lines; its only importers are `corridor-map.ts`,
  `corridor-polyline.ts` and its own test) and `buildCorridorPolyline`. About 600 lines in total.
- **What stays:** `corridor-polyline.ts` keeps its zone re-exports and types, which the modal and
  `corridor-geometry.ts` import. Checkpoint row 26 said "delete it rather than migrate it"; this
  confirms it.

---

## (f) 380

- **Frame:** `width: 100%` of the band column, height **250 px** (rule 172; rule 104's "S1 at
  380"). S5's 220 px is the results stack's, not the band's.
- **Request:** the measured column width, bucketed, so the image is drawn at the size it is shown.
  No `object-fit` crop cuts off a corridor end, and nothing is wider than the column: no horizontal
  scroll.
- **Legend:** under the image in a two-column grid (5 rows → 3 lines). Rule 172: "the legend drops
  to two rows or moves under the map."
- **Measured:** the Lafayette flagger at 348×220@2x shows both approaches readably
  (`probes/lafayette-348x220.png`).
- **The framing padding:** 30 px at 380, where the probe used 30 at 348 px, and 60 at desktop
  (page 2's figure). CHOSEN, marked as such in the code.

---

## (g) Commit sequence

Each ship ends with a prod check against `healthz` and a Playwright pass at 1440 and 380.

| # | Commit | Ship: what becomes visible |
|---|---|---|
| 0 | `rulings.md` (done, `4b6fb1b`); this `checkpoint.md` + `probes/` | none |
| 1 | **backend**: `corridor_layout.laid_out(params, placements=None)`. `build_corridor` gains `work_zone_speed_mph`. The geometry endpoint and page 2 call `laid_out`. Tests: the 65→60 / 75→65 buffer rows. | **Ship A (backend)**: at 65→60 or 75→65 mph, the picker and page 2 draw the 570 / 650 ft buffer the plan builds (was 645 / 820). Nothing else changes; page 2 stays byte-identical on the fixtures. |
| 2 | **backend**: the overlay builder moves to `src/rendering/static_aerial.py`; `POST /render/corridor-map` (the PNG; stages `pin` / `work` / `laid_out`); the fixtures are promoted; the three-way agreement test; the `ZONE_COLOR` TS = Py pin | in Ship A; visible: none (a route nothing calls yet) |
| 3 | **site**: `app/api/corridor-map/route.ts` (binary proxy); `useCorridorAerial` (debounced, memoized). Payload senders enumerated: one new sender, this hook. | **Ship B (site)**, with 4–6 |
| 4 | **site**: `components/bands/BandAerial.tsx` under the ledger; the states of (c); the legend; 380; `data-read`. WhereBand's deviation comment is rewritten. Tests: mounted states, write lock, type census, ink census. | Ship B: **the band shows the picture.** Pin only before the side; the work after it; the whole corridor after the kind; the backend's reason when refused. No modal is needed to see the answer. |
| 5 | **site**: piece 2, the modal's per-zone extent rows removed | Ship B: the modal's CORRIDOR EXTENT shows status and coverage; the lengths are on the band only |
| 6 | **site**: delete `corridor-map.ts`, `centerline.ts`, `buildCorridorPolyline` and their tests | Ship B: none |
| 7 | evidence: the prod sweep of every band-aerial state at 1440 and 380 | none |

The backend goes first (Ship A before Ship B), because commit 3's proxy calls a backend route that
must already be served.

---

## (h) Principles table

Surfaces and their FLOW step:
- **W**, the WHERE band aerial (new). FLOW step 1, "Is this the right spot?" (`FLOW.md:30`). The
  estimator and the rep (`FLOW.md:8-14`).
- **M**, the picker modal. Step 1, the same users.
- **P**, PDF page 2. Step 5, "What do I hand over?" (`FLOW.md:34`). Read by the TCS and crew.

| P | Name | Surface · step · user | How this arc honours it |
|---|---|---|---|
| P1 | Nothing moves that the user did not ask to move | W · 1 · estimator, rep | The frame is sized before the image arrives. Swapping the image never shifts the side control below it. There is no auto-scroll. |
| P2 | One voice per fact | W, M · 1 · estimator, rep; P · 5 · TCS | One layout call (`laid_out`) and one overlay builder for W and P. The corridor lengths have one speaker, the band's rows (piece 2); the modal's copies go. |
| P3 | The next thing to do is visible without being told | W · 1 · estimator, rep | Pre-side, the centre hint names the missing answer. The side control sits right under the picture. |
| P4 | Edges, not eyeballing | W · 1 | The frame spans the column edge to edge. The legend is on the ledger's grid, under the image. |
| P5 | Hierarchy by weight and colour, not by size alone | W · 1 | The legend uses Part 2's type roles (mono 9.5 px, rule 109). The type census stays green. |
| P6 | Content never dictates layout | W · 1 | Fixed frame heights (300 / 250). A two-approach job and a one-approach job take the same box. |
| P7 | Reversible before irreversible | n/a | The picture is a read; it writes nothing. |
| P8 | Wait states are honest, visible, and non-blocking | W · 1 | "Drawing the corridor…" in the sized frame. The side control and kind chips stay live meanwhile. |
| P9 | Every state has a symbol and a word | W · 1 | Every channel has a word in the legend (rule 111). Refusal and failure are sentences, not a grey box. |
| P10 | Targets are sized for the hand that uses them | W · 1 | The image isn't a target, so the arc adds no target. The existing controls are unchanged. |
| P11 | Consistency is a rule | W, M, P | The same channels, colours (`ZONE_COLOR`), widths and fade on all three. The flagger sentence matches page 2's. |
| P12 | Polish is trust | W · 1 | Mapbox attribution is kept. The image is @2x at the drawn size, with no upscaling blur. |
| P13 | Show the simple thing first | W · 1 | One picture and a legend. Pan, zoom and candidates stay in the modal (ruling 189). |
| P14 | Empty states show the shape of the answer | W · 1 | No pin: no frame (the ledger shows the shape). Pin: the frame with the hint. |
| P15 | Every operator action can be undone | n/a | No action. |
| P16 | Don't: loading skeletons, placeholder numbers, fake progress | W · 1 | Nothing directional before the side; nothing upstream before the kind; no skeleton or striped placeholder (rule 14). A failed image says so. |
| P17 | Every screen is for a named person doing a named job | W · 1 | The estimator and the rep confirming the side and the kind. |
| P18 | One question per step, one primary action | W · 1 | The picture asks nothing. Confirm stays the band's one primary. |
| P19 | The default view is the 80% case | W · 1 | The picture answers "did the side do what I meant?" without opening the modal. |
| P20 | Zones are defined by the user's question | W · 1 | The picture lives in WHERE, the "is this the right spot?" band. |
| P21 | The model matches the mental model | W · 1 | The pin marks the work start. The work draws at the pin and the warning upstream, #298's fix, now visible where the side is chosen. |
| P22 | Revision is a mode, not a reload | W · 1 | A pin or side change re-requests the picture in place; the page isn't reloaded. |

**Contracts:**
- **Rule 3:** the band never computes a coordinate; it shows backend bytes.
- **Rule 10:** refusal and failure are words; nothing stale stays up.
- **P16 and #290's pre-side ruling:** covered in (c).
- **Suggest-never-set:** the picture writes nothing.
- **The write lock:** the image is `data-read`.
- **No new hex literal:** covered in (c).
- **The type census:** runs in commit 4.
- **Payload senders:** one new sender (commit 3). The scenario wire is unchanged.
- **Backend-first:** Ship A before Ship B.

---

## Questions for Ryan's ruling

1. **(b):** option (a) in the scenario-in, PNG-out shape? The builder moves to a shared Python
   module, and the Next route is a proxy.
2. **The buffer defect:** fix it in this arc as commit 1 (recommended), citing #301? Or file it as
   its own issue first, #298-class, and cite that? I can draft the text.
3. **Colour:** `ZONE_COLOR` on the band (recommended, P11)? Rule 110's palette would then be its own
   issue across all three surfaces.
4. **Before the kind:** words in the legend instead of rule 112's dotted channel (recommended)?
5. **The legend:** under the image at every width (recommended), instead of rule 109's bottom-right?
6. **S3's 104 px strip:** out of piece 1 (recommended), as its own piece with a rotated,
   backend-computed view?
7. **Piece 2:** in, with the audit as the speaker (recommended)?
