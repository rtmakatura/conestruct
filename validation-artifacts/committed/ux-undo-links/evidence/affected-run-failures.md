# #457: the first affected-vitest run's failures

The first run of the affected files on the built change (`vitest related` on the six changed components and `lib/design/type-exceptions.ts`, plus every test that reads `globals.css` or the census): `Test Files 3 failed | 119 passed (122)`, `Tests 3 failed | 1003 passed (1006)`.

The names were not captured from that first run's output; the same command was run once more, unchanged, to read them, and the same three failed:

1. `components/tap-targets.test.ts` › R138 tap targets › the cross-street lane confirm and its undo carry tap-44 (`expected 1 to be 2`).
2. `components/WriteLock.test.tsx` › #252 the write lock's enumeration is honest › the one dim rule sits after the block's own disabled ink … (a fifth selector reaching for `.ws-locked`).
3. `lib/design/type-census.test.ts` › CENSUS_PINS equal the figures read from the sources (`tsxUses` 134 expected, 133 observed).

Each one fails on its own as well: none is a flake, each is a pin this change moves. None was in the Rule 5 prediction (`../checkpoint.md`, § Actual). What was done:

1. The near-intersection note's Undo left `tap-44` for `.undo-link`, whose own rule floors it at 44 px. The test now counts one `tap-44` (the confirm) and one `undo-link`.
2. The Undo's disabled rule was first written `.workbench:not(.ws-locked) .undo-link:disabled`, a new selector on the lock class, which #252's enumeration forbids. It's now `.workbench .undo-link:disabled`; under the lock the one dim rule outranks it (specificity 0,4,0 against 0,3,0), so the result is the same and the enumeration is untouched. The test is unchanged.
3. `tsxUses` 134 → 133 in `CENSUS_PINS` (`NearIntersectionForm.tsx`'s `text-[12px]` 2 → 1, which the prediction named on the per-file row but not on the total).

After: `Test Files 122 passed (122)`, `Tests 1006 passed (1006)`.
