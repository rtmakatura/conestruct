# handoff.md count-line correction (s2-arc12 ruling 1)

handoff.md is untracked and lives only in the main checkout; this
worktree-isolated session cannot edit it.  Replace the "Records
reconciliation" section body (currently: pending-verify line + "Count
once all verify: **69 closed / 17 open.**") with:

---

gh sync opens every docs pass. All four pending closes verified posted
at the 2026-08-31 s2-arc12 sync (#226 closed 08-26; #227, #214, #228
closed 08-31). **Count per gh at that sync: 206 closed / 17 open.** The
prior hand-maintained counter (65→69) had unreconstructable provenance
and is retired (s2-arc12 ruling 1, 2026-08-31): gh is the sole source
of truth — report `gh issue list` numbers at each sync, never a carried
count.
