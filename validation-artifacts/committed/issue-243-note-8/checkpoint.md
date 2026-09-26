# issue-243-note-8 — checkpoint (written before Ryan rules)

**Issue:** #243 — the CDOT S-630-1 Sheet 2 Note 8 check ("Signs on both sides of divided highway")
fails a correct plan when the site adjustments add their one-side sidewalk and bike signs.
**Arc:** s2-arc37, investigate only: probes and read-only runs, no product code.
**Base:** `0ddc85e` = `main` = the prod backend `healthz` sha = the served `/sandbox` bundle sha,
checked 2026-09-26 (`rulings.md`).
**Evidence:** `probes/` (every number below is printed by a committed probe; the file names are given
where each number is used).

## The answer, in brief

1. **What Note 8 governs** (quoted in §1): "All warning and regulatory signs", on divided highways,
   multi-lane ramps and one-way streets, "except where only one shoulder is closed (ex: Case 11 on
   Sheet 7)". It names no sign series and says nothing about pedestrian or bicycle signs.
2. **The sidewalk sign is inside the note's literal words; the bike sign is not.** R9-9 SIDEWALK
   CLOSED is a regulatory sign (MUTCD 11th Ed. Chapter 6G, §6G.10). M4-9a is a guide sign
   (Chapter 6I, §6I.02). So "count only the governed families", read literally, drops the M4-9a but
   still counts the R9-9, and N Broadway SB still fails (6 left, 8 right). Passing Broadway needs a
   **reading**, which would be marked CHOSEN: R9-9 is posted "at the beginning of the closed
   sidewalk" (§6G.10 ¶02), for pedestrians, not "on both sides of the roadway" for traffic.
3. **The note's own exception covers every plan the check fires on in prod today.** Prod enables
   three kinds (shoulder, flagger, near-intersection; `probes/lane-closure-probe.txt`). Flagger and
   near-intersection are always undivided. So every "Required: True" row in prod is a **shoulder
   closure**, and Note 8 exempts a closure of one shoulder. The check never reads the exception.
4. **Measured on prod and replayed:**
   - Broadway fails at **6 left, 8 right**. The gap is 2 × R9-9 on the right.
   - The Denver demo pin fails at **6 left, 10 right**: 2 × R9-9 plus 2 × M4-9a.
   - The E-470 control passes at **12 left, 12 right**.
   - Without the adjustments, all three pass with equal sides.
5. **Recommendation, argued in §5:**
   - **Option (a′):** count the warning and regulatory signs, and leave out the pedestrian-facility
     signs (R9-8 to R9-11a) as a recorded reading. The M4-9a is already outside the literal families.
   - **Option (d)**, the exception, is its own question (h), with my recommendation to rule it in as
     a second commit.
   - **The negative case still fails under (a′)** on every kind: a plan missing its left W20-1 on
     Broadway, E-470, or a lane closure on a divided road.
   - **Under (d)**, a shoulder plan missing its left W20-1 passes. That is what Note 8 says, and it
     contradicts the brief's premise for shoulder plans. Hence a separate ruling.

---

## 1. Note 8, verbatim

**Source:** `validation-artifacts/s630-1-2026.pdf` in the main checkout (not tracked in git). PDF p. 150, extracted with
`pdftotext -layout` on 2026-09-26. Title block: *"Colorado Department of Transportation · Traffic
Controls for Highway Construction · Standard Plan No. S-630-1 · Issued by the Traffic Safety &
Engineering Services: July 01, 2026 · Standard Sheet No. 2 of 26"*, under the heading *"General
Notes"*.

> 8. All warning and regulatory signs shall be posted on both sides of the roadway on divided
> highways, multi-lane ramps, one-way streets, and as directed by the Engineer, except where only
> one shoulder is closed (ex: Case 11 on Sheet 7).

This matches the quote already in the code (`src/rules/tables.py:292-296`) and the arc12 citation
record (`validation-artifacts/committed/arc12-citation-tail/arc12-citations.md:46`). It is the same
note by subject, so there is no new citation.

**The exception's example.** Sheet 7 is PDF p. 155, *"Standard Sheet No. 7 of 26"*. Its Case 11
is *"Typical Application · Shoulder Work - Freeway/Expressway"*: W20-1 or W21-5, R2-10, G20-5P /
R2-1(XX), G20-5P / R2-6P, two W21-5aR "RIGHT SHOULDER CLOSED" with W16-2a and W7-3a(X), W5-1,
R2-11 and R2-1(XX).

The drawing cannot show the exception by itself. I rendered the sheet (2026-09-26) and looked:
Case 10, a four-lane **divided** highway where Note 8 does require both sides, is also drawn with
one row of signs along one edge. The typicals draw one side and leave the other side to Note 8. So
the single-side reading of Case 11 rests on **Note 8's words** ("except where only one shoulder is
closed (ex: Case 11 on Sheet 7)"), not on the drawing.

**The sign families, by MUTCD 11th Ed. (Dec 2023) Part 6 chapter**
(`validation-artifacts/ta10_flagger/mutcd_part6.pdf`, printed pages):

| Sign in our plans | Chapter | Where | Inside "warning and regulatory"? |
|---|---|---|---|
| W-series (W20-1, W20-2, W21-5aR, W5-1, W16-2a, W7-3a …) | 6H TTC Zone Warning Signs | 6H.01 ff. | yes |
| G20-1, G20-2, G20-4 | 6H | §6H.35–6H.37, p. 810 | yes (warning chapter) |
| WORK ZONE plaque (CDOT "G20-5p", Sheet 2 Note 4; MUTCD G20-5aP) | 6G (Figure 6G-1) | §6G.08 Work Zone and Higher Fines Signs and Plaques, p. 795 | yes |
| R2 series (R2-1, R2-6P, R2-10, R2-11) | 6G TTC Zone Regulatory Signs | 6G | yes |
| **R9-9 SIDEWALK CLOSED** (also R9-8, R9-10, R9-11, R9-11a) | **6G** | **§6G.10, p. 797** | **yes, by chapter.** ¶02: *"The SIDEWALK CLOSED (R9-9) sign should be installed at the beginning of the closed sidewalk, at the intersections preceding the closed sidewalk, and elsewhere along the closed sidewalk as needed."* |
| **M4-9a Pedestrian/Bicyclist Detour** | **6I TTC Zone Guide Signs** | **§6I.02 ¶10, p. 812** | **no.** *"The Pedestrian/Bicyclist Detour (M4-9a) sign … should be used where a pedestrian/bicyclist detour route has been established because of the closing of a pedestrian/bicycle facility to through traffic."* |
| S1-1 school advance warning (the school-zone adjustment) | Part 7 (school warning) | — | yes (a warning sign) |

**Answer to checkpoint question (a).** Note 8 governs every warning and regulatory sign, which is
every sign family our plans emit except the Chapter 6I guide signs (the M4 detour series). It says
nothing about pedestrian or bicycle signs by name. The pedestrian sign (R9-9) is regulatory by
chapter. Excluding it rests on its own placement rule (§6G.10 ¶02: at the sidewalk) against the
note's "posted on both sides of the roadway". That is a reading, marked CHOSEN, and not in the text.

---

## 2. The checker today

**There are two checkers, and they do not see the same plan.**

| | The audit row | The layout validator |
|---|---|---|
| Where | `src/api/audit.py:856-874` | `src/rules/validators.py:909-962` `validate_co_signs_both_sides` |
| Runs on | the **adjusted** placements. `_placements_for` (`render_api.py:766`) applies the site adjustments, then `build_audit_trail` (`render_api.py:1634`) | the **raw generator** output. `validate_layout` at `render_api.py:720-722` runs **before** the adjustments; the comment at `:715-717` says so |
| What it counts | every `DeviceType.SIGN_GENERIC` in `mainline_placements` (`audit.py:229`, `approach_id == "mainline"`), with no label or series filter. `DETOUR_MARKER` is not counted | each off-centre sign (`is_sign`), which needs a same-label mirror on the other side within `CO_BOTH_SIDES_STATION_TOLERANCE_FT = 50.0` (`validators.py:51`; its comment gives no source) |
| Left / right | the sign of `offset_ft`: `< 0` left, `> 0` right. Offsets are relative to the travel direction (`validators.py:140-163`), not geography | the same, via `offset_ft` product `< 0` |
| Pass | `sign_left == sign_right and sign_left > 0` if `params.is_divided`, else always true (`audit.py:866`) | no error per sign. An error raises HTTP 500 `internal_layout_validation_failed` (`render_api.py:723-734`) |
| Reads the exception? | **no** | **no** |
| Reaches the operator | yes (§6) | only as a 500. It never feeds the audit, `plan_flags` or the PDF |

**Where `is_divided` comes from.** It is a request field:
- **Shoulder:** `is_divided = scenario.divided` (`schemas.py:1182`).
- **Always true:** lane-closure-divided (`:1235`) and mobile multilane (`:1301`).
- **Always false:** flagger (`:1208`), near-intersection (`:1328`) and mobile 2-lane (`:1278`).
- **Work beyond shoulder:** true for `rural_divided` or `freeway` (`:1246`).
- **The site's detection** sets it (`conestruct/site/lib/road-detection/classify.ts:97-172`):
  motorway, trunk, and **primary with `oneway`** are divided.
- **So a one-way street reaches Note 8 as "divided"**, which is right for Note 8, since the note
  names one-way streets.

**Re-read under #290's work-start model.**
- **Pin and corridor:** the pin marks the work start. The corridor is built from the confirmed road
  and the occupied side (`meta.pinModel = "work_start"`, `meta.work.{side, travel}`). The proxy adds
  `meta.centerline` and `meta.roadDirection` (`conestruct/site/lib/scenarios/centerline-relay.ts:16-36`).
- **No effect on the count:** all of this places the corridor on the map. It does not change the
  generator's station/offset frame, which is all the check reads.
- **Measured:** the Broadway replay in the work-start model gives the same lists as prod
  (`probes/note8-probe.txt`). Nothing in #290 changes what the check counts or how it assigns a
  side.

**The right-hand-only side rule, and #300.** #300 (open) is about left-side work on one-way streets:
mirror the layout, and offer both curbs.
- **It does not change which option to choose.** (a′), (b) and (d) do not depend on the side.
- **But #300 inherits one thing:** the adjustments hard-code R9-9 at `+_ped_offset` and M4-9a at
  `+sign_offset` (`site_adjustments.py:170-173`, `:193-198`), always on the right. A left-side-work
  plan would put its sidewalk signs on the wrong side. Under today's count that shows as a mirrored
  asymmetry; under (a′) or (b) it is invisible to Note 8. #300 has to mirror the adjustments too.

**Answer to question (b).**
- **The rule today:** on a road flagged divided, the audit row requires equal, non-zero counts of
  every sign on the mainline, adjustments included. The validator requires a per-label mirror of
  every generator sign, and it never sees the adjustments.
- **#290's work-start model** changes nothing here.
- **The right-hand-only rule** changes nothing about the check. It does leave the adjustment signs
  hard-coded on the right, which #300 must mirror.

---

## 3. What the site adjustments add

`src/rules/site_adjustments.py`. `apply_site_adjustments` (`:239-288`) appends each adjustment's
devices **after** the generator's list. `limited_sight_distance` is the one adjustment that changes
existing devices: it moves them and adds nothing.

| Flag | Signs added | Other devices | Station | Offset (side) |
|---|---|---|---|---|
| `pedestrian_facility` (`:155-183`) | 2 × `SIGN_GENERIC` **R9-9** (`:170-173`) | 4 × Type III barricade, mirrored (`:164-169`) | `work_zone_length_ft` and `0` | R9-9 **`+_ped_offset`, right only** (`= lanes × lane width + shoulder + 2`, `:41-42`). Broadway **+54.0 ft**; I-25 +48.0 ft |
| `bicycle_facility` (`:186-208`) | 2 × `SIGN_GENERIC` **M4-9a** (`:193-198`) | — | `work_zone_length_ft` and `0` | **`+(lanes × lane width + 4)`, right only**. Denver pin **+46.0 ft** |
| `school_zone` (`:284`) | 2 × `SIGN_GENERIC` **S1-1** (`:223-226`) | — | farthest advance sign + 500 | **± the same, mirrored** |
| `limited_sight_distance` (`:261`) | none. Moves advance signs' `station_ft × 1.5` (`:52-57`) | — | — | unchanged |
| `adjacent_intersection`, `adjacent_interchange`, `driveways_present` | none (retired or advisory) | — | — | — |
| Night (`night_adjustments.py`) | none (lights only) | Type C lights, one light plant | — | — |

**Origin tag: none.**
- `DevicePlacement` (`validators.py:140-163`) is `device_type, station_ft, offset_ft, label, approach_id`.
- There is no origin, source or notes field. Adjustment devices keep `approach_id = "mainline"`.
- The adjustment record (`{"flag", "action", "devices_added", "rule"}`) is a separate list, not
  linked to the devices.
- **No generator emits an R9-, R9-11 or M4- sign** (grep of `src/generation/layout.py`). Today, the
  facility signs and the signs an adjustment adds are the same set.

---

## 4. Measured: the per-side sign lists

**The runs:**
- `probes/note8-sweep.cjs` drove prod `/sandbox` (1440 px, headless) for each pin: the picker, the
  first road candidate, Save, **shoulder**, Confirm, the first built side, Generate. It saved the
  exact `/api/render/audit` request and response, and the page's text (`probes/prod/`).
- `probes/note8_probe.py` then posted each request to prod twice (with the site scan, as the site
  sends it, and without it) and replayed both in-process at this checkout. The replay runs
  `render_api._placements_for`, with the real Overpass scan and the proxy's centerline relay.
- **Every replayed count equals prod's** (`probes/note8-probe.txt`).

**The corridors:**
- **N Broadway SB**, 39.73370, −104.98753. Way 131232822, primary, `oneway=yes`, 30 mph, 4 lanes,
  `urban_arterial`, `divided: true`, side right. This is the site's own request.
- **The Denver demo pin**, 39.7269, −104.9873. The site's picker resolves it to North Broadway
  (way 132915888), primary, `oneway=yes`, 30 mph, 4 lanes, divided, side right. This is the site's
  own request.
- **The control: E-470 southbound**, 39.8281935, −104.7472008, in open land in Adams County. Way
  8388109, motorway, `oneway=yes`, 75 mph (OSM); freeway, 2 × 12 ft. The request is built from the
  Broadway request with prod's road candidate, and posted directly rather than driven through
  `/sandbox`, because the sweep does not set lane width or lane count
  (`probes/e470-control-request.json`).
- **I-25 South Valley Hwy** (39.68539, −104.96427) was tried as the control first. The scan **finds
  a sidewalk there**, so it is kept as an observation (below), not the control. Prod also declines
  it at the default 10.5 ft lane ("Lane width 10.5 ft is below the 11 ft minimum for freeway work
  zones", `probes/prod/i25-declined-*`), and refuses its OSM 4 lanes at 12 ft ("58.0 ft exceeds the
  plan sheet's drawable half-road (52 ft)"). It was measured at 3 × 12 ft.

Lists are ordered upstream to downstream, in `label@station ft` form.

| Corridor | Adjustments | Left | Right | Prod row today |
|---|---|---|---|---|
| **Broadway**, with adjustments | adjacent_intersection, **pedestrian_facility** | **6**: W20-1@1,550, W20-2@1,450, W21-5aR@1,350, G20-1@1,100, G20-5P@500, G20-2@−150 | **8**: the same six + **R9-9@1,000, R9-9@0** | ✗ `Required: True. Signs placed: 6 left, 8 right.` |
| Broadway, without | — | 6 (as above) | 6 (as above) | ✓ `… 6 left, 6 right.` |
| **Denver pin**, with adjustments | adjacent_intersection, adjacent_interchange, **pedestrian_facility, bicycle_facility** | **6** (as Broadway) | **10**: the six + **R9-9@1,000, M4-9a@1,000, R9-9@0, M4-9a@0** | ✗ `Required: True. Signs placed: 6 left, 10 right.` |
| Denver pin, without | — | 6 | 6 | ✓ `… 6 left, 6 right.` |
| **E-470 (control)**, with adjustments | adjacent_interchange (no sidewalk, no bike) | **12**: W20-1@7,210, W20-2@4,570, W21-5aR@3,070, W16-2a@3,070, W21-5aR@2,820, W7-3a@2,820, W5-1@2,570, G20-1@1,100, G20-5P@833, G20-5P@500, G20-5P@167, G20-2@−150 | **12**: the same | ✓ `… 12 left, 12 right.` |
| E-470, without | — | 12 | 12 | ✓ `… 12 left, 12 right.` |
| *I-25 (observation)*, with adjustments | adjacent_intersection, adjacent_interchange, **pedestrian_facility** | 12 | 14: the 12 + R9-9@1,000, R9-9@0 | ✗ `… 12 left, 14 right.` |

**What prod shows at Broadway today** (`probes/prod/broadway-page.txt`):
- The strip: `VERIFIED · 2 PLAN FLAGS` · `REVIEW FLAGS`.
- NEEDS YOU **2**, `changed the plan, or waiting on your word · 1 changed this plan · 1 needs
  attention`.
- The rows: ▲ `Pedestrian sidewalks present · changed this plan · 6 devices added`, then
  ⚠ `Signs on both sides of divided highway · needs attention · Required: True. Signs placed: 6 left,
  8 right. · CDOT S-630-1 (July 2026) Sheet 2, General Note 8`.
- The audit card: `14 checks`. Checked & passed **14**.

**At the Denver pin:** `VERIFIED · 3 PLAN FLAGS`, NEEDS YOU **3** (sidewalk, bike lane, Note 8),
`13 checks`.

**Answer to question (c):** see the table. In every measured failure, the whole gap is the
right-only R9-9 and M4-9a the adjustments add. Without the adjustments every corridor passes with
equal sides, and the control passes both ways.

---

## 5. The options

**Definitions:**
- **(a) Literal families:** count only warning and regulatory signs, i.e. drop the Chapter 6I guide
  signs (M4-9a).
- **(a′)** is (a), plus leave out the pedestrian-facility signs (R9-8, R9-9, R9-10, R9-11, R9-11a),
  on the §6G.10 placement reading (CHOSEN).
- **(b)** Leave out the signs an adjustment added, by origin tag.
- **(c)** Both (a′) and (b).
- **(d)** Honour the note's exception: a shoulder closure is not required.

Scored by `probes/note8_probe.py` (the adjusted plans) and its negative-case block:

| Option | Files touched | Broadway (6/8 today) | Denver pin (6/10) | E-470 control (12/12) | **Negative:** left W20-1 removed, Broadway / E-470 / lane closure divided (Case 10, 65 mph) | + ped & bike adjustments on the negative |
|---|---|---|---|---|---|---|
| today | — | ✗ 6/8 | ✗ 6/10 | ✓ | ✗ 5/6 · ✗ 11/12 · ✗ 6/7 | ✗ |
| **(a)** literal families | `audit.py:856-866` (a filter); `tables.py` (the family set, cited) | **✗ 6/8** (R9-9 is regulatory) | ✗ 6/8 | ✓ | ✗ · ✗ · ✗ | ✗ |
| **(a′)** families, less the pedestrian-facility signs | as (a), plus the R9 facility set, cited §6G.10 / §6I.02 | ✓ 6/6 | ✓ 6/6 | ✓ | **✗ 5/6 · ✗ 11/12 · ✗ 6/7** | ✗ 5/6 · ✗ 11/12 · ✗ 6/7 |
| **(b)** origin tag | `validators.py:140-163` (a new `DevicePlacement` field, internal only); `site_adjustments.py` (set it on every added device); `audit.py` (the filter) | ✓ 6/6 | ✓ 6/6 | ✓ | ✗ · ✗ · ✗ | ✗ |
| **(c)** (a′) and (b) | both | ✓ | ✓ | ✓ | ✗ · ✗ · ✗ | ✗ |
| **(d)** the exception only | `audit.py:866` (and the detail string) | ✓ (not required) | ✓ (not required) | ✓ (not required) | **✓ · ✓** (shoulder, not required) · ✗ 6/7 (Case 10) | ✓ · ✓ · ✗ 6/11 |
| (d)+(a′) | both | ✓ | ✓ | ✓ | ✓ · ✓ · ✗ 6/7 | ✓ · ✓ · ✗ 6/7 |

**The negative case:**
- The fixtures are the generator's own plans, built by `scenario_to_call` then the generator, with
  the left W20-1 removed:
  - Broadway at station 1,550;
  - E-470 at 7,210;
  - `lane_closure_divided`, 65 mph `rural_divided`, at 3,925.
- **Under (a′), (b) and (c) all three fail, with or without the adjustments on top.**
- The validator also reports it on each: `CO_SIGN_BOTH_SIDES: Sign 'W20-1' … has no mirror sign on
  the opposite side`.
- **Under (d), the two shoulder plans pass.** That is Note 8's text. Only the Case 10 plan still
  fails, and prod does not enable that kind (`probes/lane-closure-probe.txt`: "This scenario type
  is not yet available. Currently supported: flagger_lane_closure, near_intersection, shoulder").

**Recommendation: (a′).** From the quote:
- **The note's subject is a sign family,** "All warning and regulatory signs". Who placed a sign is
  not in it, so (b)'s origin tag answers a question the note does not ask.
- **(b) can be wrong both ways.**
  - It would exempt a governed sign an adjustment adds: S1-1 is a warning sign, mirrored today, so
    there is no measured difference, but the exemption would be wrong in principle.
  - It would count a facility sign a generator emits. None does today; #300 or a sidewalk kind might.
- **(b) needs a new field** on a frozen dataclass for no measured difference from (a′), and (c)
  adds that same field on top of (a′).
- **Literal (a) is what the words say,** but it does not fix #243. The sidewalk sign is regulatory,
  and Broadway stays at 6/8.
- **(a′) keeps the note whole** for every sign addressed to traffic on the roadway. It leaves out
  only the signs MUTCD places at the pedestrian facility (§6G.10 ¶02). The M4-9a is outside the note
  already (§6I.02, a guide sign).
- **(a′) fails the negative case on every kind.**
- **The R9 reading is a choice, not a quote** (Rule 12). It is recorded as CHOSEN in `tables.py`
  beside the note, with both MUTCD citations.

---

## 6. What the operator sees: every surface the result reaches

| Surface | Code | The exact string today (Broadway) | After (a′) | After (d) |
|---|---|---|---|---|
| The audit row (wire) | `src/api/audit.py:866-874` | `{"pass": false, "label": "Signs on both sides of divided highway", "citation": "CDOT S-630-1 (July 2026) Sheet 2, General Note 8", "detail": "Required: True. Signs placed: 6 left, 8 right."}` | `pass: true`; the detail per question (e) | `pass: true`; a not-required detail |
| `colorado.all_pass` / `fail_count` | `audit.py:1017`, `:1021` | `false` / `1` | `true` / `0` | `true` / `0` |
| `plan_flags.compliance_fails` / `is_clean` | `audit.py:2146-2154` | `1` / `false` | `0` / `false` (the v1 limitation stays) | same as (a′) |
| **Verdict strip** | `conestruct/site/components/StatusBar.tsx:483-490` (flags); `:439-446` (clean) | `VERIFIED · {total} plan flag{s}` + pill `REVIEW FLAGS`; the page reads `VERIFIED · 2 PLAN FLAGS` | `VERIFIED · 1 plan flag` + `REVIEW FLAGS` (Denver: 3 → 2) | same as (a′) |
| **NEEDS YOU ⚠ row** | `lib/needs-you-items.ts:128-138` (the item); `lib/needs-you.ts:80-83` (`itemProvenance`); `components/NeedsYou.tsx:93-133` | ⚠ `Signs on both sides of divided highway` / `needs attention · Required: True. Signs placed: 6 left, 8 right.` / `CDOT S-630-1 (July 2026) Sheet 2, General Note 8` | the row is gone | gone |
| NEEDS YOU header | `NeedsYou.tsx:95-103` | count `2`; `changed the plan, or waiting on your word · 1 changed this plan · 1 needs attention` | count `1`; `… · 1 changed this plan` (Denver 3 → 2) | same |
| The ledger / counts | `lib/tiering.ts:215-223` (fact `audit:colorado:check:0`), `:357-363` (`ledgerLine`); `GeneratorShell.tsx:1323-1331`; `OutputCards.tsx:239-242`; `ResultsDisclosures.tsx:83-129` | the audit card `14 checks`; `Checked & passed 14` | `15 checks`; `Checked & passed 15` (Denver 13 → 14) | same |
| Reference disclosure | `TieredReference.tsx:425-432`, `AuditTrail.tsx:1527-1575` (`CheckRow`) | under `⚠ Needs attention`: ✕ **Signs on both sides of divided highway** — `Required: True. Signs placed: 6 left, 8 right.` | moves to `✓ Checked & passed` with the new detail | same |
| **Audit PDF compliance section** | `src/rendering/audit_blocks.py:213-240` | heading `Colorado Requirements (CDOT S-630-1)`; row `Signs on both sides of divided highway \| FAIL \| CDOT S-630-1 (July 2026) Sheet 2, General Note 8 \| Required: True. Signs placed: 6 left, 8 right.`; footer `All Colorado checks pass: False` | `PASS`, the new detail; `… pass: True` | same |
| **Audit PDF cover ledger** | `audit_blocks.py:93` (`Plan status`), `:652-656`; `tier_ledger.py:79-81`, `:173-182` (`ledger_line`, byte-identical to `ledgerLine`) | `N changes · A needs attention · C checked · P pending · reference` | A − 1, C + 1 | same |
| Legacy Streamlit | `src/api/app.py:564-569` | `❌ **Signs on both sides of divided highway** (…) — …` | follows the dict | follows |

**No `.sys-event` string mentions this check or any compliance count.** The greps cover
`GeneratorShell.tsx:2082`, `JurisdictionSection.tsx`, `NeedsYouConditions.tsx:311`,
`SiteNotChecked.tsx:47` and `bands/HandoffNotes.tsx` (#198 families 1–6). **#198 byte-identity:
no existing `.sys-event` string changes.**

---

## 7. Principles (the surfaces change: the NEEDS YOU row, the strip, the PDF compliance section)

| Principle | Applies | How |
|---|---|---|
| P2 One voice per fact | **yes** | Today the ⚠ row says the plan breaks Note 8 while the plan sheet shows a correct plan, so two voices disagree. Under (a′), if the row prints only the counted signs ("6 right") while the plan sheet draws 8 on the right, a new disagreement appears. Question (e) resolves it by printing what was left out. |
| P9 Every state has a symbol and a word | yes | The ⚠ glyph and "needs attention" leave with the row. The pass state in Reference keeps ✓ and "Checked & passed". No new glyph. |
| P12 Polish is trust | **yes** (Ryan's 2026-09-08 comment) | A ✕ on a correct plan lowers trust in every other row. Removing the false fail is this principle's fix. |
| P14 Empty states show the shape | no | — |
| P17 A named person, a named job | yes | The estimator deciding whether the plan is ready. A false "needs attention" sends them to chase a non-issue (#243 Impact). |
| P19 The default view is the 80% case | yes | NEEDS YOU drops to the real items (the sidewalk row). The passed check sits in the labelled "Checked & passed" count. |
| P21 The model matches the mental model | yes | A crew closing the curb lane on a one-way street doesn't post sidewalk signs on the median side. (a′) and (d) make the check agree. |
| P1, P4, P6 (layout) | measured | The row leaves NEEDS YOU, so the NEEDS YOU block gets shorter after a Generate. That is not a shift during a state, because the result renders once per Generate. The live check records the rects anyway. |
| P3, P5, P7, P8, P10, P11, P13, P15, P16, P18, P20, P22 | no | No control, wait state, target or layout change. |

---

## 8. Checkpoint questions (surfaced, not decided)

**(a) Note 8 and its families.** See §1. **Recommendation:** adopt the chapter mapping in §1 as the
recorded definition of "warning and regulatory".

**(b) The checker, and what #290 and the right-hand-only rule change.** See §2. #290 changes
nothing. #300 must mirror the adjustment signs.

**(c) The measured counts.** See §4.

**(d) The options.** See §5. **Recommendation: (a′)**, argued from the quote. The negative case
fails on every kind.

**(e) What to print, on pass and on fail.** Today the detail prints both counts on pass and on fail.
- **Silent on pass** (count only, no note): under (a′), Broadway would print `6 left, 6 right`
  beside a plan sheet with 8 signs on the right. That is two voices for the right-side count
  (P2 / Rule 10: an exclusion nobody is told about is a silent substitution).
- **Recommendation:** print what was counted and what was left out, on pass and fail, and only when
  something was left out. Otherwise the string stays byte-identical, so 86 of the 93 recorded audits
  keep today's words. Proposed copy, CHOSEN, for your edit:
  - Broadway: `Required: True. Signs counted: 6 left, 6 right. Not counted: 2 R9-9 (sidewalk signs, posted at the sidewalk).`
  - Denver: `Required: True. Signs counted: 6 left, 6 right. Not counted: 2 R9-9, 2 M4-9a (sidewalk and bike-lane signs, posted at the facility).`
  - E-470 and every plan without them: `Required: True. Signs placed: 12 left, 12 right.` (unchanged)
- **The brief's example ("advance warning: 3 left · 3 right") would count too little.** Note 8
  governs every warning and regulatory sign, not only the advance series. Printing 3/3 would also
  hide the G20 and R2 signs the note covers.
- **Rows where the note does not apply** (undivided and flagger, e.g. `Required: False. Signs
  placed: 0 left, 8 right.`): **recommend no change in this arc**, with the family filter applied
  only when required. Their words then stay byte-identical, and the `control-lakewood` /
  `adv-ni-denver` rows don't churn. If (h) is ruled in, the "not required" wording is designed once
  for both.

**(f) Rule 5 churn, predicted.** See §9.

**(g) The commit sequence.** See §10.

**(h) An added question: Note 8's exception.** The note exempts "only one shoulder is closed (ex:
Case 11 on Sheet 7)". Every Note-8-required plan in prod is a shoulder closure, and the check never
reads the exception.
- **What goes wrong today:** the row prints `Required: True` on plans Note 8 does not cover. That
  is a false statement on the surface (Rule 10), before #243's counts come into it.
- **Related citation finding:** `generate_shoulder_closure_divided` mirrors every sign "per S-630-1
  Sheet 2 General Note 8" (`src/generation/layout.py:224-226, 257, 290, 386, 449, 470, 495`). But
  Case 11, the typical it models, is Note 8's single-side example.
  - **This is a misattribution by subject.** The mirroring is more than Note 8's minimum (allowed:
    Note 28, "the typical cases … reflect the minimum requirements"), not a requirement of it.
  - **If confirmed, the citation counter goes 19 → 20.**
  - `plan_sheet.py:2507` (the median note) should be read the same way.
- **The trade-off:** under (d), a shoulder plan missing its left W20-1 **passes**. That is the note,
  but it contradicts the brief's "keep it failing a plan that is genuinely missing a left-side
  advance sign" for shoulder plans.
- **Recommendation:** rule (d) in as a second commit, after (a′).
  - The check then reads the whole sentence: the exception decides whether the note applies, and
    the families decide what it counts.
  - The generator keeps mirroring, since the plans don't change.
  - The layout comments are re-cited to "beyond the Note 8 minimum; house choice (CHOSEN)".
- **Alternative:** file (d) as its own issue and ship (a′) alone. (a′) fixes #243 either way.

---

## 9. Rule 5 churn, predicted (`probes/churn-predict.txt`, 93 recorded audits scanned; 5 non-audit files skipped)

| Item | (a′) with (e) as recommended | (d), on top |
|---|---|---|
| **Note 8 flips, FAIL → PASS** | **7**: `tests/fixtures/tiering/scanned-lakewood`, `-not-checked`, `-dismissed`, `-asserted`; `tests/snapshots/corpus/grid_site_pedestrian_facility`, `grid_site_bicycle_facility`; `conestruct/site/components/__fixtures__/audit-shoulder-full.json` | 0 more |
| Note 8 detail text changes | **7** (the same). `control-lakewood` and `adv-ni-denver` stay byte-identical under (e)'s not-required rule. Without that rule: 9 | **+53**: every divided shoulder row's "Required: True" wording (13 in `tests/snapshots/*.json`, 40 in `corpus/grid_*`) |
| **Expectation JSON** (`tests/fixtures/tiering/tiering-expectations.json`; the TS and Python mirrors both read this one file, so they move together) | the 4 flipping fixtures: `facts["audit:colorado:check:0"]` `attention → checked` (single leaf each); the derived `ledger` attention − 1, checked + 1. **New ledgers:** scanned-lakewood `{2,4,13,2}`, scanned-not-checked `{1,4,10,1}`, scanned-dismissed `{1,4,14,3}`, scanned-asserted `{3,4,12,3}` | none more |
| The recorded fixtures' `audit` (the same 4, plus the site fixture) | `checks[0].pass`, `checks[0].detail`, `colorado.all_pass` → true, `fail_count` → 0, `plan_flags.compliance_fails` → 0; `is_clean` → **true** for `scanned-not-checked` only (its only flag was Note 8) | detail only |
| Corpus snapshots (`tests/corpus/test_grid.py:24`, in-process `/render/audit` equality) | 2: the same leaves; `is_clean` → **true** for both | +40 detail |
| `tests/snapshots/*.json` (16, `test_audit_endpoint.py` baselines) | **0** (no pedestrian or bike rows) | detail on the shoulder ones |
| Tests in the Note 8 area | `test_rules.py:676, 768, 798, 1585, 1610` (the validator): **unchanged**. `test_engine_removal_pr_b.py:143, 156`: unchanged, since 0/0 still fails under (a′). `test_citation_single_source.py:149`: unchanged (label and citation). `test_tier_ledger.py:229-246` (PDF cover = expectation ledger): moves with the JSON. **New:** the negative case per kind; the three measured corridors' filtered counts; the chapter family set | `test_engine_removal_pr_b.py:156`: likely still passes (the empty plan also fails the G20-5P check, so `fail_count >= 1` holds), but its comment goes stale |
| Site tests | `tiering.test.ts`, `TieredReference.fixtures/.scan-rows/.corrections/.site-scan/.signposts`, `AuditTrail.ni-parity` read the fixtures and move with them; `NeedsYou`, `StatusBar`, `needs-you-items` tests are synthetic: **unchanged** | same |
| Site snapshots | none exist | none |
| **PDF containment** (`test_pdf_containment.py`, `pdf_worst_case/*.json`, 12 fixtures) | the Detail cell grows by ≈ 60–90 chars on the rows with a "Not counted" note. The column has weight 3 of 7. **Must run, real API, all fixtures; expected 0** | the not-required wording |
| **NEEDS YOU / strip on the demo corridors** | Broadway: NEEDS YOU **2 → 1**, strip `2 → 1 plan flag`, `14 → 15 checks`. Denver: **3 → 2**, `3 → 2 plan flags`, `13 → 14 checks`. E-470: none | none more |
| Axe baselines | none exist (axe runs only in live-check scripts, with no baseline file) | none |
| `.sys-event` / #198 | none | none |
| Wire | **no request payload changes** (senders: `GeneratorShell.tsx:472, 530, 650, 1084`; `OutputCards.tsx:351`; `QuotePanel.tsx:250, 276`; `lib/render-proxy.ts`). The response keeps its shape; only the values of `pass` / `detail` / the counts change | same |

---

## 10. Commit sequence (backend-first, each commit shippable)

1. **`feat(#243)`: Note 8 counts the signs it governs.**
   - **Backend:** `tables.py` gets the chapter family set and the pedestrian-facility set, cited
     (§6G.10 / §6I.02), with the R9 reading CHOSEN beside the Note 8 quote. `audit.py:856-874` gets
     the filter, applied when required, and the (e) detail. The validator gets the same filter
     (no measured change: it never sees the adjustments).
   - **Data:** the 7 recorded audits and `tiering-expectations.json` are re-recorded in one commit.
   - **Tests:** the negative case per kind, and the measured corridors.
   - **What the operator sees after it ships:** on Broadway and the Denver pin, the ⚠ "Signs on both
     sides of divided highway" row leaves NEEDS YOU. The strip counts one flag fewer. The row
     appears under Checked & passed, saying which sidewalk and bike signs it did not count.
2. **`feat(#243)`: Note 8's own exception** *(only if (h) is ruled in)*.
   - **Change:** a shoulder closure reads as not required. The layout's "per Note 8" mirror comments
     are re-cited as beyond the minimum (CHOSEN), and the citation counter moves.
   - **What the operator sees after it ships:** on every shoulder plan on a divided road or one-way
     street, the row reads "not required: one shoulder closed (Note 8's Case 11 exception)", where it
     read "Required: True". Nothing moves in NEEDS YOU.
3. **`evidence(#243)`: the prod sweep of the shipped change.**
   - **Run:** `probes/note8-sweep.cjs` on Broadway, the Denver pin and E-470, plus the replay.
   - **Records:** NEEDS YOU, the strip and the PDF compliance row.
   - **What the operator sees:** nothing (evidence only).

No site code changes in any commit. The site renders the wire's `pass` and `detail` as they arrive
(Rule 3).

---

## 11. Contract verification plan

| Contract | How it is checked |
|---|---|
| Rules 3 / 10 / 12 | Every number the check prints is a count of real placements. The family sets are cited to MUTCD chapters. The R9 reading is marked CHOSEN in `tables.py`. The "Not counted" note makes the exclusion visible (Rule 10). No frontend computation. |
| Expectation-JSON pin | Before the diff, the churn table above names the 7 flipping records. After the diff, `churn_predict.py`'s prediction is compared with the actual leaves. Single-leaf changes in `facts`; the ledgers follow. The two mirrors (TS and Python) read the one JSON, so both suites run. |
| PDF containment | `test_pdf_containment.py` on all 12 `pdf_worst_case` fixtures through the real API, every run. Expected 0 overflows. |
| #198 byte-identity | A grep of the `.sys-event` containers before and after. Expected no change. |
| Citation counter 19 | Verified by subject: Note 8 is already cited (`tables.py:321`), and the text is re-read off Sheet 2 above. New citations: §6G.10 p. 797 and §6I.02 ¶10 p. 812, both verified by subject against the Part 6 PDF. **Counter 19 stays for commit 1.** Commit 2 would record the layout misattribution (→ 20) if ruled. |
| Backend-first | Commit 1 is backend plus recorded data. The site has no code change. |
| Payload senders | The senders listed in §9 are unchanged. No wire change. |
| `getByText` | Any new site assertion uses direct text nodes. None is planned. |
| Line endings | The repo's files are LF (these `.md` files and the probes). Re-recorded JSON keeps each file's current endings. |
| Prod verification | After the ship: `note8-sweep.cjs` on the three corridors (headless), healthz sha = the shipped sha. |

---

## Findings noted, not changed

1. **The scan finds a sidewalk along urban I-25** (39.68539, −104.96427), and the adjustment then
   adds sidewalk-closed signs to a freeway shoulder plan (`probes/note8-probe.txt`, i25-urban). That
   is #224's scan scope, not #243.
2. **Prod declines the default 10.5 ft lane on a freeway pin** and refuses OSM's 4 lanes at 12 ft,
   so an I-25 plan needs the operator to type the lane width and lane count. This is correct
   behaviour, recorded because it shaped the control.
3. **The adjustment signs are hard-coded to the right** (`+offset`). #300 inherits this (§2).
4. **The layout validator's 50 ft mirror tolerance** (`validators.py:51`) has no source comment
   (Rule 12). It is out of this arc's scope.

## Evidence index

- `probes/note8-sweep.cjs`: the prod `/sandbox` sweep. `probes/prod/`: per pin, `*-audit-request.json`,
  `*-audit-response.json`, `*-page.txt`, `*-page.png`, `*-log.txt`; `i25-declined-*` is the declined
  freeway pin.
- `probes/note8_probe.py` → `probes/note8-probe.txt`: prod and replay, per-side lists, options,
  negative case. `probes/e470-control-request.json`, `probes/i25-urban-request.json`: the built
  bodies.
- `probes/lane_closure_probe.py` → `probes/lane-closure-probe.txt`: the enabled kinds in prod.
- `probes/churn_predict.py` → `probes/churn-predict.txt`: the churn scan.
- `probes/sheet7_case10.png`, `probes/sheet7_case11.png`: S-630-1 Sheet 7 (PDF p. 155) rendered at 160 dpi
  with PyMuPDF; both typicals draw one edge (§1).
