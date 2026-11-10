# #481 rulings

**Ryan (mission brief, 2026-11-10).** verify-generate-cls.mjs and any shared walk helper never print
request headers or the gate token, even on a crash; add a test that fails if the token appears in
output.

**R145 self-ruled 1: redact at the source, two layers.** gate.cjs's route handler never rejects (it
catches its own `route.fetch` / `route.fulfill` failures), and `guardOutput()` scrubs the token from
every stdout/stderr write plus prints crashes as one redacted line. The first stops the crash; the
second holds even when a harness prints an error object itself (`console.error(e)` in probe.cjs,
sweep.cjs, verify-phone-fit.cjs). Node's own fatal-error printer writes to fd 2 without going through
`process.stderr.write`, which is why the crash handlers are needed as well as the write scrub.

**R145 self-ruled 2: `guardOutput()` is called by each harness, not installed on require.** gate.cjs is
also loaded by vitest (gate-helper.test.ts); a handler that calls `process.exit` inside a vitest worker
would break the runner. Every harness in `scripts/` that loads gate.cjs calls it on its first lines.
`audit-lib.js` is a library loaded by those harnesses, not an entry point, so it gets no call.

**R145 self-ruled 3: a request in flight at browser close is not a failure.** At the route (gate.cjs
`fetchGated` and verify-generate-cls.mjs's audit-hold route) the closed or disposed error is dropped
silently: the catch returns and prints nothing. A one-line note prints only when such a rejection
escapes a route and reaches `guardOutput()`'s `unhandledRejection` handler. That is what the #478
workaround `disposed-guard.cjs` did and what #481 proposes ("Ignore that case"). The width's own
result still decides pass or fail.

**R145 self-ruled 4: `disposed-guard.cjs` stays where it is.** #481 says "fold it into the script, then
remove it". Its behavior is folded into gate.cjs `guardOutput()`; the file itself is part of the #478
production-check evidence, whose runs cite it, and archived evidence dirs are never edited (gate.cjs
header, D4 / C-Q7). Removing it would break the citation, so the fold is the fix and the file is left.

**R145 self-ruled 5: the redaction rule.** Any line naming `x-conestruct-gate` (any case) is dropped
whole, and any remaining occurrence of the token value is replaced by `[gate token]`. Only a token of 8
or more characters is scrubbed by value (CHOSEN, Rule 12: a shorter value would match ordinary text and
mangle output; real tokens are far longer, and the header-line rule still applies to any length).

**R145 self-ruled 6: the tests use a stand-in Playwright, not a browser.** The crash needs a request
in flight when the browser closes; a real browser makes that a race and needs a Chromium install in
CI. The stand-in raises Playwright's own error shape (message first line, then a call log listing the
headers), and the tests run the real gate.cjs and the real verify-generate-cls.mjs in child processes
and read their real stdout/stderr.

**Out of scope, not filed.** Rotating the token is Ryan's call (a secret outside the repo; #481 says
so). `scripts/gate.py` prints nothing on failure (its only raise names the variable, not its value).
Archived evidence walk scripts are frozen and never re-run as-is.

**R145 self-ruled 7: SITE_INPUTS gains the two outside paths the new test reads.** The full vitest
run failed `tests/build-inputs.test.ts` (R2: every path outside the site that its tests reach is on
SITE_INPUTS). The crash test runs `scripts/verify-generate-cls.mjs`, which reads
`validation-artifacts/committed/ux-group3-where/evidence/overpass-fixture/c74c32bdc5114bff.json` at
load, so both are added to SITE_INPUTS in `conestruct/site/vercel-ignore.sh` (R2's own remedy: "add
these to SITE_INPUTS"). Effect: a commit that changes either file now counts as a site change for the
Vercel skip rule and preview-url.ps1, as gate.cjs already does.
