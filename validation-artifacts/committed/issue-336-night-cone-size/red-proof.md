# #336 red proof

The new file `tests/s630/test_cone_size_note15.py` was run against `origin/main` (`615f9b8`), extracted with `git archive` to a scratch directory, with only the test file copied in.

**On main: `12 failed, 2 passed`.**
- The three night API cases fail on the size itself:
  ```
  AssertionError: broadway-left: page1 prints ['Traffic Cone (28-inch)'], expected Traffic Cone (36-inch)
  AssertionError: adv-flagger: page1 prints ['Traffic Cone (28-inch)'], expected Traffic Cone (36-inch)
  AssertionError: adv-near-intersection: page1 prints ['Traffic Cone (28-inch)'], expected Traffic Cone (36-inch)
  ```
- The two day cases (`shoulder-30-day`, `control-35-day`) pass on main, as they should. They're the byte-identical guard.
- The nine helper-matrix rows fail on main with a `TypeError` (the keyword-only arguments don't exist there). That's a signature failure, not a behavior proof. The behavioral red is the three API cases above.

**On the branch: `14 passed`.** Full backend suite: `2981 passed, 2 skipped` (baseline `2967 passed, 2 skipped`, plus the 14 new tests).
