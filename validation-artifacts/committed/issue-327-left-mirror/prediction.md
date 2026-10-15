# Rule 5 prediction: #327, the left-side mirror reads the relayed road

**Base:** `issue-323-turn-bay-field` `4bbddcf` (stacked, so the browser shows TA-23's refusal).

**R145 self-ruled.** This is #327's proposed fix. It fits Rule 3's mirror pattern: a frontend mirror reads the same facts the request carries.

## Change

`leftSideBuilt(scenario)` (`lib/scenarios/auto-apply.ts`) evaluates the scenario after `withRelayedCenterline()`. That is the derivation the render proxy applies before sending (`lib/render-proxy.ts`). So `meta.roadDirection.oneway` comes from the confirmed road's tags, behind the same pin-equality staleness key, exactly as the backend receives it.

## Predicted behavior

- **The `work_side` row is quiet on a built left plan.** On a confirmed one-way road, `matchRefusalAffordance` returns null for a left shoulder or left near-intersection plan whose shell scenario carries only `confirmedRoad`. So:
  - a refusal on such a plan shows the backend's message in the banner (`StatusBar`: `refusal.pointer ?? refusal.message`), e.g. TA-23's "Enter the left-turn bay storage length under Cross street. …" with NEEDS INPUT;
  - `refusalPending` stops holding the Generate button during every in-flight audit of a built left plan.
- **Unchanged when the road is two-way:** a stored left side on a road tagged two-way, or with the kind changed, still gets the `work_side` pointer (#300 R119 Q4).
- **A moved pin** (`confirmedRoad.pinLat/pinLng` no longer equal the pin) relays nothing. The mirror then reads the scenario as before, which is what the backend gets.
- **Tests:** existing tests keep passing. Their scenarios set `roadDirection` without `confirmedRoad`, so the relay returns them unchanged.
- **No backend change; no plan output changes.** Frontend only.

## Tests (Rule 11)

- `left-side.test.ts`: a scenario shaped as the shell holds it (`confirmedRoad` with `tags.oneway = "yes"`, no `roadDirection`) → `leftSideBuilt` is true and `matchRefusalAffordance` is null. The same with a moved pin → false, and the row arms.
- A mounted check: `GeneratorShell`'s refusal for that scenario carries the backend's message, not the pointer, if an existing mounted refusal harness takes it. Otherwise the pure tests plus the production browser check after shipping (the "Production browser is verification gate" memory).
