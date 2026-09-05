# fix-224-manual-pin-move — a typed coordinate is a pin move

Off main `6ad83c0` (the s2-arc18 ship). GO of 2026-09-05. Ship line:
`.\scripts\ship.ps1 -Branch fix-224-manual-pin-move`.

## The defect

The s2-arc18 prod live check's leg J1 (`s2-arc18-corrections/outS2A18Prod/
s2a18-lc.md`): with an assert on the wire, editing Latitude in the
Location step's manual entry from 39.7113 to 39.7114 re-generated at the
new pin with `meta.siteConditionOverrides` still present. The arc's
pin-move clearing lived only in `GeneratorSidebar.onPickerSave` (the map
picker's Save); `ManualFallback`'s Latitude / Longitude fields wrote
`meta.lat` / `meta.lng` through `setMeta` and never passed through it.
Corrections whose subject (this corridor's scan) no longer existed stayed
on the wire — disclosed on every surface, never silent, but stale (rule
10).

## The ruling and the fix

One shared helper, both doors call it. `lib/scenarios/site-corrections.ts`
gains `withPin(meta, patch)`: applies the coordinate patch and clears the
corrections iff the pin actually moved (a re-save or a re-typed same
value keeps them). `onPickerSave` builds its meta from
`withPin(cur.meta, { lat, lng })`; the manual fields' `onChange` call
`withPin`. A writer that bypasses the helper is a defect.

## Every writer of `meta.lat` / `meta.lng`, by grep (`conestruct/site`, non-test)

| hit | kind | through `withPin`? |
|---|---|---|
| `components/GeneratorSidebar.tsx` `onPickerSave` | the picker door — writes a live pin | yes |
| `components/GeneratorSidebar.tsx` `ManualFallback` Latitude / Longitude `onChange` | the manual door — writes a live pin | yes (this fix) |
| `components/GeneratorSidebar.tsx` `LocationPickerModal initial={{ lat, lng }}` | a read | n/a |
| `components/GeneratorSidebar.tsx` `onClassification?.(…, { lat: r.lat, lng: r.lng })` | the dev snapshot's detection coords, not `meta` | n/a |
| `components/GeneratorSidebar.tsx` `ProjectGroup.set(key, value)` | writes project / address / description keys only (no `lat` / `lng` caller) | n/a |
| `lib/scenarios/index.ts` `migrateLegacy` | a constructor for legacy saved params (no corrections can exist) | n/a |
| `lib/scenarios/index.ts` `DEFAULT_*` metas | constructors at 0/0 | n/a |
| `components/test-fixtures.ts` `TEST_PIN` | test-only constructor | n/a |
| `components/GeneratorShell.tsx:450`, `LocationPickerModal.tsx` (`crossPin`, request bodies), `app/api/*` | request bodies / API routes / picker-internal state, not the scenario's `meta` | n/a |

## Proof

`GeneratorSidebar.manual-pin-move.test.tsx` (+1), mounted through the
REAL sidebar inside `GeneratorShell` with `initialScenario` pinned at
Lakewood and carrying a dismiss marker: re-typing the same latitude
keeps the marker on the bundle request (the control); a new latitude
drops the key entirely. Red run `red-run-manual-pin-move.txt`: sources
stashed to main — the control passes, then `"siteConditionOverrides" in
meta` is true. Rule 5: predicted +1 test, `picker-reapply` 0; actual
+1, 0. No backend change; no wire change.

Post-ship: the J leg of `s2a18-lc-prod.js` re-run sha-gated on prod
(the manual entry is the affordance it drives) should turn J1 to PASS.
