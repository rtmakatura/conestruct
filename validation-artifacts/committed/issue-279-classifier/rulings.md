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

## The cause, as the checkpoint found it

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
