# #391 rulings

- R1 (R145 self-ruled): fix the test, not the script. The script's behaviour is right (it waited out its limit and said so); the issue classifies this as test-only.
- R2 (R145 self-ruled): new limit `-WaitMin 0.1` = 6 s, CHOSEN (Rule 12; non-safety test timing). Reason: one read measured 0.47-0.48 s warm here (5 of 5), and ran past 1.2 s under full-suite load (#369 evidence); 6 s is about 12x the warm read and keeps the test to ~7.5 s. `-PollSec 1` kept (no new number).
- R3 (R145 self-ruled): kept the unconditional `assert "waiting" in out` rather than asserting it only when the first read beat the limit, so the test still proves the waiting line exists (the acceptance red proof).
