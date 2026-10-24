# #385 failing tests

- tests/test_overspan_mirror.py::test_a_slow_overspan_lets_the_free_mirrors_in_after_its_head_start
  (assert 0.297 >= 0.3; the Windows timing failure tracked in #380)
  - Cycle 0 (diff-verifier): failed in a full run (1 failed, 3553 passed, 2 skipped) and failed once alone on the branch.
  - Cycle 1 (my runs): passed alone 3/3 in the #385 worktree, and 3/3 on base origin/main 58531516 (git archive into a scratch dir).
  - Cycle 1 (diff-verifier): the full run passed, 3554 passed, 2 skipped.
  - Verdict: a timing flake that is already on the base. The #385 diff changes only TypeScript comments, which pytest does not load.
