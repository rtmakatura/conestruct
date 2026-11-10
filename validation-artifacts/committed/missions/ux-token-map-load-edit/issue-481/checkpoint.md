# #481 checkpoint: the gate token never reaches output

Mission ux-token-map-load-edit (tracking #486), item #481. Branch
`issue-481-gate-token-never-printed`, built on `mission-ux-token-map-load-edit-prompts` (d5b6899).

## Plan (5 bullets)
1. **Problem.** `scripts/gate.cjs:91-115` (`fetchGated`) awaits `route.fetch` / `route.fulfill` with no
   catch. Playwright calls the route handler without awaiting it, so when the browser closes mid-request
   the rejection is unhandled and Node prints it whole; Playwright's call log in that message lists the
   request headers, the `x-conestruct-gate` value included. `scripts/verify-generate-cls.mjs:150-158`
   (its own audit hold route) has the same shape, and its catch at `:254-255` prints `String(e)`. The
   other harnesses that load gate.cjs (`probe.cjs:388`, `sweep.cjs:225`, `verify-phone-fit.cjs:249`)
   print whole error objects with `console.error(e)`.
2. **Rulings.** Ryan's instruction for this item: verify-generate-cls.mjs and any shared walk helper
   never print request headers or the gate token, even on a crash; a test fails if the token appears in
   output. #450 walk-script rule (every walk builds its contexts with newGatedContext). The rest is
   R145 self-ruled (rulings.md).
3. **Change.** gate.cjs: `redact(text)` (drops every line naming the gate header, replaces the token
   value), `isClosedError(err)`, `oneLine(err)`; `fetchGated` catches its own failures (closed or
   disposed: ignored; anything else: one redacted line, then `route.abort()`); `guardOutput()` scrubs
   the token from every `process.stdout` / `process.stderr` write and installs `unhandledRejection` /
   `uncaughtException` handlers that print one redacted line (a request in flight at browser close is
   noted and ignored, as `disposed-guard.cjs` did; anything else exits 1). verify-generate-cls.mjs calls
   `guardOutput()`, its audit route catches the same way, and its ERROR line uses `oneLine`. probe.cjs,
   sweep.cjs, verify-phone-fit.cjs, verify-jbar-stability.mjs and verify-single-nav.mjs call
   `guardOutput()`.
4. **Rule 5 churn prediction.** Behavior change, deliberate: a harness that crashes now prints one
   redacted line instead of the whole error, and a request still in flight when the browser closes no
   longer ends the run. Files: `scripts/gate.cjs` (+~75), `scripts/verify-generate-cls.mjs` (~+12/-4),
   one-to-three-line `guardOutput()` wiring in the five other scripts, `conestruct/site/tests/gate-helper.test.ts`
   (+~110: crash scenarios in child processes with a fake token), this evidence folder. Byte-identical:
   everything under `conestruct/site/` except that test, every backend file, every archived evidence
   dir (`disposed-guard.cjs` stays, see rulings.md), the headers a gated request sends and to whom.
5. **Proof.** vitest crash tests run real `node` child processes with `GATE_BYPASS_TOKEN` set to a
   fake token and fail if it appears in stdout or stderr: (a) gate.cjs's route handler rejecting with a
   Playwright-style header call log while nobody awaits it; (b) `verify-generate-cls.mjs` itself run
   against a stand-in `playwright` whose page closes mid-request and whose goto throws a header-bearing
   error; (c) `guardOutput()` against a raw write and an uncaught throw carrying the token. Red proof
   against the old gate.cjs / verify-generate-cls.mjs recorded in `red-proof.txt` here.

## Prediction vs actual (recorded after the diff; the prediction above is unchanged)
- `scripts/gate.cjs` +88 (predicted ~+75).
- `scripts/verify-generate-cls.mjs` +20/-9 (predicted ~+12/-4): the audit-hold route's body moved inside
  a try, so its lines count as changed.
- Five harnesses +2/-1 each (predicted one to three lines each).
- `conestruct/site/tests/gate-helper.test.ts` +106 (predicted ~+110).
- **Not predicted:** `conestruct/site/tests/fixtures/fake-playwright-481.cjs` (new, 59 lines), the
  stand-in the prediction's bullet 5 describes but did not list as a file; and
  `conestruct/site/vercel-ignore.sh` +2 (SITE_INPUTS, rulings.md R145 self-ruled 7), which the full
  vitest run required.
- Byte-identical as predicted: the site's app code, every backend file, every archived evidence dir.
