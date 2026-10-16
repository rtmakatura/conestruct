# #331 red proof

`tests/test_limited_sight_331.py` run against `origin/main` `88e1a33`'s `src` and `tests` (`git archive`), with the file's two new imports stubbed (`LIMITED_SIGHT_ENGINEER_NOTE`, `limited_sight_nearest_sign` don't exist there):

```
18 failed, 1 passed in 4.61s
```

The one pass is `test_a_plan_without_the_flag_is_unchanged`, which pins the unchanged no-flag behavior. Without the stubs, the file fails at collection on main.

On the branch: `19 passed`.
