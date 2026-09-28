# ship-loop Change 2: the red-proof (R1, R2, R3)

**Built in:** `aee5a5c` on `ship-loop`: `conestruct/site/vercel.json` `ignoreCommand` →
`conestruct/site/vercel-ignore.sh`; the drift check `conestruct/site/tests/build-inputs.test.ts`;
`scripts/ship.ps1` step 7.

**Measured:** 2026-09-28. Every Vercel verdict below was read from GitHub's commit statuses for
the pushed sha (`probes/vercel_status.py`, read-only `gh api`). The throwaway branch
`ship-loop-redproof` stacks on `aee5a5c` and is **never merged**. Its commits append one comment
line each.

## R1: the skip rule, live on Vercel

| # | Push | What changed | Predicted | Vercel said | Time |
|---|---|---|---|---|---|
| — | `ship-loop` `5baf3a1..aee5a5c` | the site (`vercel.json`, the script, tests) | build | `success` "Deployment has completed" | 2.6 min |
| — | new branch `ship-loop-redproof` at `aee5a5c` | nothing new | — | **no deployment at all**: Vercel does not redeploy a commit it already deployed, so the ignore step never ran | — |
| 1 | `aee5a5c..32a635d` | `src/rules/tables.py`, backend only; **the branch's first deploy**, so there is no previous successful deploy on the branch | build (empty previous sha) | `success` "Deployment has completed" | 2.3 min |
| 2 | `32a635d..47db2be` | `src/rules/tables.py`, backend only | **skip** | `success` **"Canceled by Ignored Build Step"** | 16 s |
| 3 | `47db2be..7178d44` | `conestruct/site/lib/gate.ts`, site | build | `success` "Deployment has completed" | 2.4 min |
| 4 | `7178d44..7262268` | `scripts/gate.cjs`, a shared input only | build | `success` "Deployment has completed" | 4.4 min |
| 5 | `7262268..b9eb7e0`, **two commits in one push**: `c07b22c` site, then `b9eb7e0` backend-only tip | site, under a backend-only tip (the #301 zoom-ship shape) | build | `success` "Deployment has completed" | 6.2 min |
| 6 | `b9eb7e0..ca70344` | `src/rules/tables.py`, backend only, after a build | **skip** | `success` **"Canceled by Ignored Build Step"** | 18 s |

**How a skip looks on GitHub:**
- The commit status **state is `success`**, with the description "Canceled by Ignored Build Step".
- Anything that reads GitHub states would count a skip as a success. `ship.ps1` step 7 never
  reads the state; it reads the served sha (R3, below).

**The empty-previous case (R1's "confirm"):**
- **Live:** row 1. A backend-only first deploy on a branch built.
- **Locally:** `tests/vercel-ignore.test.ts` covers an empty or missing `VERCEL_GIT_PREVIOUS_SHA`
  (build), a redeploy with the previous sha equal to this one (build), and an unknown sha that
  git can't compare (build).
- **A redeploy** could not be triggered live without dashboard or API access. The script handles
  it explicitly. The approved inline one-liner would have skipped it, because
  `git diff --quiet X X` exits 0; that is why this is a script.

**Local cases** (`tests/vercel-ignore.test.ts`, 7 of 7, the real script under bash on real
history):
- `71cc403`, backend-only: **skips**.
- `a7225ff`, site: builds.
- `aab8caa`, centerline fixture only: builds.
- The #301 zoom-ship push `d6e00a7..0ddc85e`: **builds**, while its tip alone (`0ddc85e^..0ddc85e`)
  **would skip**.
- Empty or missing previous sha, a redeploy, and an unknown sha: all build.

## R2: the drift check

- **What it does:** `tests/build-inputs.test.ts` scans every site `.ts/.tsx/.js/.mjs/.cjs` file for
  `join/resolve(__dirname, …)` literals and `"../"` literals that resolve outside the site. It
  fails on any path `SITE_INPUTS` does not cover.
- **Build time:** about 15 minutes, inside the 30.
- **The real scan today:** 0 uncovered paths. The four listed inputs are exactly what the site
  reaches.
- **Red-proof 1 (synthetic):** unlisted `tests/fixtures/new-thing` and
  `data/jurisdictions/cdot.json` are both caught.
- **Red-proof 2 (real):** with the `tests/fixtures/centerline` entry deleted from `SITE_INPUTS`,
  the scan failed, naming
  `lib\road-detection\stitch.test.ts -> ..\..\tests\fixtures\centerline\bayaud_colorado_pool.json`.
  The entry was then restored, byte-identical (`cmp`).
- **Not seen, stated in the file:** paths built from variables, and `process.cwd()`-relative
  reads. Every such read today is site-local.

## R3: `ship.ps1` step 7 (the served sha), run read-only with `-FrontendCheckOnly`

| Site | `-Sha` | Output | Exit |
|---|---|---|---|
| prod | `fee2f77` (served) | `FRONTEND CURRENT: built at fee2f77 (the served sha is HEAD).` | 0 |
| prod | `360470f` (docs on top of `fee2f77`) | `FRONTEND CURRENT: served fee2f77; no change to the site or its inputs in fee2f77..360470f (build skipped).` | 0 |
| prod | `a7225ff` (its site differs from the served one), 1-min timeout | three `waiting for the build of a7225ff` polls, then `FRONTEND NOT VERIFIED` … `Do NOT close the issue.` | **1** |
| the step-5 preview (`conestruct-dxpu11crh-…vercel.app`) | `ca70344` (**the real skip**, row 6) | `FRONTEND CURRENT: served b9eb7e0; no change to the site or its inputs in b9eb7e0..ca70344 (build skipped).` | 0 |

- **A timeout never prints "current".** The only "current" lines are the two proven branches:
  the served sha is HEAD, or `git diff --quiet served HEAD -- SITE_INPUTS`.

## Left for janitorial

- **The throwaway branch `origin/ship-loop-redproof`** has 7 commits: `32a635d`, `47db2be`,
  `7178d44`, `7262268`, `c07b22c`, `b9eb7e0`, `ca70344`.
- **Its preview deployments.**
- **None is merged.** The branch is deleted by ruling. Recovery sha: `ca70344`.
