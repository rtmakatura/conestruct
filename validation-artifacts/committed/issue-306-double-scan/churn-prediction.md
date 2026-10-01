# #306 site churn, predicted before the site diff (Rule 5)

Written after the backend commit (`9930b1f`) and before any change under `conestruct/site/`.

**The change.**
- Generate's two effects (`GeneratorShell.tsx:454-512` the device breakdown, `:514-598` the audit)
  become one request: `/api/render/audit` with `include_breakdown: true`.
- Both states are filled from its one answer: the audit state from the response, the breakdown
  state from `response.breakdown`. A refusal or network error sets both to the same error.
- The S7 preview (`:640-660`, `preview: true` on `/api/render/device-breakdown`) is unchanged.

**Why the tests move.**
- Every site test that drives a Generate mocks `fetch` per file, routing by URL.
- `genState` derives from the breakdown (`GeneratorShell.tsx:220`).
- So every such test needs its audit mock to answer `breakdown` when the request asks for it.

**Predicted: 33 test files**, the ones that mention `/api/render/device-breakdown` today:

| Kind of change | Files |
|---|---|
| The mock router only: the audit branch answers `breakdown` when asked (22) | AuditTrail.declined-stale, GeneratorShell.{a11y-announce, a11y-focus, class-suggest, confirm-undo-loop, confirm-window, debounce, error-honesty, no-location, post-generate-scroll, pre-generate-zone, regenerate-mounted, results-head, scan-disclosure, suggest-contract, suggestion-records}, WorkingBand.render, WorkingBand, WriteLock, plus GeneratorShell.{class-stability, saved-dirty} whose other reference is router-shaped |
| Assertions on the Generate breakdown request (counts, payloads, URL lists) move to the one audit request (11) | BandStack.landing, BandStack.one-open, GeneratorShell.{batch-corrections, kind-confirm, live-speakers, pin-model-wire, scan-refusal, scan-wire, zone-staging, revision, value-links}, WhatBand.every-kind |
| Preview assertions (`preview: true` on the breakdown URL) | unchanged, wherever they appear (revision, value-links, zone-staging, regenerate-mounted, WorkingBand.render, a11y-focus, post-generate-scroll) |

**Expected:**
- Every changed test file changes only its mocks, and the Generate-request assertions that name
  the breakdown URL. No assertion on what the page shows changes.
- A file that fails for any other reason is a miss, and the miss gets recorded.

**Not moving:**
- Recorded audits (the flag is opt-in, R65).
- The Python suites.
- `lib/` tests that don't drive Generate.

---

## Actual (after the site diff)

**After the component change, before any test edit:** 27 test files, 83 tests failed
(`npx vitest run`: 157 of 184 files passed).

**Moved: 27 files**, plus `DeviceBreakdown.test.tsx`, which gained 3 new tests.

| | Files |
|---|---|
| **Predicted and moved (23)** | AuditTrail.declined-stale, GeneratorShell.{a11y-announce, a11y-focus, batch-corrections, class-stability, class-suggest, confirm-undo-loop, confirm-window, debounce, error-honesty, pin-model-wire, post-generate-scroll, regenerate-mounted, revision, scan-refusal, scan-wire, suggest-contract, suggestion-records, value-links, zone-staging}, WorkingBand, WorkingBand.render, WriteLock |
| **Missed: moved, not predicted (4)** | GeneratorShell.{ribbons, input-gating, hit-targets, disclosures}. They never name the breakdown URL; a catch-all `fetch` branch served it, so the static scan couldn't see them |
| **Over-predicted: didn't move (10)** | BandStack.landing, BandStack.one-open, GeneratorShell.{kind-confirm, live-speakers, no-location, pre-generate-zone, results-head, saved-dirty, scan-disclosure}, WhatBand.every-kind |

**Rendered expectations that changed**, each a stated behavior change rather than a test edit:
1. **One Retry for a failed answer.** When the breakdown's failure is the audit's (`fromAudit`),
   the device-schedule chip no longer renders its own Retry. It reads "Device breakdown failed:
   <message>. Retry from the audit trail." with the summary "unavailable: retry from the audit
   trail". (Before: two Retry buttons whenever both requests failed.) `DeviceBreakdown.tsx`,
   driven by `GeneratorShell.debounce`, 3 new `DeviceBreakdown.test` cases.
2. **A failed (5xx) audit is a failed package.** The cards read "not generated", where they used to
   stand on a breakdown that answered separately. `AuditTrail.declined-stale`.
3. **A refusal settling mid-regeneration takes the working band with it.** No second request is
   left open. `GeneratorShell.regenerate-mounted`.
4. **Spec 31 is re-expressed** across the frames that still exist: refusal in flight, then landed.
   `WorkingBand`.
5. **A declined (400) answer:** the chip also says "Device schedule unavailable while generation
   is declined". That state already existed whenever both requests refused. The test now scopes
   to the audit trail's own line. `AuditTrail.declined-stale`.
6. **The write lock and the pre-generate column.** With one request, the column (`genState
   generating`) shows under the lock in the honesty test. The real Generate button now declares
   `data-write` (it was already disabled while generating), and the stub mirrors it. The real
   sidebar's other controls are not mounted in that test; whether they all declare themselves is
   unverified (a follow-up). `WriteLock`, `GeneratorFormPrimitives.tsx`.

**Final:** 184 of 184 files, 1896 tests pass; `tsc --noEmit` is clean.
