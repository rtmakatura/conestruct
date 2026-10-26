# Option (a) probe (#397 R145-1)

Re-run in repair cycle 1, recorded. Method: on this branch's tree, `conestruct/site/lib/scenarios/index.ts` had `DEFAULT_SCENARIO` set to `{ ...DEFAULT_SHOULDER, workLen: 0 }` (the session default unset, nothing else changed), full `npx vitest run`, then the file was restored (checked: 0 occurrences after).

Result: 18 failed in 9 files. 16 of them in 7 files are the same failures the first, unrecorded probe saw on the base tree; the other 2 are this branch's own tests (`MoveLedger.form.test.tsx` Extent value, `untouched-provenance.test.tsx` W1), which assume the 1,000 ft start.

```
      Tests  18 failed | 2549 passed | 1 skipped (2568)
 FAIL  components/GeneratorShell.kind-confirm.test.tsx > defect 1 — the kind is confirmed, never inferred > #290, PAYLOAD: a confirmed kind with no side fires no check, and Generate names the side
 FAIL  components/GeneratorShell.kind-confirm.test.tsx > defect 1 — the kind is confirmed, never inferred > FINDING 1, PAYLOAD: no live check is sent until the kind is confirmed
 FAIL  components/GeneratorShell.kind-confirm.test.tsx > defect 1 — the kind is confirmed, never inferred > FINDING 1: a kind re-picked after a confirmation pauses the checks and drops the held lengths
 FAIL  components/GeneratorShell.kind-confirm.test.tsx > defect 1 — the kind is confirmed, never inferred > PAYLOAD: with no chip clicked, Generate is refused and fires nothing
 FAIL  components/GeneratorShell.kind-confirm.test.tsx > defect 1 — the kind is confirmed, never inferred > changing the kind after confirming asks for the confirm again
 FAIL  components/GeneratorShell.kind-confirm.test.tsx > defect 1 — the kind is confirmed, never inferred > only a click selects — and re-picking the default's own chip IS the choice
 FAIL  components/GeneratorShell.live-speakers.test.tsx > #260 (2) — one live speaker for the location gate > fresh session: exactly one live region carries the gate sentence — the CTA reason; the strip says AWAITING LOCATION · no site chosen; the rail blocker is aria-hidden; the quiet band is not live
 FAIL  components/GeneratorShell.no-location.test.tsx > no location, no certification (#186) > fresh load: AWAITING LOCATION, no verdict, Generate disabled with the stated reason
 FAIL  components/GeneratorShell.no-location.test.tsx > no location, no certification (#186) > typing coordinates in the manual fallback enables both surfaces
 FAIL  components/GeneratorShell.rail-single-source.test.tsx > rail blocker === CTA disabled-reason (one export) > pre-pin: the missing-location reason renders once, on the CTA
 FAIL  components/GeneratorShell.saved-dirty.test.tsx > workbench downloads gate on dirty state (#183) > an edit disables the row-backed downloads and names the resolution
 FAIL  components/GeneratorShell.saved-dirty.test.tsx > workbench downloads gate on dirty state (#183) > an unedited open downloads normally — no new friction
 FAIL  components/GeneratorShell.saved-dirty.test.tsx > workbench downloads gate on dirty state (#183) > saving re-enables downloads that match the screen
 FAIL  components/GeneratorShell.saved-settings.test.tsx > saved quote settings join the dirty baseline (#202) > a rate edit makes the plan dirty; saving it makes it clean
 FAIL  components/GeneratorShell.saved-settings.test.tsx > saved quote settings join the dirty baseline (#202) > opens on the saved settings, clean
 FAIL  components/GeneratorSidebar.prepin-gating.test.tsx > pre-pin gating (#222), as the column does it > the gate's own sentence is on screen, once, on the disabled primary
 FAIL  components/bands/MoveLedger.form.test.tsx > rule 68's values (correction 3) > 'Extent' separates the value from its producer with the column's middle dot
 FAIL  components/bands/untouched-provenance.test.tsx > W1: the starting 1,000 ft reads 'default' until the operator commits a length > mounted flow: ledger and field say 'default' after the pin and side; typing a length flips both
 Test Files  9 failed | 233 passed | 1 skipped (243)
⎯⎯⎯⎯⎯⎯ Failed Tests 18 ⎯⎯⎯⎯⎯⎯⎯
```
