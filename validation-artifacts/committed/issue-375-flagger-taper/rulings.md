# #375 rulings: a short flagger zone is refused against the taper it draws

Issue: https://github.com/rtmakatura/conestruct/issues/375 (G5 of #370). Branch `issue-375-flagger-taper-limit`, built on the #373 evidence branch `issue-373-prod-check` (`ad70109`), so #373's production check ships with this fix.

## Sources
- MUTCD 11th Ed. Table 6B-3, p. 775, and §6B.08 ¶14, p. 776, as quoted in `validation-artifacts/committed/audit-lane/oracle-sources.md` L3: the one-lane, two-way traffic taper is "50 feet minimum, 100 feet maximum". No speed term. `spacing.one_lane_two_way_taper_length()` returns the 100 ft maximum (already marked as Conestruct's pick there).
- The work-zone-at-least-the-taper limit: no source. It isn't in the audit-lane oracle (L1 onward), the verified MUTCD set in memory.md, or S-630-1 as quoted in the repo. §6B.08 sets the taper lengths, not the limit.

## R1 (R145 self-ruled): option (a), keep the limit, mark it CHOSEN, fix the flagger message
The issue recommends (a) and holds (b) and (c) for a ruling, because either changes which plans build. (a) changes no plan: every request that was refused is still refused and every plan that built still builds.
- The limit is marked CHOSEN (#375) in `validate_corridor_geometry`'s docstring and at the check.
- A flagger refusal now reads: "Work zone length (50 ft) is shorter than the 100 ft one-lane, two-way taper this flagger plan draws. Increase the work zone to at least 100 ft."
- It drops "at 25 mph" and "or reduce the speed limit". The taper doesn't vary with speed, so lowering the speed can't clear the refusal (Rule 10: the old text was a false way out).
- `mutcd_section` stays "6B.08" on every refusal. It still cites the taper length, and the shoulder and lane refusals have to stay byte-identical.

**Open for Ryan:** (b) compare a flagger zone against the 50 ft minimum and draw a 50 ft taper, so a 50 ft zone builds, or (c) drop the limit for flagger plans. Either one changes which plans build, so neither is in this arc.

## Rule 5 churn (predicted before the diff)
- Changes: the `WORK_ZONE_SHORTER_THAN_TAPER` message on a flagger plan with a work zone under 100 ft. The audit 400's `detail.message` and that violation's `message` change. The PDF and every other endpoint refuse with the same 400 body.
- Byte-identical: the shoulder and lane (merging, near-intersection) refusal messages; every flagger plan with a work zone of 100 ft or more; every plan that builds; the frontend (it shows the backend's message and parses nothing from it).
- Not regenerated: the committed audit-lane run `runs/F17/` is the evidence of the old message and stays as recorded.
