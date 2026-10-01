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
