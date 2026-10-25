# #353 evidence (Windows, local, 2026-10-25)

## Reproduction attempts on base 857c3f8 (full `npx vitest run`, one at a time)
| run | result | redirects.test.ts | first test | suite duration |
|---|---|---|---|---|
| 1 | 238 files passed, 1 skipped; 2536 tests passed, 1 skipped | passed | 1369 ms | 58.86 s |
| 2 | same | passed | 1258 ms | 59.88 s |
| 3 | same | passed | 1259 ms | 60.01 s |

Run 1 summary lines, as printed:
```
 Test Files  238 passed | 1 skipped (239)
      Tests  2536 passed | 1 skipped (2537)
   Start at  01:00:08
   Duration  58.86s (transform 10.09s, setup 0ms, collect 91.93s, tests 330.85s, environment 106.75s, prepare 41.15s)
```
The issue's failure did not reproduce in 3 full runs (no failures of any test). Alone: first test 953 ms, file 955 ms.

## Where the time goes
`node -e` timing in conestruct/site: `import("@sentry/nextjs")` 533 / 529 ms; `next.config.mjs` after that 67 / 70 ms. All of the first test's time is the first module load; the second test runs in 1 ms.

## Mechanism (scaled red proof)
Base file, `npx vitest run lib/redirects.test.ts --testTimeout=500`:
```
× next.config redirects > /landing redirects to / as a 307 (C-Q5) 629ms
  → Test timed out in 500ms.
✓ next.config redirects > /try redirects to / as a 307 (C-Q5) 1ms
Tests  1 failed | 1 passed (2)
```
Fixed file, `--testTimeout=500 --hookTimeout=500` (the explicit 30 s hook timeout wins), (excerpt; the full summary lines weren't captured): `Tests 2 passed (2)`.

## Acceptance: fixed file, three full runs in a row
| run | result | redirects.test.ts | suite duration |
|---|---|---|---|
| 4 | 238 passed, 1 skipped; 2536 tests passed, 1 skipped | passed (1244 ms) | 59.71 s |
| 5 | same | passed (1243 ms) | 59.82 s |
| 6 | same | passed (1276 ms) | 60.34 s |

Run 4 summary lines, as printed:
```
 Test Files  238 passed | 1 skipped (239)
      Tests  2536 passed | 1 skipped (2537)
   Start at  01:04:35
   Duration  59.71s (transform 9.05s, setup 0ms, collect 98.76s, tests 329.89s, environment 118.19s, prepare 40.91s)
```
Base also passed 3 of 3 full runs (runs 1-3), so this three-run acceptance can't tell base and fix apart. Only the scaled red proof above does: base fails at a 500 ms test timeout, the fix passes.

`npx tsc --noEmit` clean. ESLint ignores test files (the ignore pattern matches).
