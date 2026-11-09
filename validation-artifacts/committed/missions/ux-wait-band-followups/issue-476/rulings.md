# #476 rulings (mission ux-wait-band-followups, tracking #478)

No Ryan ruling governs this issue; the work is test tooling only (`scripts/verify-generate-cls.mjs`, the #470 permanent check). Rules in play: Rule 10 (absence of signal renders as absence: a skipped check must say it was skipped) and Rule 11 (the check must run where the bug lives, on production).

## R145 self-ruled 1: the road-pick wait keys on the road list, not the button text
The wait ends when the dialog reads `PICK THE ROAD · <n> FOUND` or `Which road`, or when the dialog's Save & Close button is enabled. The text "Save & Close" alone no longer ends it: the button is in the dialog while it still reads "DETECTING ROADS AT PIN…" (probe in `ux-group6-wait-and-band/prod-check/cls-permanent-asis.txt`). The predicate is the one in `ux-group6-wait-and-band/prod-check/script/verify-generate-cls-prodwait.mjs`, which ran green on production `750660c` (`cls-prod.txt`), reused rather than forked. The 90 s timeout is unchanged.

## R145 self-ruled 2: a skipped outline box check prints a line
When `HOLD_MS < 2000` the script prints `outline box check SKIPPED (HOLD_MS=<n> < 2000: ...)` per width, so a production run says what it did not check (Rule 10). It stays a skip, not a failure: with no hold the in-flight boxes can't be taken. The `outlines left after the settle` check still runs at any hold.

## R145 self-ruled 3: run instructions
The run instructions live in the script header (tracked) and in handoff.md § Next "Permanent check (#470)" (main checkout, untracked). The header's production line gains, verbatim (`scripts/verify-generate-cls.mjs:14-15`): "checks layout shift and outlines left; it prints the outline box check as SKIPPED, since that needs HOLD_MS >= 2000." handoff.md already says the box check needs `HOLD_MS >= 2000`; its "until #476 is fixed, use `script/verify-generate-cls-prodwait.mjs`" line is the mission session's to update at handoff (this sub-agent does not edit handoff.md).

## R145 self-ruled 4: red proof cited, not re-run
The red proof cites `ux-group6-wait-and-band/prod-check/cls-permanent-asis.txt` (production `750660c`, all three widths time out on the disabled Save & Close). The wait line on this branch's base (`2c16bcc`) is byte-identical to the one that run used (#477 changed only other lines), so a re-run against production would repeat the same page loads for the same result.
