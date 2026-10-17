# #336 Rule 5 prediction

**The behavior change.** It's deliberate (rulings S1–S3). The cone label is now 36-inch whenever the plan is at night, or the road type is `freeway` or `expressway`. Today's 45 mph threshold still applies.

## What changes
- Every night plan below 45 mph prints "Traffic Cone (36-inch)" in place of "(28-inch)" on six surfaces:
  - page 1's legend and device summary (`/render/pdf`);
  - the XLSX device list;
  - the quote's Equipment Detail;
  - the crew sheet (markdown and PDF);
  - the UI device breakdown.

  This covers the issue's ten audit rows: shoulder, flagger and near-intersection kinds all route through the one helper.
- A freeway or expressway plan below 45 mph prints 36-inch. The wire's freeway minimum speed makes this rare; it's covered at the helper level.
- The helper's docstring and the call-site comments cite S-630-1 Note 15, not "MUTCD §6F.65". The test comments are updated to match.

## What stays byte-identical
- Every day plan below 45 mph on a non-freeway road, including the tiering fixtures (`adv-ni-denver`, `control-lakewood`: day, 40 / 35 mph) and `control-typical`.
- Every plan at 45 mph and over: it was already 36-inch.
- The quote's price. The rate is keyed by `DeviceType.CONE` (`quote_generator.py:39`), not by size (S5).
- Cone counts, stations and placement. Only the label changes.
- The frontend has no code change. The breakdown row's text comes over the wire.
- Committed evidence under `validation-artifacts/` is a record of past runs and isn't regenerated.
