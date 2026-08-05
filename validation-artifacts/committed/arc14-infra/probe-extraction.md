# Arc 14 — healthz probe extraction (#169)

The deploy-gap monitor's probe moved from inline bash
(`modal-deploy-check.yml`, the #168 step) to
`scripts/modal-healthz-probe.mjs`; the workflow step is now a one-line
`node` call. The drift-diff and issue-reconcile steps stay in the yml —
they need git history and the issues API; #169's acceptance covers the
probe only, and no probe logic remains inline.

## Behavior map (old bash ↔ new script — preserved 1:1)

| Behavior | #168 bash | Script |
|---|---|---|
| Attempts / sleep / per-attempt timeout | 3 / 10 s / `--max-time 30` | 3 / 10 s / `AbortSignal.timeout(30_000)` (env-overridable `MODAL_PROBE_ATTEMPTS` / `MODAL_PROBE_SLEEP_SECONDS` — test hooks only, the defaults are the workflow behavior) |
| Unreachable after all attempts | `::error::Modal /healthz unreachable at $URL after $N attempts (network/timeout/DNS). …` exit 1 | identical message, exit 1 |
| Non-200 after all attempts | `::error::Modal /healthz returned HTTP $CODE at $URL after $N attempts. …` exit 1 | identical message, exit 1 |
| 200 | `jq -r '.sha // "unknown"'` → `Served SHA:` + `reachable=true` / `served_sha=` to `GITHUB_OUTPUT` | `JSON.parse` with the same missing-sha → `"unknown"` fallback; same log line; same `GITHUB_OUTPUT` keys |
| 200, unparsable body | step failed via jq under `set -e` (red) | explicit `::error::… body is not JSON` exit 1 — deliberately kept red: a healthz we cannot read is a healthz we cannot verify |
| Per-attempt progress lines | `could not reach … (curl exit $RC)` / `returned HTTP $CODE` | same shape; the unreachable line says `(fetch: <code>)` instead of `(curl exit N)` — the only wording delta, log-only, stated here rather than discovered |

## Vitest coverage (`conestruct/site/tests/modal-healthz-probe.test.ts`)

Six cases, spawning the real script as a child process against local
mock servers (async spawn — a sync spawn would deadlock against the
in-process mock server): dead port → 1 · mock 500 → 1 (distinct
message) · mock 200 drifted sha → 0 + faithful extraction · mock 200
matching sha → 0 · mock 200 no sha field → 0 + `"unknown"` · mock 200
non-JSON → 1. The drifted/matching pair proves the taxonomy's c/d
half at probe level: the extracted sha is the exact input the
workflow's owed-step drift decision consumes.

Runs in the standard suite: full frontend gates at commit 1 —
typecheck clean, lint clean (one pre-existing warning elsewhere),
**vitest 79 files / 623 tests passed** (including these 6).

The test file lives in `conestruct/site/tests/` (new, tracked) — NOT
`conestruct/site/scripts/`, which .gitignore:59 deliberately ignores
as a one-off-harness dump; the first commit attempt caught this.

## Rule-10 proof — the check can fail (both halves)

1. **Pre-commit red run** (`rule10-red-run.log`): with the script's
   unreachable branch deliberately broken to `exit 0` — the exact
   swallow-and-skip failure mode #134/PR #168 fixed — the dead-port
   case goes red: `expected +0 to be 1`. Reverted before commit.
   (A first attempt broke the wrong branch — the no-URL guard, which
   no test covers — and the suite stayed green: a vacuous proof,
   caught and redone against the covered branch. Recorded per the
   arc12 vacuous-guard lesson.)
2. **Post-merge dispatch pair** (authorized, recorded in
   `dispatch-record.md` after Ryan's ship): red-override
   (`healthz_url_override=https://127.0.0.1:1` → run must fail) +
   clean (green, zero deprecation annotations).

## CI before/after (Rule 5)

Triggers (cron */15 + dispatch), permissions, concurrency, the owed
diff scope, and the reconcile behavior are byte-untouched. The
run-visible delta is only the probe step's log source (node instead of
inline bash; same `::error::` messages) and, with #170, the
disappearance of the deprecation annotation. No new secrets; CI gains
no deploy ability; `verdict_hook.py` / diff-verifier paths untouched.

Flake note (stated per the arc prompt): neither commit touches test
invocation — `uv run pytest` and `npm test` are byte-unchanged — so
the wandering Python suite-ordering flake's CI exposure is exactly
what it was. Not filing its dedicated issue: no spread observed (both
suites green on the latest main push).
