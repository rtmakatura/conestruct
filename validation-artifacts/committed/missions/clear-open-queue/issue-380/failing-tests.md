# #380 failing tests

## Base full run (`issue-383-footer-scan-stub`, `4f76a8e`)
`1 failed, 3568 passed, 2 skipped`. The run was piped through `tail -1`
with `-p no:cacheprovider`, so the failing test's name was not captured
and can't be recovered without a re-run. That is a slip against the
save-before-re-run rule; recorded here rather than guessed.

Re-runs after it:
- `tests/test_overspan_mirror.py -k slow_overspan` (the base test, from
  `git show HEAD:`), alone, 10 times: 0/10 failed.

## Branch full run (`-rf`)
`3569 passed, 2 skipped`. No failures.
