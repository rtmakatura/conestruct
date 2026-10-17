# #334 local replay: the two audit rows on the branch

Each row's saved `request.json` posted to the local `/render/audit` and `/render/pdf`,
with the confirmed road's compass heading in place of the site-attached centerline
and no network site scan (neither moves a sign along the road).
Distances are from the start of the shoulder taper. Case 11 = oracle O16.

## e470-r-75: PASS
- Case 11: W5-1 500, W21-5aR 1,000, W21-5aR 2,000, W20-1 5,200
- Audit sign table: W20-1 5,200, W21-5aR 1,000, W21-5aR 2,000, W5-1 500
- Page 1 advance list: W20-1 5,200, W21-5aR 1,000, W21-5aR 2,000, W5-1 500
- W20-2 anywhere on page 1: no
- plan_flags: {'validation_warnings': 0, 'compliance_fails': 0, 'v1_limitations': 0, 'is_clean': True}

## i25-r-65-night-3lanes: PASS
- Case 11: W5-1 500, W21-5aR 1,000, W21-5aR 2,000, W20-1 5,200
- Audit sign table: W20-1 5,200, W21-5aR 1,000, W21-5aR 2,000, W5-1 500
- Page 1 advance list: W20-1 5,200, W21-5aR 1,000, W21-5aR 2,000, W5-1 500
- W20-2 anywhere on page 1: no
- plan_flags: {'validation_warnings': 1, 'compliance_fails': 0, 'v1_limitations': 1, 'is_clean': False}

The I-25 row's one validation warning is the replay's own: the compass heading
(E, 90°) differs from I-25's mapped bearing (114°) by more than the corridor
check's 15°, so `corridor_validation` warns `bearing_conflict`. Production sends
the centerline, so it doesn't get this warning. The row's one V1 limitation is
#310's lanes item ("Drawn as 3 lanes per direction; the road has 4"), which is
also in production's saved audit.

Result: 2/2 PASS.
