# Rule 5 outcome: #327, the left-side mirror reads the relayed road

The prediction is `prediction.md` (`9f03039`). The fix is `f929e19`, on `issue-327-left-mirror`, stacked on `issue-323-turn-bay-field` `4bbddcf`.

| Predicted | Outcome |
|---|---|
| `leftSideBuilt` evaluates `withRelayedCenterline(scenario)` | Done (`lib/scenarios/auto-apply.ts`) |
| A built left plan, held as the shell holds it, reads built and the `work_side` row is quiet | Pinned in `left-side.test.ts` for a left shoulder plan and a left near-intersection plan, both with `confirmedRoad` and no `roadDirection`. Red without the fix (2 failed), green with it |
| A moved pin reads not built and the row arms | Pinned |
| Existing mirror tests unchanged | Unchanged: all 375 tests in `lib/scenarios` pass |
| Refused left plan: the banner shows the backend's message | Seen in the browser on the branch preview (`f929e19`, which uses the production backend at `de6a0f5`). N Broadway SB, near-intersection, left side, cross street marked before the work. The banner reads "PLAN DECLINED · LEFT-LANE WORK IS LAID OUT ONLY WHEN THE CROSS STREET IS JUST PAST THE WORK … NEEDS INPUT", the backend's 400 message. It read the generic "Left-side work is laid out for shoulder work and for lane closures…" pointer before (#327's screenshots). `preview-left-far-banner-1440.png`; script `cap327.cjs`. With #323's TA-23 branch shipped, the same banner carries "Enter the left-turn bay storage length under Cross street. …" |
| Frontend only; no plan output change | No backend file is in the diff |

- **vitest:** 2,308 passed (229 files).
- **tsc:** clean.

**Not predicted:** nothing. The mounted-flow check named as optional in the prediction was done as the browser check above.
