# #516 checkpoint: the plan and the Rule 5 prediction

Mission `ux-group7-what-section` (#518), item #516. Branch `issue-516-stale-travel`, built on `issue-507-prod-check` at `7a77005` (which carries #507's production-check evidence commit `7a77005` on main `eb7cfb9`).

Baseline on `7a77005` (this worktree), only the tests for the files this item changes: vitest `14 passed (14)` files, `104 passed (104)` tests (`components/bands/WhereBand.*.test.tsx`, `lib/where-map-in-view.test.ts`, `components/bands/BandAerial.test.tsx`, `components/GeneratorShell.pin-model-wire.test.tsx`). Backend not touched, so no pytest.

## The plan

1. **The problem.** The stale request is the WHERE band's load ahead, not a save. `WhereBand.tsx:782-792` builds one scenario per side answer from `geometry.geometry.side_options`, and `BandAerial.tsx:323` sends each one at once through `prefetchGeometry` (`lib/corridor-geometry.ts:322`, no 300 ms debounce). For the render after the picker Save, `useCorridorGeometry` (`lib/corridor-geometry.ts:328`) still holds the old road's answer (state `ready`, the hook's effect has not run yet; then `loading` with the previous geometry), so its road sides (`work.travel`) are put on the new scenario (`confirmedRoad: null`, `roadAxis: "north_south"`). Confirmed by a stack captured in the mounted test's fetch mock (red-proof.txt): both stale reads come from `prefetchGeometry` ← `BandAerial.tsx:323`. The save paths the issue suspected are clean: `GeneratorSidebar.tsx:376-382` drops `work` on a road or direction change, and the picker preview (`LocationPickerModal.tsx:546-569`) never carries the new `roadAxis`.
2. **The rulings.** Rule 10 (a stale answer presented as current is a violation); the hook's own contract (`lib/corridor-geometry.ts`, "a stale corridor is never drawn as this one, Rule 10"); #456 ruling 3 (load ahead builds the scenario the click writes). R145 self-rulings in rulings.md.
3. **The change.** The hook stamps each ready answer with the scenario it answers (`for`, its JSON key). The load ahead builds side answers only from a ready answer whose `for` is this scenario.
4. **Rule 5 churn prediction** (below).
5. **The proof.** New mounted-flow test `components/bands/WhereBand.stale-travel.test.tsx`, red on `7a77005` (two stale reads), green with the fix; the affected tests above; `npx tsc --noEmit`. Evidence in this folder.

## Rule 5: predicted churn

Order, stated plainly: the cause was confirmed and the prediction below formed before the source diff; this file was written after the diff and the red proof. The actual diff matches it.

**Changes, deliberately:**
- `conestruct/site/lib/corridor-geometry.ts`: the `ready` variant of `GeometryFetch` gains an optional `for?: string`; `useCorridorGeometry`'s `settle` sets it. No consumer other than the load ahead reads it. About 10 lines with the comment.
- `conestruct/site/components/bands/WhereBand.tsx`: the side branch of the load ahead uses the side options only when `geometry.state === "ready"` and `geometry.for === JSON.stringify(scenario)`; otherwise it loads nothing ahead. About 5 lines with the comment.
- Behaviour: the render after a scenario change, and any render while the read is loading, send no side load-ahead reads. Once the answer for this scenario is ready, the load ahead runs as before, from that answer's sides. On the issue's sequence the two road-sided reads (one 400 each on prod) go away.
- New test file `conestruct/site/components/bands/WhereBand.stale-travel.test.tsx`.

**Byte-identical:** every saved scenario and meta (the Save path is untouched), the band's own geometry read and the shell's, every API route and the backend (the `pin_model_input` contract is unchanged), every device count, `GeneratorSidebar.tsx`, `LocationPickerModal.tsx`, `BandAerial.tsx`, `WhereQuestions.tsx` (#506's Save gate and #488's re-ask line, `EDIT_REASKED`), the kind branch of the load ahead, CSS.
