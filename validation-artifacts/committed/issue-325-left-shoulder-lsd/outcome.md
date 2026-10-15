# Rule 5 outcome: issue-325-left-shoulder-lsd

Prediction: `prediction.md`, committed in `b7d88db8` before the change. Base: `413b2eb1` (the far-side checkpoint) on `main` `bc7280c`.

| Predicted | Outcome |
|---|---|
| `_ADVANCE_SIGN_LABELS` gains `W21-5aL`, nothing else | the only `src/` change (`site_adjustments.py`) |
| a left-shoulder plan with limited sight distance moves `W21-5aL` as the right plan moves `W21-5aR`; the record counts it | `tests/test_left_shoulder_limited_sight_325.py`: the left moved set equals the right's with L for R, and the "Moved N" counts are equal. **Red-proven:** with `W21-5aL` taken out the test fails, and with it back it passes |
| every right plan, every left-shoulder plan without the flag, every other kind unchanged | #323's harness before (`bc7280c`) and after: 102 scenarios × 9 routes = 918 responses, 855 answered 200, **identical** (`p325-before.json` = `p325-after.json`) |
| suites green; mypy 0 | pytest 2881 passed, 2 skipped (2880 + 1); mypy 0; ruff clean |

Nothing unpredicted.
