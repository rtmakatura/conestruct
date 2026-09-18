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
own issue — **#294** — never claiming this one.

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

---

## ⚠ THE (c) RULING WAS WITHDRAWN — 2026-09-17

The second correction this arc has made to its own record. Both are kept.

Ruling (c) originally adopted **candidate C** — the road's own tags as the primary signal —
on the stated grounds that it "is the only candidate on the table that classifies every
urban reference pin urban AND keeps every rural control rural; widening the radius fits a
constant to one pin, and admitting place=locality flips rural pins urban — both measured,
both rejected."

**Those measurements did not exist when that was written.** The checkpoint had not been
run. When it was run (`candidates/`, 2026-09-17, 12 pins, one fetch each serving every
candidate), it inverted the claim:

| candidate | urban 7 | rural 5 | rural controls flipped |
|---|---|---|---|
| current (3 km) | 6/7 | 4/5 | lookout-mountain |
| **A — 5 km** | **7/7** | **4/5** | lookout-mountain |
| A — 8 km | 7/7 | 3/5 | sr71-limon, lookout-mountain |
| **B — +`locality`** | **7/7** | **4/5** | lookout-mountain |
| **C — road tags** | **5/7** | **1/5** | us385-cheyenne, us287-kim, lookout-mountain |

C is the **worst** candidate on this sample, and disqualifying by the ruling's own
criterion — it flips three of five rural controls.

**Ryan withdrew the ruling on being shown the table**, and recorded why it was wrong to
state a result before measuring it. That withdrawal is the ruling now.

### Why C fails, structurally rather than as sample noise

- **`highway=residential` is not an urban signal in a rural county.** US-385 near Cheyenne
  Wells and US-287 near Kim each have a residential way within 50 m — a farm access road —
  and C calls both urban on that alone.
- **A switchback carries an urban speed limit.** Lookout Mountain Rd is `maxspeed=20 mph`,
  slow because of its geometry, not because it is in a city.
- **The signals are absent exactly where they matter.** At E Bayaud the road is
  `highway=primary` with no `sidewalk`, `lit` or `maxspeed`, so C falls through to the
  place tie-break and inherits the failure it was meant to replace. C fell back on 3 of 12
  pins.
- **No road within 50 m on 2 of 12 pins** (thornton, sr71-limon), where C returns no
  verdict at all.

### The new rulings (Ryan, 2026-09-17)

1. **C is not primary.** The failure modes above are structural.
2. **A tiebreaker pass between A-5 km and B before either is built.** First re-pin the two
   rural controls whose coordinates landed on residential side roads, on the named
   highway's centreline, stating how it was verified. Then widen the rural set to **at
   least ten** controls spanning plains, mountain and small-town contexts, verified the
   same way. Measure A-5 km and B per-pin on the whole sample. **Fewer rural flips wins;
   on a tie, A-5 km** — it moves one constant with a measured basis rather than admitting
   a tag class OSM also uses for uninhabited places. Whichever wins, the new value is
   **traced to this sample**, and the old 3,000 m is recorded as CHOSEN-by-inheritance.
3. **Lookout Mountain is its own issue (#291)** — a live misclassification on shipped code, urban
   under every candidate including the current one, because "what is near the road" is the
   wrong question for a switchback with nine place nodes in range. The road-tag signal
   (the `maxspeed` misread aside) is named there as the direction the fix probably needs:
   the thing C got wrong in practice but right in principle. Not this arc.
4. **The masking fix rides along as its own honest commit**, claiming nothing about #279. It
   is filed as **#294**.

---

## Issue numbers, filed 2026-09-17

The drafts this arc produced are no longer drafts:

| issue | what |
|---|---|
| **#291** | Lookout Mountain Rd classifies urban on shipped code, and under every #279 candidate |
| **#294** | isUrban reads only the closest place node, so a nearer non-urban place masks an urban one — the masking defect, built and verified on this branch, claiming nothing about #279 |

Two more came out of #256 and are cited here only so the set is findable: **#292**
(Overpass mirror ordering) and **#293** (negative `residual_ms` in committed evidence).

**#279's cause** — `PLACE_RADIUS_M = 3000` plus Denver tagging real neighbourhoods
`place=locality` — is the subject of the tiebreaker pass below. #279 closes on the ship
that carries its result; #294 closes with it.

---

## The tiebreaker, and the ruling it produced (2026-09-17)

**Ryan's ruling, verbatim, 2026-09-17:**

> #279 ruling: A — PLACE_RADIUS_M 3,000 → 5,000.
>
> Trace as you stated it: 5,000 is the smallest tested value that classifies 7/7 urban and
> flips 0/11 rural; 3,000 misses e-bayaud; 8,000 flips sr71-limon. Record it CHOSEN with
> those three measurements and the sample's way ids. No minimum search — a value fitted to
> e-bayaud's 3,056 m node is a value fitted to one pin; 5,000 has ~2 km margin over the
> nearest urban node and sits well under the known failure at 8,000. That margin is the
> argument; it goes in rulings.md.
>
> The Ouray disagreement goes in rulings.md as the reason this is a tie-break, not a
> decisive win, and on #291 as a comment: a second case where "what's near the road" gives
> an answer the place classes can't express.
>
> Ship scope: the one constant in classify.ts; the masking fix (c3e4bed, honest message,
> closes #294); the falsified-diagnosis record; the candidates/ and tiebreaker evidence;
> the per-pin table before/after on the full sample. The inferred marker fires where the
> classification fell to the tie-break, as #274's producer already does. Do NOT move the
> predicate to the backend in this arc — that was withdrawn with the rest of (c); it
> belongs to #291's arc.
>
> Predict the churn: the classification is in recorded audits, so every baseline carrying
> roadType for a pin whose verdict changes moves — which pins, how many files, single-leaf
> proof. Rebase onto main, verify, stop with the ship line. #279 closes on the ship; #294
> closes with it.

*(Three notes on the quoted text, left uncorrected inside the quote. **The Ouray premise in
it is false** — "a second case where 'what's near the road' gives an answer the place classes
can't express" is true, but the case is a trailhead tagged `place=locality`, not a town, and
it tells against candidate B rather than for it; I gave Ryan the wrong description and he
ruled on it. See "The Ouray disagreement" below for the record and for what it does and does
not change. The sha `c3e4bed` names
the masking fix; that commit has been rebased since and its sha will move again before the
ship, so it is cited here by subject instead — "fix: isUrban reads any urban place in range,
not just the closest — NOT a fix for #279", the third commit on this branch. And the
constant is in `route.ts`, not `classify.ts`; see "Where the constant actually lives" below.)*

### The sample

Seven urban reference pins from `memory.md` and #256's demo pin. Eleven rural controls
**derived from their own roads** by `tiebreak/derive-pins-279.js`: query OSM for a way
carrying the named `ref`, take a vertex of that way's own geometry, and require the pin to
sit ≥ 4,000 m from any place node. The pin is therefore on the named highway by
construction, and the way id is recorded beside each row so a reader can check it on
osm.org. Twenty targets were tried; nine were REJECTED (too close to a place node, or no
way with that `ref` in the bbox) and are reported, not silently dropped.

This replaces the earlier eyeballed set, two of whose pins landed on a `highway=residential`
farm track — which is how candidate C came to call US-385 "urban".

### Per-pin result

| pin | context | expect | current 3 km | **A — 5 km** | B — +`locality` | way |
|---|---|---|---|---|---|---|
| e-bayaud | urban | urban | **rural ✗** | **urban ✓** | urban ✓ | — |
| e-colfax | urban | urban | urban ✓ | urban ✓ | urban ✓ | — |
| lakewood | urban | urban | urban ✓ | urban ✓ | urban ✓ | — |
| northglenn | urban | urban | urban ✓ | urban ✓ | urban ✓ | — |
| thornton | urban | urban | urban ✓ | urban ✓ | urban ✓ | — |
| greeley | urban | urban | urban ✓ | urban ✓ | urban ✓ | — |
| denver-demo | urban | urban | urban ✓ | urban ✓ | urban ✓ | — |
| plains-us385-cheyenne | plains | rural | rural ✓ | rural ✓ | rural ✓ | `815792143` |
| plains-us40-kitcarson | plains | rural | rural ✓ | rural ✓ | rural ✓ | `253107467` |
| plains-sr71-limon | plains | rural | rural ✓ | rural ✓ | rural ✓ | `1526182998` |
| plains-us36-joes | plains | rural | rural ✓ | rural ✓ | rural ✓ | `132309245` |
| plains-us50-lamar | plains | rural | rural ✓ | rural ✓ | rural ✓ | `17125171` |
| mtn-us160-wolfcreek | mountain | rural | rural ✓ | rural ✓ | rural ✓ | `520172972` |
| mtn-co133-mcclure | mountain | rural | rural ✓ | rural ✓ | rural ✓ | `223373968` |
| mtn-us50-monarch | mountain | rural | rural ✓ | rural ✓ | rural ✓ | `308321130` |
| mtn-co149-creede | mountain | rural | rural ✓ | rural ✓ | rural ✓ | `17096156` |
| mtn-co139-douglaspass | mountain | rural | rural ✓ | rural ✓ | rural ✓ | `1245267865` |
| smalltown-us24-limon | small-town adj. | rural | rural ✓ | rural ✓ | rural ✓ | `808995928` |

```
current (3 km):  urban 6/7   rural 11/11    urban MISSED: e-bayaud
A — 5 km:        urban 7/7   rural 11/11
B — +locality:   urban 7/7   rural 11/11
RURAL FLIPS — A-5km: 0   B: 0   -> TIE
```

**Exactly one pin moves before → after: `e-bayaud`, rural → urban.** That is #279's
reported pin, and it is the whole behavioural delta of this ship.

### Why A, and why this is a tie-break rather than a win

Both candidates score identically on the scored sample. The ruling breaks the tie toward A
because it moves **one constant with a measured basis** rather than admitting `place=locality`
— a tag OSM also uses for uninhabited places, which is precisely why Denver's use of it for
real neighbourhoods was diagnosed as part of the cause rather than as a signal to trust.

**The margin is the argument, not the fit.** 5,000 m is not the minimum and was not
searched for. e-bayaud's nearest `neighbourhood` node is at 3,056 m, so ~3,500 would very
likely also pass — and would be a constant fitted to one pin. 5,000 leaves ~2 km of margin
over the node that must be caught, and sits well below 8,000, the nearest value measured to
cost a rural control (`rural-sr71-limon`, in the earlier eyeballed `candidates/` run — a
weaker sample, and the only evidence either way that more radius can cost something).

### The Ouray disagreement — and my second falsified claim in this arc

The five pins the derivation REJECTED are reported unscored: a pin within 4,000 m of a place
node is not obviously urban or rural, and asserting an expectation for it would measure the
author's assumption rather than the predicate. Their verdicts still carry information,
because where the candidates **disagree** is the information.

| unscored pin | current | A — 5 km | B — +locality |
|---|---|---|---|
| **mtn-us550-ouray** (`17141860`) | rural | rural | **urban** ← disagree |
| mtn-co14-poudre (`8092307`) | rural | rural | rural |
| plains-us160-walsh (`17013005`) | rural | rural | rural |
| plains-us34-otis (`253132403`) | rural | rural | rural |
| smalltown-us85-fortlupton (`111870192`) | urban | urban | urban |

**FALSIFIED, 2026-09-18 — what I reported, and what the pin actually is.**

I reported this disagreement to Ryan as: *"Ouray is a real town 197 m away whose node isn't
in the four urban classes, so B catches it and A doesn't. That's a point **for** B that this
sample can't score."* The ruling of 2026-09-17 quoted above was taken partly on that
description, and records the Ouray case as the reason A breaks a tie rather than winning.

**It is wrong.** From `tiebreak/out-2026-09-17/derived-pins.json`, the pin is:

```json
{"name": "mtn-us550-ouray", "lat": 37.84587, "lng": -107.72462,
 "way_id": 17141860, "ref": "US 550", "road_name": "Million Dollar Highway",
 "highway": "trunk",
 "nearest_place": {"place": "locality", "name": "Ophir Pass Trailhead (Easternmost)",
                   "dist_m": 197}}
```

The 197 m node is an **uninhabited trailhead marker**, not a town. The town of Ouray is
roughly 20 km north, outside every radius considered. The pin is named after the bounding
box it was derived from, and I read the name as a description of its surroundings instead of
opening the record — the same class of error as the eyeballed pins this very sample was
built to replace.

**The correction inverts the conclusion.** B flips this pin urban *because a trailhead is
tagged `place=locality`* — which is exactly the failure mode `locality` was suspected of, and
exactly the ruling's stated reason for preferring a radius change over a class change. So the
Ouray case is evidence **against B**, not for it. It does not weaken A; it is the sharpest
single piece of evidence in the sample supporting the ruling's choice.

**What still stands, and what does not.** The adopted value (5,000 m), the tie on the scored
sample, and the ruling's outcome are all unaffected — none of them depended on this pin. What
does not stand is the ruling's stated *reason* for calling A a tie-break rather than a win.
That reason was my description. On the corrected reading the scored sample still ties, so A
is still adopted on the tie-break rule — but the unscored bucket now leans toward A rather
than away from it, and nothing in this arc argues for B.

**Why it is recorded rather than edited away.** This is the second claim of mine this arc has
falsified — the first being the masking diagnosis — and both were caught by opening the
evidence instead of trusting the summary written from it. Deleting either would erase the
only part worth keeping.

It remains the same shape as #291 for a different reason than I gave: not "a town the classes
can't express", but "the only node in range describes a trailhead and says nothing about the
road". Recorded there as a comment, with this correction attached.

### The known limit this does not fix

**Lookout Mountain Rd is not in the scored rural set.** It was in the earlier five-pin set,
it is #291 now, and it classifies **urban under every candidate measured including this
one**. "rural 11/11" therefore excludes the one rural pin known to be wrong. Nothing in this
ship improves it, and nothing here should be read as claiming otherwise.

### The two distances this arc rests on, and the evidence that was missing

`bayaud/bayaud-places-279.js`, output `bayaud/out-2026-09-18/`.

The arc's central factual claim is that #279's pin has **no node the predicate accepts**
inside 3,000 m. Two numbers carry it — the nearest `neighbourhood` at 3,056 m and Denver's
`city` node at 4,661 m — and both are quoted in the fix commit, in `route.ts`'s comment and
above in this file.

**They had no committed evidence behind them.** They came from a throwaway probe whose output
was never committed; the `rate/` log records only "closest place: village Glendale @ 1256 m".
A number cited in shipped code with nothing to check it against is exactly what Rule 12
exists to prevent, and I put two of them there. Caught on re-reading my own citations, not by
review.

Re-run 2026-09-18, and both reproduce exactly:

```
=== radius 3000 m — 3 place nodes ===
   1256 m  place=village        Glendale
   2200 m  place=locality       Hale
   2218 m  place=locality       Congress Park
  nearest node the predicate accepts: NONE in range
  isUrban at this radius: false

=== radius 5000 m — 13 place nodes ===
   3040 m  place=locality       Montclair
   3056 m  place=neighbourhood  Alamo Placita          <- predicate ACCEPTS
   4661 m  place=city           Denver                 <- predicate ACCEPTS
   4673 m  place=locality       East Colfax
  nearest node the predicate accepts: Alamo Placita @ 3056 m
  nearest place=city: Denver @ 4661 m
  isUrban at this radius: TRUE
```

It also makes the second half of the cause visible rather than asserted: **Hale, Congress
Park, Montclair and East Colfax are real Denver neighbourhoods tagged `place=locality`** — a
class the predicate does not accept.

Being exact about where they fall, because the first draft of this passage was not: **two of
the four are inside the old 3,000 m radius** (Hale 2,200 m, Congress Park 2,218 m). Montclair
is at **3,040 m — 40 m outside**, and East Colfax at 4,673 m. So inside the old radius there
were exactly three place nodes in total: Glendale (`village`, 1,256 m) and those two
localities. Not one of them is a class the predicate accepts.

Montclair being 40 m outside is the more interesting fact, not a weaker one: within 56 m of
the old boundary sit a `locality` the predicate would have rejected anyway and the
`neighbourhood` it would have accepted. The pin was never going to classify urban at
3,000 m — and moving the boundary a little would have changed that only by luck.

### Where the constant actually lives

The ruling says "the one constant in `classify.ts`". It is in
`conestruct/site/app/api/road-bearing/route.ts:43`. `classify.ts` **consumes** the boolean
(`classifyFromOsmTags(input, isUrban, placeName)`) but never computes it — the route derives
`isUrban` from the Overpass response and hands it over. Recorded rather than silently
relocated; the value moved where it lives.

### Churn, predicted before the diff (Rule 5)

**Prediction: no existing baseline, fixture or recorded artifact moves. Zero files beyond
the two edited.**

That is a stronger claim than the ruling assumed, so here is why, each leg checked:

1. **The radius is enforced by Overpass, not by this code.** `isUrban` is
   `elements.some(el => el.type === "node" && URBAN_PLACE_CLASSES.has(...))` — there is no
   distance test in the repo. `PLACE_RADIUS_M` appears in exactly one place that affects
   behaviour: the `node(around:…)` clause of the query string. So the only observable
   change is *which nodes Overpass returns*, live.
2. **Recorded audits do not regenerate through the classifier.** The backend takes
   `scenario.roadType` from the request payload (`src/api/schemas.py`,
   `_map_road_type(...)` at eight call sites in `src/api/schemas.py` — 964, 988, 1013, 1034,
   1054, 1075 and 1102 on `scenario.roadType`, and 1116 on `a.roadType` inside the
   intersection-approach loop; `render_api.py:983` does the same for `req.roadType`). No
   committed artifact is
   rebuilt by calling `/api/road-bearing`; every script under `validation-artifacts/` that
   touches that route is a frozen live-check recording of a past run, not a regenerated
   baseline. Frozen recordings of what the old radius did stay true *as recordings* and
   must not be rewritten.
3. **The existing unit tests are distance-blind.** The Overpass stub returns whatever
   elements a test hands it, at whatever `dLat` — the radius never filters them. All nine
   pre-existing tests in `route.test.ts` therefore pass unchanged under either value, which
   is exactly why the constant had **no test at all** before this commit.

**Single-leaf proof.** Leg 3 is the one that could hide a regression, and it cuts both
ways: if nothing can observe the constant, nothing can defend it either. So the commit adds
one test — `"asks Overpass for place nodes within 5,000 m (#279)"` — which captures the
query body the route actually sent and asserts the `around:5000` clause. Red-proved: run
against the unchanged `3000`, it fails with
`expected '…node(around:3000,…' to contain 'node(around:5000,…'`, the other nine passing;
after the one-line change, 10/10.

### The `inferred` marker — verified, not re-implemented

The ruling requires the marker to fire where the classification fell to the tie-break.
It already does, and `classify.ts` is **not** in this diff. `fields.roadType.method` is
`"measured"` only when `fieldRoadTypeConf === "high"`, which is only `motorway`/
`motorway_link` — the single branch of `roadTypeAndDivided()` that ignores `isUrban`
entirely. Every other class folds `isUrban` into the answer and is already
`method: "inferred"`, with `source` reading `OSM class=… + urban|rural (inferred)`.
Checked in source at `conestruct/site/lib/road-detection/classify.ts:348-359`.
