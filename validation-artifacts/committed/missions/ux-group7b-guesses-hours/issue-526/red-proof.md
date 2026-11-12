# #526 red proof (ruling 3: "set dates to check")

**Cause (traced, plan.md §1, rulings.md R145 S2).** The old Work dates line (`ScheduleField.tsx` `windowsSummary` at `prompt-ux-group7b` = e331b158) mapped every `hours_eval.status === "unknown"` to "set dates to check". The backend says `unknown` in two cases with dates set: no start and end time (`NO_SCHEDULE_NOTE`), and a class-scoped window with no street class (Denver's weekday windows are scoped to arterials and collectors). The fix is ruling 2's "Add a start and end time to finish the check." for the first, and S2's "Pick a street class to finish the check." for the second, read from the backend's new `hours_days.missing` (`times` / `street_class`).

**Test.** `conestruct/site/components/ScheduleField.hours-line-526.test.ts`, "names the street class, never 'set dates to check' (red on the old code)": Denver, Mon Nov 16 to Fri Nov 20 2026, 9 to 15, street class unset; the block's `hours_eval` is `{status: "unknown", violations: []}` and its `hours_days` is the backend's `missing: "street_class"` shape.

**Method.** The new `ScheduleField.tsx` was copied aside, the old one (`git show prompt-ux-group7b:conestruct/site/components/ScheduleField.tsx`) copied over it, only that test run (`-t "red on the old code"`), then the new file copied back. The new file's sha256 (first 16 hex) was `fd720c956349abe8` before and after; `git diff --stat` on the file was the same before and after (65 insertions, 255 deletions).

**Red (old code):**

```
FAIL  components/ScheduleField.hours-line-526.test.ts > #526 ruling 3: dates set, the check waits on the street class > names the street class, never 'set dates to check' (red on the old code)
AssertionError: expected 'set dates to check' to be 'Pick a street class to finish the che…' // Object.is equality
Expected: "Pick a street class to finish the check."
Received: "set dates to check"
      Tests  1 failed | 6 skipped (7)
```

**Green (new code), whole file:**

```
      Tests  7 passed (7)
```

The file's other six tests pin ruling 2's states: no dates, dates with no times, fits, outside, a weekend with no closures, and no data for the jurisdiction.
