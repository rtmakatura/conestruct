# s2-arc13 — pre-demo pair: #229 taper cite + /landing redirect

Branch `issue-229-demo-fixes` on top of `eebe82b` (prod at branch time: healthz == origin/main == `eebe82b`).
Two independent fixes, one branch. No wire shape change (a string value moves inside an existing field), so
backend-first ordering is N/A; the redirect is Vercel-only.

## Commits
1. `fcd0853` test: red tests for both fixes (`tests/test_taper_citation_tables.py` 2 fail / 1 pass; `conestruct/site/lib/redirects.test.ts` 1 fail / 1 pass) — `red-run-backend.txt`, `red-run-frontend.txt`.
2. `f2a93c1` fix: taper `source` cites Table 6B-4 for L and Table 6B-3 for the ratio (Refs #229).
3. `07777c8` fix: `/landing` → `/sandbox` permanent redirect in `next.config.mjs`; archived page kept, commented unreachable. No ref (#229 does not mention /landing).
4. this folder.

## Fix A — the citation (defect #19 on the counter)
- `p775-verification.md` — the two table rows quoted from the MUTCD 11th Ed. printed p. 775 text
  (`mutcd-p775-text.txt`, extracted from the committed `validation-artifacts/ta10_flagger/mutcd_part6.pdf`).
  Table 6B-3 "Shoulder Taper at least 0.33 L" / "Merging Taper at least L" / "Note: Use Table 6B-4 to calculate L";
  Table 6B-4 "40 mph or less L = WS²/60" / "45 mph or more L = WS".
- Source change: one new single-source constant `_TBL_TAPER_L = "6B-4"` in `src/api/audit.py`; the shoulder, lane and
  near-intersection `source` sentences each cite 6B-4 for L and 6B-3 for the ratio they apply. Flagger branch and the
  panel footer chip untouched. Values byte-identical.
- Snapshot churn (Rule 5): **predicted** 51 files, one leaf each (50 shoulder + 1 near-intersection);
  **actual** 50 files, one leaf each — `rebaseline-check-only.txt` (CHECK_ONLY: 43/70 grid cases drifted, the single
  diff line is `sections.taper.source`), `rebaseline-grid-write.txt`, `rebaseline-endpoint-write.txt` (7 endpoint
  baselines). Every changed snapshot is a `1 1` numstat. The miss: the "1 near-intersection snapshot" was
  `audit_flagger_reduction_carve_out_pre_correction.json`, a frozen `_pre_` archive miscounted as active; no active
  NI snapshot carries the taper source.
- `rebaseline_check.py` (s2-arc12 pattern, CHECK_ONLY=1 then write) and `rebaseline_endpoint.py` are the exact
  scripts run.
- Green: `green-run-backend-tail.txt` (1945 passed, 2 skipped — 1942 + the 3 new), `containment-run.txt`
  (`tests/test_pdf_containment.py` 12 passed, all zero).

## Fix B — /landing
- Config-level redirect beside the existing `/try` entry (served at the edge before any render); the page component
  stays for the parked rewrite item. Inbound-link grep recorded in the commit message: nothing links to or imports it.
- Green: `green-run-frontend.txt` (113 files, 847 passed — 845 + the 2 new).
- Not run: `next build`. The site's `.next` holds a handle-locked SWC binary from a running process (the same remnant
  handoff.md records); the redirect entry is shape-identical to the `/try` entry that already builds on Vercel.

## Live check (post-ship)
`s2a13-lc-prod.js` — s2-arc12 prologue (timestamp, BASE, healthz JSON verbatim, `git rev-parse origin/main`, abort
on mismatch), then A1 served audit JSON cites, A2 served audit PDF text, B1 `/landing` redirect status + Location,
B2 the followed page. Run from anywhere: `node validation-artifacts/committed/s2-arc13-demo-fixes/s2a13-lc-prod.js`.

- `outS2A13Prod-preship/` — the script run against prod BEFORE the ship (gate PASS on `eebe82b`; the 7 fix-specific
  assertions FAIL, the 7 control assertions PASS). Proves the script discriminates; it is not a verification of the fix.
- `outS2A13Prod/` — the DEFINITIVE post-ship run, 2026-09-02 14:05 UTC: gate PASS (healthz == origin/main == `d7a9ede`), **ALL PASS 14/14** — served audit JSON and PDF cite 6B-4 for L and 6B-3 for L/3 with L 163 / L/3 54 unchanged; `/landing` answers HTTP 308 Location `/sandbox`; the followed page titles "Sandbox · Conestruct" and carries none of the archived copy.

## Environment note
The main-tree `conestruct/site/node_modules` was incomplete (no `.bin`, missing transitive packages) because prior arcs
ran the frontend suite inside worktrees. `npm ci` failed on the handle-locked SWC binary; `npm install` completed
(540 added, 158 changed) and the full suite ran from the main tree. Untracked, no repo change.
