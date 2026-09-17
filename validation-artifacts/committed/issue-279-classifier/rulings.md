# issue-279-classifier — the rulings this arc is built under

**Ruled by Ryan, 2026-09-16**, in chat, adopting the checkpoint's finding on the cause.
Quoted verbatim below. This file is the arc's authority: every commit on this branch cites
it. Filed as this arc's **first** commit, per the per-arc rulings convention.

**Issue:** #279 — "Classifier returns 'Rural — undivided' for a primary arterial in
central Denver — isUrban resolves false on a way that is plainly urban". **Phase:** 0
(#287). **Priority:** high.

---

## The ruling, verbatim

> #279 (classifier): adopt your recommendation on the cause; the fix follows the rule it
> exposes. If the route isn't fetching the tags the predicate needs, fetch them — that's a
> missing input, not a threshold change. If the predicate is wrong, every constant in it
> gets traced or CHOSEN before it moves. Either way: the classification marks itself
> `inferred` wherever it guessed (#274's producer), a genuinely rural fixture stays rural,
> and the rate is measured before and after on the same named sample of reference pins.
> Rule 3 question to answer in the arc: a predicate over detected facts belongs to the
> backend — say whether this arc moves it there or leaves it in classify.ts with the
> reason. rulings.md first commit. Build, verify, stop with the ship line.

---

# ⚠ THE DIAGNOSIS BELOW WAS FALSIFIED — 2026-09-17

**Read this before the next section.** The cause recorded below is **wrong**, and the
measurement the ruling itself demanded is what proved it wrong. It is kept verbatim,
because an authority file that quietly deletes its mistakes is not an authority.

The ruling asked for "the rate ... measured before and after on the same named sample of
reference pins". Measured 2026-09-17 (`rate/`, one fetch per pin with both predicates
evaluated over that single payload):

| pin | expect | before | after | place classes within 3 km |
|---|---|---|---|---|
| **e-bayaud** | urban | **false** | **false** | `{village: 1}` |
| denver-demo | urban | true | true | `{neighbourhood: 19, city: 1}` |
| lakewood | urban | true | true | `{city: 1}` |
| rural-control-us40-east | rural | false | false | `{}` |

**Pins whose verdict changed: none.** #279's own pin still classifies rural after the fix.

A direct query at E Bayaud says why:

```
=== radius 3000 m: 3 place nodes ===
   1256 m  place=village    Glendale
   2200 m  place=locality   Hale
   2218 m  place=locality   Congress Park
  nearest city/town: NONE in range

=== radius 8000 m ===
   3056 m  place=neighbourhood  Alamo Placita     <- 56 m outside the radius
   4661 m  place=city           Denver
```

**There was never an urban-class node inside the radius for a nearer one to mask.**
`before=false` and `after=false` are both *correct* given those inputs.

**The real cause is `PLACE_RADIUS_M = 3000`** — the nearest neighbourhood misses the
boundary by 56 m and Denver's city node sits at 4,661 m — **plus Denver tagging real
neighbourhoods as `place=locality`** (Hale, Congress Park, Montclair, East Colfax), a
class the predicate does not accept at all.

**What the masking finding still is:** a genuine code defect. The predicate did not do what
its own comment said, and closest-wins masks an urban node behind a nearer non-urban one
wherever both are in range. The unit tests prove that mechanism fires. **It is not the
cause of #279's symptom and does not close #279.** It ships on its own merits, under its
own issue, never claiming this one.

**What happens next:** the real fix is its own checkpoint, with a sample larger than four
and three candidates measured before any recommendation — see "The real fix" at the end of
this file.

---

## The cause, as the checkpoint found it — FALSIFIED, see above

`isUrban` is not computed in `classify.ts` at all — it is a **parameter**. Its producer is
`conestruct/site/app/api/road-bearing/route.ts`, and it has **two independent defects**,
either of which alone produces #279's symptom.

**Defect 1 — the query fetches classes the predicate rejects.** The Overpass query filters
place nodes to **six** classes:

```
node(around:3000,…)["place"~"^(city|town|suburb|neighbourhood|village|hamlet)$"];
```

`URBAN_PLACE_CLASSES` contains **four**: city, town, suburb, neighbourhood. `village` and
`hamlet` are fetched and can never satisfy the predicate, so their only possible effect is
a false negative.

**Defect 2 — closest-wins, where the code's own comment says any-match.**
`pickClosestPlace` returns the closest node carrying *any* `place` tag; the predicate then
tests **only that one**:

```ts
const place = pickClosestPlace(elements, lat, lng);
const isUrban = place !== null && URBAN_PLACE_CLASSES.has(place.tags?.place ?? "");
```

A nearer `village` or `hamlet` therefore **masks a `place=city` further out**. The
function's own comment says the opposite:

> The presence of **any** urban-class place within PLACE_RADIUS_M means `isUrban=true` for
> classification purposes; we additionally surface the closest place's name for display.

**The code does not implement its documented intent.** In central Denver, within the 3 km
radius, a single non-urban place node closer than Denver's city node flips an OSM
`primary` to "Rural — undivided" — exactly the E Bayaud symptom on the issue.

**Which branch of the ruling this is:** the predicate is wrong, not the input. The route
*is* fetching place tags. So the ruling's second clause governs — **every constant in the
predicate gets traced or CHOSEN before it moves.**

## The Rule 3 question, answered

> a predicate over detected facts belongs to the backend — say whether this arc moves it
> there or leaves it in classify.ts with the reason.

**This arc leaves it where it is. Four reasons, and one condition.**

1. **It is not browser math.** The defect is in
   `app/api/road-bearing/route.ts` — a Next **server** route. The Overpass fetch and the
   `isUrban` derivation already run server-side. `classify.ts`'s
   `classifyFromCandidate` runs in the browser, but it only maps facts already derived
   (highway class, oneway, isUrban) onto a label.
2. **Nothing is duplicated.** Rule 3 targets "parallel frontend computation of values the
   backend should own" — the corridor-spacing failure mode. There is no backend
   OSM-tags→roadType classifier to be parallel *to*. `_map_road_type` in
   `render_api.py` maps a roadType the request already carries onto an internal category;
   it does not derive one from tags.
3. **It is a suggestion, not an answer.** The classification is offered, the operator
   confirms it, and only then does it ride the scenario. **suggest-never-set** is the rule
   that governs it; Rule 3 governs the MUTCD math the backend does *with* the confirmed
   value, which is untouched here.
4. **Moving it now would pre-empt a phase.** #281 puts the proposed-kind producer and the
   scan's bbox in **Phase 3**, backend-first. Relocating this derivation into Modal is
   that work, not this fix, and doing it here would build the seam twice.

**The condition, recorded so it is not forgotten:** when Phase 3 builds the proposed-kind
producer backend-side, this derivation should move with it. A backend producer that
proposes a kind from detected facts, beside a Next route that classifies the road from the
same facts, would be **two producers for one question** — the thing Rule 3 exists to
prevent. This arc fixes the predicate where it lives and marks the destination.

## Acceptance, from the ruling

- The predicate is corrected, and **every constant in it is traced or marked CHOSEN**
  before it moves.
- The classification **marks itself `inferred` wherever it guessed** (#274's producer).
- **A genuinely rural fixture stays rural.**
- **The rate is measured before and after on the same named sample of reference pins.**

---

## The real fix — its own checkpoint (ruled 2026-09-17)

> (c) The real fix is its own checkpoint. Measure before recommending, against a sample
> larger than four: add every reference pin in memory.md plus at least four genuinely rural
> controls, so a change that flips a rural pin urban is caught. Three candidates to
> measure: widen the radius (state what it would trace to — "far enough for one pin" is not
> a trace); admit place=locality (measure the rural false-positive rate it introduces); and
> the one worth taking seriously — whether the road's own tags (highway class, lanes,
> sidewalk, maxspeed, lit) decide urbanity better than nearby place nodes. Report the
> per-pin verdicts for each candidate on the whole sample.

### The 3,000 m constant is CHOSEN-by-inheritance, not traced

> One note on the 3,000 m trace: it traces to a retired system (the Mapbox tilequery
> radius). That is a trace to a decision someone made for a different tool, so it is
> CHOSEN-by-inheritance, not traced. Say so in the checkpoint; it lowers the bar for moving
> it, but only to a measured value.

`PLACE_RADIUS_M = 3000`'s comment reads "matches the Mapbox-tilequery `place_label` radius
that the previous /api/road-classify used (3000 m)". That endpoint is retired. So the
value's provenance is *another tool's* choice, inherited when this route replaced it —
which is a lineage, not a justification. Nothing measured it against this predicate, on
these pins, for this question.

**Consequence for the checkpoint:** moving it does not require overturning a traced value,
because there is no trace to overturn. It requires a **measured** one. "Far enough to catch
Denver from Bayaud" is fitting a constant to a single pin — the way the next wrong number
gets made — and is not acceptable as a justification.

### What the checkpoint must report

Per-pin verdicts for **each** candidate across the **whole** sample, not a summary rate:

- **A — widen the radius.** State what any proposed value traces to, or mark it CHOSEN with
  its reasoning. Report which rural controls it flips.
- **B — admit `place=locality`.** Denver uses it for real neighbourhoods (Hale, Congress
  Park, Montclair, East Colfax). OSM also uses it for uninhabited named places, so the
  rural false-positive rate it introduces is the number that decides it.
- **C — read the road's own tags** (highway class, lanes, sidewalk, maxspeed, lit) instead
  of nearby place nodes. The one worth taking seriously: it asks what the road *is* rather
  than what is near it, and the tags already arrive on the candidate the operator picks.

A candidate that flips a genuinely rural pin urban fails, however well it does on the urban
ones — which is why the sample needs the four-plus rural controls.
