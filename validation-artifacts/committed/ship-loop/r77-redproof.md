# R77 red-proof — never ship from inside the branch's own worktree

`tests/test_ship_gate.py` runs the real hook as a subprocess. Its scratch repo is laid out as the real one is:
- a main checkout on `main`;
- `.claude/worktrees/ship-loop-3`, the branch the go names;
- `.claude/worktrees/other-arc`.

## Block direction (red before the guard)

These results are against `scripts/hooks/ship_gate.py` at `a5b4e12`, before R77, with the three new block tests added:

```
FAILED tests/test_ship_gate.py::test_a_ship_from_inside_the_branch_worktree_is_refused_and_keeps_the_go[top]
FAILED tests/test_ship_gate.py::test_a_ship_from_inside_the_branch_worktree_is_refused_and_keeps_the_go[subdir]
FAILED tests/test_ship_gate.py::test_a_set_location_inside_the_command_does_not_move_the_session
3 failed, 68 passed in 33.79s
```

The third test is the #292 shape: the command used `Set-Location` to reach the main checkout, but the session stayed in
the worktree.

## Allow direction (red against an over-broad guard)

The guard's condition is `cwd and current_branch(cwd) == branch`. It was swapped for two over-broad conditions, the
allow tests were run against each, and then the condition was restored:

- variant A, `current_branch(cwd) != "main"` (refuse from ANY arc worktree):
  ```
  FAILED tests/test_ship_gate.py::test_a_ship_from_outside_the_branch_worktree_is_allowed[other-arc]
  1 failed, 1 passed, 69 deselected in 2.38s
  ```
- variant B, `if cwd:` (always refuse):
  ```
  FAILED tests/test_ship_gate.py::test_a_ship_from_outside_the_branch_worktree_is_allowed[main]
  FAILED tests/test_ship_gate.py::test_a_ship_from_outside_the_branch_worktree_is_allowed[other-arc]
  2 failed, 69 deselected in 1.91s
  ```

## Green

With the guard as built, all 71 pass (`71 passed in 31.32s`).

A refusal doesn't spend the go. The first test is refused from inside the worktree, then runs the same go from the main
checkout and is allowed.

**When it takes effect:** the hook runs from `.claude/worktrees/_ship/scripts/hooks/`, which the ship script resets to
`main` on every ship. The guard therefore applies from the ship after the one that carries it.
